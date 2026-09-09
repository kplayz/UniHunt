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

export async function DELETE(request: Request, { params }: { params: { itemId: string } }) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createSupabaseClientForUser(token)
  const { error } = await supabase.from('shortlist_items').delete().eq('id', params.itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PUT(request: Request, { params }: { params: { itemId: string } }) {
  const token = await getTokenFromReq(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createSupabaseClientForUser(token)
  const body = await request.json()
  const updates: any = {}
  if (body.note) updates.note = body.note

  const { data, error } = await supabase.from('shortlist_items').update(updates).eq('id', params.itemId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
