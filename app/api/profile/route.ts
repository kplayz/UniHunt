import { NextResponse } from 'next/server'
import { getUserFromToken } from '../../../lib/serverAuth'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  if (!bearer) {
    // attempt cookie-based token (common Supabase storage key)
    const cookie = request.headers.get('cookie') || ''
    const match = cookie.match(/sb-access-token=([^;]+)/)
    if (match) {
      const token = decodeURIComponent(match[1])
      const user = await getUserFromToken(token)
      if (user) return NextResponse.json(user)
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserFromToken(bearer)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(user)
}
