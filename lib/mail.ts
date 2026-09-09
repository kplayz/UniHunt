import nodemailer from 'nodemailer'

const host = process.env.SMTP_HOST || ''
const port = parseInt(process.env.SMTP_PORT || '587', 10)
const user = process.env.SMTP_USER || ''
const pass = process.env.SMTP_PASS || ''
const from = process.env.FROM_EMAIL || `noreply@${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https?:\/\//, '') || 'example.com'}`
const adminAlert = process.env.ADMIN_ALERT_EMAIL || ''

let transporter: nodemailer.Transporter | null = null
if (host && user && pass) {
  transporter = nodemailer.createTransport({ host, port, auth: { user, pass } })
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!transporter) {
    console.warn('SMTP not configured; skipping email to', to)
    return false
  }
  try {
    await transporter.sendMail({ from, to, subject, text, html })
    return true
  } catch (e) {
    console.error('sendEmail error', e)
    return false
  }
}

export function getAdminAlertEmail() {
  return adminAlert
}
