import { NextResponse } from 'next/server'
import { supabaseServer } from '../../../../lib/supabaseServer'
import { createSupabaseClientForUser } from '../../../../lib/supabaseUserClient'

async function getTokenFromReq(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1]
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/sb-access-token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return null
}

export async function GET(request: Request) {
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

    const { data, error } = await supabaseServer.from('hf_alerts').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
