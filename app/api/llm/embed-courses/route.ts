import { NextResponse } from 'next/server'
import { supabaseServer } from '../../../../lib/supabaseServer'
import { getEmbeddings } from '../../../../server/llm/hfClient'
import { createSupabaseClientForUser } from '../../../../lib/supabaseUserClient'

async function getTokenFromReq(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1]
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/sb-access-token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return null
}

export async function POST(request: Request) {
  // Protected endpoint: allow only service-role calls OR admin users
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const svcHeader = request.headers.get('x-service-role') || ''
    if (svcHeader && serviceKey && svcHeader === serviceKey) {
      // allowed as service
    } else {
      // require user token and admin profile
      const token = await getTokenFromReq(request)
      if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const userClient = createSupabaseClientForUser(token)
      const userRes = await userClient.auth.getUser()
      const user = userRes.data.user
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { data: profile, error: pErr } = await supabaseServer.from('profiles').select('is_admin').eq('id', user.id).single()
      if (pErr && pErr.code !== 'PGRST116') return NextResponse.json({ error: pErr.message }, { status: 500 })
      if (!profile || !profile.is_admin) return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // proceed
    // Fetch courses
    const { data: courses, error: courseErr } = await supabaseServer.from('courses').select('id, name, overview')
    if (courseErr) return NextResponse.json({ error: courseErr.message }, { status: 500 })
    if (!courses || courses.length === 0) return NextResponse.json({ message: 'No courses found' })

    const results: any[] = []
    for (const c of courses) {
      const text = `${c.name} ${c.overview ?? ''}`
      try {
        const emb = await getEmbeddings(text)
        if (!emb) continue
        // store embedding as jsonb array
        await supabaseServer.from('course_embeddings').upsert({ course_id: c.id, embedding: emb })
        results.push({ course_id: c.id })
      } catch (e) {
        console.error('embed error', e)
      }
    }

    return NextResponse.json({ imported: results.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
