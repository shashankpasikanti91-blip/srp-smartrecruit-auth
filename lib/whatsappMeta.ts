/**
 * Meta WhatsApp Cloud API helpers — webhook verify, signature, tenant resolve, status map.
 * Secrets stay server-side. Never invent Connected without Test + real Meta traffic.
 */
import crypto from 'crypto'
import { pool } from '@/lib/db'
import { writeTimeline } from '@/lib/timelineEngine'
import { insertCommLog } from '@/lib/commLog'

export type WhatsAppTenantBinding = {
  tenantId: string
  userId: string | null
  config: Record<string, string>
}

export function normalizePhoneE164Digits(raw: string): string {
  return String(raw || '').replace(/^whatsapp:/i, '').replace(/\D/g, '')
}

export function mapMetaDeliveryStatus(metaStatus: string): string {
  const s = metaStatus.toLowerCase()
  if (s === 'sent') return 'sent'
  if (s === 'delivered') return 'delivered'
  if (s === 'read') return 'read'
  if (s === 'failed') return 'failed'
  if (s === 'deleted') return 'failed'
  return s || 'pending'
}

/** Meta webhook subscription challenge (GET). */
export function verifyMetaChallenge(opts: {
  mode: string | null
  token: string | null
  challenge: string | null
  expectedTokens: string[]
}): string | null {
  if (opts.mode !== 'subscribe' || !opts.token || !opts.challenge) return null
  const ok = opts.expectedTokens.some(t => t && t === opts.token)
  return ok ? opts.challenge : null
}

/**
 * Validate X-Hub-Signature-256. Fail closed when appSecret is configured.
 * When no secret is configured, returns { ok: false, reason: 'no_secret' }.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | null | undefined,
): { ok: boolean; reason?: string } {
  const secret = (appSecret || '').trim()
  if (!secret) return { ok: false, reason: 'no_secret' }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return { ok: false, reason: 'missing_signature' }
  }
  const expected = signatureHeader.slice('sha256='.length)
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(digest, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return { ok: false, reason: 'mismatch' }
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'mismatch' }
  return { ok: true }
}

export async function resolveWhatsAppTenantByPhoneNumberId(
  phoneNumberId: string,
): Promise<WhatsAppTenantBinding | null> {
  const id = String(phoneNumberId || '').trim()
  if (!id) return null
  try {
    const { rows } = await pool.query<{
      tenant_id: string
      user_id: string | null
      config: Record<string, string>
    }>(
      `SELECT tenant_id, user_id, config
       FROM integrations
       WHERE slug = 'whatsapp'
         AND (config->>'phone_number_id') = $1
       LIMIT 1`,
      [id],
    )
    if (!rows[0]) return null
    return {
      tenantId: rows[0].tenant_id,
      userId: rows[0].user_id,
      config: (rows[0].config as Record<string, string>) ?? {},
    }
  } catch {
    return null
  }
}

export async function collectWhatsAppVerifyTokens(): Promise<string[]> {
  const tokens = new Set<string>()
  const envTok = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_WHATSAPP_VERIFY_TOKEN
  if (envTok) tokens.add(envTok)
  try {
    const { rows } = await pool.query<{ t: string }>(
      `SELECT DISTINCT config->>'verify_token' AS t
       FROM integrations
       WHERE slug = 'whatsapp'
         AND COALESCE(config->>'verify_token', '') <> ''`,
    )
    for (const r of rows) if (r.t) tokens.add(r.t)
  } catch { /* table may not exist yet */ }
  return [...tokens]
}

export async function resolveAppSecretForBinding(
  binding: WhatsAppTenantBinding | null,
): Promise<string | null> {
  const fromCfg = binding?.config?.app_secret?.trim()
  if (fromCfg) return fromCfg
  return (process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '').trim() || null
}

async function findResumeIdByPhone(tenantId: string, digits: string): Promise<string | null> {
  const last10 = digits.slice(-10)
  if (last10.length < 8) return null
  try {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM resumes
       WHERE tenant_id = $1
         AND RIGHT(regexp_replace(COALESCE(candidate_phone, ''), '\\D', '', 'g'), 10) = $2
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [tenantId, last10],
    )
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}

type MetaStatus = { id: string; status: string; timestamp?: string; errors?: { title?: string; message?: string }[] }
type MetaMessage = {
  from?: string
  id?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
}

/**
 * Process Meta Cloud webhook payload. Always safe to call after signature check.
 * Returns counts for observability (no secrets).
 */
export async function processWhatsAppWebhookPayload(
  payload: Record<string, unknown>,
): Promise<{ statuses: number; inbound: number; unbound: number }> {
  let statuses = 0
  let inbound = 0
  let unbound = 0

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown }).changes)
      ? (entry as { changes: unknown[] }).changes
      : []
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value
      if (!value) continue
      const meta = value.metadata as { phone_number_id?: string } | undefined
      const phoneNumberId = meta?.phone_number_id ?? ''
      const binding = await resolveWhatsAppTenantByPhoneNumberId(phoneNumberId)
      if (!binding) {
        unbound++
        continue
      }

      const statusList = Array.isArray(value.statuses) ? (value.statuses as MetaStatus[]) : []
      for (const st of statusList) {
        if (!st?.id) continue
        const delivery = mapMetaDeliveryStatus(st.status)
        const errMsg = st.errors?.[0]?.title || st.errors?.[0]?.message || null
        try {
          const sets = [`delivery_status = $1`]
          const vals: unknown[] = [delivery]
          let i = 2
          if (delivery === 'delivered' || delivery === 'sent') {
            sets.push(`status = 'sent'`)
            sets.push(`sent_at = COALESCE(sent_at, NOW())`)
          }
          if (delivery === 'read') {
            sets.push(`status = 'sent'`)
            sets.push(`read_at = COALESCE(read_at, NOW())`)
            sets.push(`opened_at = COALESCE(opened_at, NOW())`)
          }
          if (delivery === 'failed') {
            sets.push(`status = 'failed'`)
            if (errMsg) {
              sets.push(`failed_reason = $${i}`)
              vals.push(String(errMsg).slice(0, 500))
              i++
            }
          }
          vals.push(st.id, binding.tenantId)
          await pool.query(
            `UPDATE communication_logs SET ${sets.join(', ')}
             WHERE provider_message_id = $${i} AND tenant_id = $${i + 1}`,
            vals,
          )
          statuses++
        } catch (e) {
          console.warn('[whatsapp webhook] status update', e instanceof Error ? e.message : e)
        }
      }

      const messages = Array.isArray(value.messages) ? (value.messages as MetaMessage[]) : []
      for (const msg of messages) {
        const fromDigits = normalizePhoneE164Digits(msg.from ?? '')
        const bodyText =
          msg.type === 'text'
            ? (msg.text?.body ?? '')
            : `[${msg.type || 'message'}]`
        const wamid = msg.id ?? null
        const resumeId = await findResumeIdByPhone(binding.tenantId, fromDigits)
        const systemUser =
          binding.userId ||
          (await pool.query<{ id: string }>(
            `SELECT user_id AS id FROM tenant_members WHERE tenant_id = $1 AND role IN ('owner','admin') AND invite_accepted = TRUE LIMIT 1`,
            [binding.tenantId],
          ).then(r => r.rows[0]?.id).catch(() => null))

        if (!systemUser) {
          unbound++
          continue
        }

        const logId = await insertCommLog({
          userId: systemUser,
          tenantId: binding.tenantId,
          channel: 'whatsapp',
          to: fromDigits,
          subject: 'Inbound WhatsApp',
          body: bodyText || '(empty)',
          status: 'received',
          resumeId,
          deliveryStatus: 'delivered',
          direction: 'inbound',
          providerMessageId: wamid,
          recipientPhoneE164: fromDigits,
        })

        if (resumeId) {
          await writeTimeline({
            tenantId: binding.tenantId,
            entityType: 'whatsapp',
            entityId: logId ?? resumeId,
            resumeId,
            eventType: 'comm_inbound',
            title: 'WhatsApp received',
            detail: bodyText.slice(0, 280),
            actorUserId: systemUser,
            meta: { wamid, from: fromDigits },
          })
        }
        inbound++
      }
    }
  }

  return { statuses, inbound, unbound }
}
