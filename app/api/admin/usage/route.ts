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

    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabaseServer.rpc('get_hf_usage_summary', { p_date: today })
    // fallback if rpc not present
    if (error) {
      const q = `SELECT p.id as user_id, p.full_name, p.username, p.hf_daily_limit, p.hf_soft_limit, coalesce(u.calls,0) as calls
                 FROM profiles p
                 LEFT JOIN hf_usage u ON u.user_id = p.id AND u.usage_date = $1
                 ORDER BY calls DESC`;
      const res = await supabaseServer.rpc('pg_exec', { query: q, params: [today] } as any)
      // if rpc not available, do simple query via from
      const { data: usageRows } = await supabaseServer.from('hf_usage').select('user_id,calls').eq('usage_date', today)
      const { data: profiles } = await supabaseServer.from('profiles').select('id,full_name,username,hf_daily_limit,hf_soft_limit')
      const mapped = (profiles || []).map((p: any) => {
        const u = (usageRows || []).find((x: any) => x.user_id === p.id)
        return { user_id: p.id, full_name: p.full_name, username: p.username, hf_daily_limit: p.hf_daily_limit, hf_soft_limit: p.hf_soft_limit, calls: u?.calls || 0 }
      })
      return NextResponse.json({ data: mapped })
    }

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
