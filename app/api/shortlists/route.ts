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
  const { data, error } = await supabase.from('shortlists').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseClientForUser(token)
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const name = body.name || 'My shortlist'
  const is_public = body.is_public || false

  const { data, error } = await supabase.from('shortlists').insert([{ user_id: user.id, name, is_public }]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
