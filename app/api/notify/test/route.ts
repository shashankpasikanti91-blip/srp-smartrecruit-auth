/**
 * POST /api/notify/test
 * Quick endpoint to verify Telegram + email alerts are working.
 * Only callable by owner.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendTelegram, sendEmail } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ownerEmails = (process.env.OWNER_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase())
  if (!ownerEmails.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: Record<string, string> = {}

  try {
    await sendTelegram(
      `🔔 <b>SRP Recruit AI Labs — Test Alert</b>\n\nNotification system is working correctly.\n🕒 ${new Date().toISOString()}`
    )
    results.telegram = 'sent'
  } catch (e) {
    results.telegram = `failed: ${e}`
  }

  try {
    await sendEmail({
      subject: '🔔 SRP Recruit AI Labs — Test Alert',
      html: '<p>Notification system is working correctly.</p><p>Time: ' + new Date().toISOString() + '</p>',
    })
    results.email = 'sent'
  } catch (e) {
    results.email = `failed: ${e}`
  }

  return NextResponse.json({ ok: true, results })
}
