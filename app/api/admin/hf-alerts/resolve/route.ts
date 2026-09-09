import { NextResponse } from 'next/server'
import { supabaseServer } from '../../../../../lib/supabaseServer'
import { createSupabaseClientForUser } from '../../../../../lib/supabaseUserClient'

async function getTokenFromReq(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1]
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/sb-access-token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return null
}

export async function POST(request: Request) {
  try {
    const token = await getTokenFromReq(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userClient = createSupabaseClientForUser(token)
    const userRes = await userClient.auth.getUser()
    const user = userRes.data.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile, error: pErr } = await supabaseServer.from('profiles').select('is_admin').eq('id', user.id).single()
    if (pErr && pErr.code !== 'PGRST116') return NextResponse.json({ error: pErr.message }, { status: 500 })
    if (!profile || !profile.is_admin) return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })

    const body = await request.json()
    const id = body?.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await supabaseServer.from('hf_alerts').update({ resolved: true }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
