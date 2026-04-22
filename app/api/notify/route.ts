/**
 * GET  /api/notify        — return notification settings & recent alerts
 * POST /api/notify        — send or queue an alert (action: 'send' | 'update_settings')
 *
 * Separate from /api/notify/test which is owner-only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pool } from '@/lib/db'
import { sendTelegram, sendEmail } from '@/lib/notifications'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string
  const url = new URL(req.url)
  const type = url.searchParams.get('type') ?? 'recent'

  try {
    if (type === 'recent') {
      // Return last 20 activity log entries as notifications
      const { rows } = await pool.query(
        `SELECT id, event_type AS type, event_data AS data, severity, created_at
         FROM activity_log
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [userId]
      )
      return NextResponse.json({ notifications: rows })
    }

    if (type === 'unread_count') {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM activity_log
         WHERE user_id = $1 AND notified = false`,
        [userId]
      )
      return NextResponse.json({ unread: parseInt(rows[0]?.cnt ?? '0') })
    }

    if (type === 'settings') {
      // Return feature_flags for notification preferences if table exists
      try {
        const { rows } = await pool.query(
          `SELECT feature, is_enabled, config FROM feature_flags
           WHERE user_id = $1 AND feature LIKE 'notify_%'`,
          [userId]
        )
        return NextResponse.json({ settings: rows })
      } catch {
        return NextResponse.json({ settings: [] })
      }
    }

    return NextResponse.json({ notifications: [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as Record<string, unknown>).userId as string

  try {
    const body = await req.json() as Record<string, unknown>
    const { action } = body as { action: string }

    // Mark all as read
    if (action === 'mark_read') {
      await pool.query(
        `UPDATE activity_log SET notified = true
         WHERE user_id = $1 AND notified = false`,
        [userId]
      )
      return NextResponse.json({ status: 'ok' })
    }

    // Send a notification via connected channel
    if (action === 'send') {
      const { channel, message, subject } = body as {
        channel: 'telegram' | 'email'
        message: string
        subject?: string
      }
      if (!channel || !message) {
        return NextResponse.json({ error: 'channel and message required' }, { status: 400 })
      }
      if (channel === 'telegram') {
        await sendTelegram(message)
        return NextResponse.json({ status: 'sent', channel: 'telegram' })
      }
      if (channel === 'email') {
        await sendEmail({
          subject: subject ?? 'SRP SmartRecruit Notification',
          html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
        })
        return NextResponse.json({ status: 'sent', channel: 'email' })
      }
      return NextResponse.json({ error: `Unsupported channel: ${channel}` }, { status: 400 })
    }

    // Update notification settings
    if (action === 'update_settings') {
      const { feature, is_enabled, config } = body as {
        feature: string
        is_enabled: boolean
        config?: Record<string, unknown>
      }
      if (!feature) return NextResponse.json({ error: 'feature required' }, { status: 400 })
      try {
        await pool.query(
          `INSERT INTO feature_flags (user_id, feature, is_enabled, config)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, feature) DO UPDATE
             SET is_enabled = EXCLUDED.is_enabled, config = EXCLUDED.config`,
          [userId, feature, is_enabled ?? false, JSON.stringify(config ?? {})]
        )
      } catch {
        // feature_flags table may not exist, silently skip
      }
      return NextResponse.json({ status: 'updated' })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
