import { NextResponse } from 'next/server'
import { createSupabaseClientForUser } from '../../../../lib/supabaseUserClient'

async function getTokenFromReq(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1]
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/sb-access-token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return null
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseClientForUser(token)
  const { data, error } = await supabase.from('shortlists').select('*, shortlist_items(*)').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createSupabaseClientForUser(token)
  const body = await request.json()
  const updates: any = {}
  if (body.name) updates.name = body.name
  if (typeof body.is_public === 'boolean') updates.is_public = body.is_public

  const { data, error } = await supabase.from('shortlists').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createSupabaseClientForUser(token)
  const { error } = await supabase.from('shortlists').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
