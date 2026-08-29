/**
 * Shared communication_logs writer for Comms Hub + email/send paths.
 */
import { pool } from '@/lib/db'

export async function insertCommLog(opts: {
  userId: string
  tenantId?: string | null
  channel: string
  to: string
  subject: string
  body: string
  status: string
  errorMsg?: string | null
  resumeId?: string | null
  jobPostId?: string | null
  clientId?: string | null
  recruiterUserId?: string | null
  retryOf?: string | null
  threadKey?: string | null
  deliveryStatus?: string | null
  direction?: 'outbound' | 'inbound' | null
  providerMessageId?: string | null
  recipientPhoneE164?: string | null
}): Promise<string | null> {
  // recruiterUserId reserved for future column; sender is userId today
  void opts.recruiterUserId
  const phone =
    opts.recipientPhoneE164 ??
    (opts.channel === 'whatsapp' ? opts.to.replace(/\D/g, '') : null)
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO communication_logs
         (user_id, tenant_id, channel, recipient, subject, body_preview, body, status,
          error_message, sent_at, resume_id, job_post_id, client_id, retry_of, thread_key,
          delivery_status, direction, provider_message_id, recipient_phone_e164)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
               CASE WHEN $8 IN ('sent','delivered','received') THEN NOW() ELSE NULL END,
               $10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        opts.userId,
        opts.tenantId ?? null,
        opts.channel,
        opts.to,
        opts.subject,
        opts.body.substring(0, 500),
        opts.body,
        opts.status,
        opts.errorMsg ?? null,
        opts.resumeId ?? null,
        opts.jobPostId ?? null,
        opts.clientId ?? null,
        opts.retryOf ?? null,
        opts.threadKey ?? opts.resumeId ?? opts.to,
        opts.deliveryStatus ?? (opts.status === 'sent' ? 'sent' : opts.status === 'failed' ? 'failed' : opts.status === 'received' ? 'delivered' : 'pending'),
        opts.direction ?? 'outbound',
        opts.providerMessageId ?? null,
        phone || null,
      ]
    )
    return rows[0]?.id ?? null
  } catch (logErr) {
    console.warn('[comms] Log write failed:', logErr instanceof Error ? logErr.message : logErr)
    try {
      await pool.query(
        `INSERT INTO communication_logs
           (user_id, channel, recipient, subject, body_preview, status, error_message, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $6='sent' THEN NOW() ELSE NULL END)`,
        [opts.userId, opts.channel, opts.to, opts.subject, opts.body.substring(0, 500), opts.status, opts.errorMsg ?? null]
      )
    } catch { /* ignore */ }
    return null
  }
}
