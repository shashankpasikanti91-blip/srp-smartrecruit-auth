/**
 * Meta WhatsApp Cloud webhooks (public — signature verified).
 *
 * Configure in Meta Developer Console:
 *   Callback URL: https://<your-host>/api/webhooks/whatsapp
 *   Verify token: same as Integrations → WhatsApp → verify_token (or WHATSAPP_VERIFY_TOKEN env)
 *   App secret:   META_APP_SECRET env (preferred) or tenant config.app_secret
 *
 * REQUIRES EXTERNAL CONFIGURATION — without Meta app + public HTTPS this stays inactive.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  collectWhatsAppVerifyTokens,
  processWhatsAppWebhookPayload,
  resolveAppSecretForBinding,
  resolveWhatsAppTenantByPhoneNumberId,
  verifyMetaChallenge,
  verifyMetaSignature,
} from '@/lib/whatsappMeta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const expected = await collectWhatsAppVerifyTokens()
  if (!expected.length) {
    return NextResponse.json(
      { error: 'WhatsApp verify token not configured — set WHATSAPP_VERIFY_TOKEN or Integrations verify_token' },
      { status: 503 },
    )
  }

  const ok = verifyMetaChallenge({ mode, token, challenge, expectedTokens: expected })
  if (ok == null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return new NextResponse(ok, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  // Prefer platform secret; if absent, try first phone_number_id binding's app_secret
  let appSecret =
    (process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '').trim() || null

  if (!appSecret) {
    try {
      const parsed = JSON.parse(rawBody) as {
        entry?: { changes?: { value?: { metadata?: { phone_number_id?: string } } }[] }[]
      }
      const phoneNumberId =
        parsed.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
      if (phoneNumberId) {
        const binding = await resolveWhatsAppTenantByPhoneNumberId(phoneNumberId)
        appSecret = await resolveAppSecretForBinding(binding)
      }
    } catch {
      /* fall through */
    }
  }

  const sig = verifyMetaSignature(rawBody, signature, appSecret)
  if (!sig.ok) {
    if (sig.reason === 'no_secret') {
      const isProd =
        process.env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production'
      if (isProd) {
        return NextResponse.json(
          { error: 'META_APP_SECRET / app_secret required for WhatsApp webhooks in production' },
          { status: 503 },
        )
      }
      console.warn('[webhooks/whatsapp] accepting unsigned webhook in non-production (configure META_APP_SECRET)')
    } else {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const result = await processWhatsAppWebhookPayload(payload)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[webhooks/whatsapp]', e instanceof Error ? e.message : e)
    // Always 200 to Meta after accept to avoid retry storms on our bugs — log only
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
