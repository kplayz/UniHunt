import { NextResponse } from 'next/server'
import { createSupabaseClientForUser } from '../../../lib/supabaseUserClient'

async function getTokenFromReq(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1]
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/sb-access-token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return null
}

export async function GET(request: Request) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createSupabaseClientForUser(token)
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('profiles').select('semantic_default, hf_daily_limit').eq('id', user.id).single()
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ semantic_default: false, hf_daily_limit: 50 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createSupabaseClientForUser(token)
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const semantic_default = Boolean(body.semantic_default)
  const hf_daily_limit = typeof body.hf_daily_limit === 'number' ? body.hf_daily_limit : 50

  // Upsert into profiles
  const { data, error } = await supabase.from('profiles').upsert({ id: user.id, semantic_default, hf_daily_limit }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
