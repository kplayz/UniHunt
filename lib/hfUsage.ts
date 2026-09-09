import { supabaseServer } from './supabaseServer'
import { sendEmail, getAdminAlertEmail } from './mail'

async function getUserEmail(userId: string) {
  // try admin getUser first (supabase-js admin API), fallback to querying auth.users
  try {
    // @ts-ignore - admin API may exist on the client depending on sdk version
    const adminRes = await (supabaseServer.auth as any).admin?.getUserById?.(userId)
    if (adminRes && adminRes.data?.user?.email) return adminRes.data.user.email
  } catch (e) {
    // ignore
  }
  try {
    const { data, error } = await supabaseServer.from('auth.users').select('email').eq('id', userId).single()
    if (!error && data?.email) return data.email
  } catch (e) {
    // ignore
  }
  return null
}

export async function getTodayCount(userId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabaseServer.from('hf_usage').select('calls').eq('user_id', userId).eq('usage_date', today).single()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data?.calls ? Number(data.calls) : 0
}

export async function checkAndIncrement(userId: string, delta = 1) {
  const today = new Date().toISOString().slice(0, 10)
  // fetch user limit
  const { data: profile, error: pErr } = await supabaseServer.from('profiles').select('hf_daily_limit, hf_soft_limit').eq('id', userId).single()
  if (pErr && pErr.code !== 'PGRST116') throw new Error(pErr.message)
  const limit = profile?.hf_daily_limit ?? 50
  const soft = profile?.hf_soft_limit ?? Math.floor(limit * 0.8)

  // enforce optional global daily cap
  const globalLimit = Number(process.env.HF_GLOBAL_DAILY_LIMIT || '0')
  if (globalLimit > 0) {
    try {
      const { data: allRows } = await supabaseServer.from('hf_usage').select('calls').eq('usage_date', today)
      const sum = (allRows || []).reduce((s: number, r: any) => s + (Number(r.calls) || 0), 0)
      if (sum + delta > globalLimit) {
        throw new Error('HF global daily limit reached')
      }
    } catch (e) {
      // if the global check fails due to DB, continue; don't block all users
      console.warn('global limit check failed', e)
    }
  }

  // fetch current calls
  const { data, error } = await supabaseServer.from('hf_usage').select('calls').eq('user_id', userId).eq('usage_date', today).single()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  const current = data?.calls ? Number(data.calls) : 0
  const newCalls = current + delta
  if (newCalls > limit) {
    throw new Error('HF daily limit reached')
  }

  // upsert increment
  const { error: upErr } = await supabaseServer.from('hf_usage').upsert({ user_id: userId, usage_date: today, calls: newCalls }).select()
  if (upErr) throw new Error(upErr.message)
  // if crossed soft threshold, record alert and send email
  if (current < soft && newCalls >= soft) {
    const message = `You have reached your soft usage threshold for Hugging Face API usage. Current usage: ${newCalls}/${limit}.`;
    // insert an alert record
    try {
      await supabaseServer.from('hf_alerts').insert({ user_id: userId, alert_type: 'soft_threshold', message, email_to: null, email_sent: false })
    } catch (e) {
      console.warn('failed to insert hf_alerts', e)
    }

    // try to send email to user and admin
    try {
      const userEmail = await getUserEmail(userId)
      let sentUser = false
      if (userEmail) {
        sentUser = await sendEmail(userEmail, 'Hugging Face usage warning', message)
      }
      const admin = getAdminAlertEmail()
      let sentAdmin = false
      if (admin) sentAdmin = await sendEmail(admin, `User ${userId} HF usage warning`, `User ${userId} crossed soft threshold: ${newCalls}/${limit}`)

      if (sentUser || sentAdmin) {
        await supabaseServer.from('hf_alerts').insert({ user_id: userId, alert_type: 'soft_threshold_email', message, email_to: userEmail || admin || null, email_sent: true })
      }
    } catch (e) {
      console.warn('error sending hf alert emails', e)
    }
  }

  return { previous: current, now: newCalls, limit, soft }
}
