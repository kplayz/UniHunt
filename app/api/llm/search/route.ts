import { NextResponse } from 'next/server'
import { supabaseServer } from '../../../../lib/supabaseServer'
import { getEmbeddings, chatCompletion } from '../../../../server/llm/hfClient'
import { createSupabaseClientForUser } from '../../../../lib/supabaseUserClient'
import { checkAndIncrement } from '../../../../lib/hfUsage'

async function getTokenFromReq(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1]
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/sb-access-token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return null
}

function cosine(a: number[], b: number[]) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const query = body.query || body.q || ''
    const limit = body.limit || 10
    const useLLM = body.useLLM || false
    const countries: string[] | null = body.countries && Array.isArray(body.countries) ? body.countries : null
    const level: string | null = body.level || null

    if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

    // identify user from cookie or Authorization header
    const token = await getTokenFromReq(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userClient = createSupabaseClientForUser(token)
    const userRes = await userClient.auth.getUser()
    const user = userRes.data.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // enforce HF daily limit: count one embedding call for this query
    try {
      await checkAndIncrement(user.id, 1)
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'HF limit reached' }, { status: 429 })
    }

    const qEmb = await getEmbeddings(query)
    if (!qEmb) return NextResponse.json({ error: 'Failed to embed query' }, { status: 500 })

    let queryBuilder = supabaseServer.from('course_search').select('*, courses:course_id(*)')
    if (countries && countries.length > 0) {
      queryBuilder = queryBuilder.in('country', countries)
    }
    if (level) {
      queryBuilder = queryBuilder.eq('course_level', level)
    }
    const { data: rows, error } = await queryBuilder
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // fetch embeddings
    const { data: embRows } = await supabaseServer.from('course_embeddings').select('*')
    const embMap: Record<string, number[]> = {}
    for (const e of embRows || []) {
      try {
        embMap[e.course_id] = Array.isArray(e.embedding) ? e.embedding : e.embedding?.data ?? e.embedding
      } catch (e) {}
    }

    const scored: any[] = []
    for (const r of rows || []) {
      const emb = embMap[r.course_id]
      if (!emb) continue
      const score = cosine(qEmb, emb)
      scored.push({ row: r, score })
    }

    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, limit).map(s => ({ ...s.row, relevance: s.score }))

    if (useLLM) {
      // Optional re-ranking or summary via HF chat completion
      const prompt = `Given the user query: "${query}", rank the following course entries by relevance and return a short justification for the top result. Return JSON array with course_id, university_name, course_name, relevance, note.`
      const messages = [{ role: 'system', content: 'You are an assistant that ranks university courses.' }, { role: 'user', content: prompt + '\n' + JSON.stringify(top) }]
      try {
        // check and increment for LLM call as well
        try {
          await checkAndIncrement(user.id, 1)
        } catch (e: any) {
          return NextResponse.json({ error: e.message || 'HF limit reached' }, { status: 429 })
        }
        const res = await chatCompletion(messages)
        return NextResponse.json({ top, llm: res })
      } catch (e) {
        console.error('LLM error', e)
        return NextResponse.json({ top })
      }
    }

    return NextResponse.json({ top })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
