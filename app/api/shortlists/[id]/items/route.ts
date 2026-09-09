import { NextResponse } from 'next/server'
import { createSupabaseClientForUser } from '../../../../../lib/supabaseUserClient'

async function getTokenFromReq(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1]
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/sb-access-token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return null
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseClientForUser(token)
  const body = await request.json()
  const { university_id, course_id, note } = body
  if (!university_id || !course_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data, error } = await supabase.from('shortlist_items').insert([{ shortlist_id: params.id, university_id, course_id, note }]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createSupabaseClientForUser(token)
  const { data, error } = await supabase.from('shortlist_items').select('*, universities(*), courses(*)').eq('shortlist_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
