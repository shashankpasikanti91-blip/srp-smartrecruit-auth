/**
 * SRP AI Labs — Notification Service
 * Sends alerts to owner via Telegram bot and email (nodemailer / Gmail SMTP)
 */
import nodemailer from 'nodemailer'

// ─── Config ──────────────────────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID!
const OWNER_EMAIL        = process.env.OWNER_EMAIL ?? 'pasikantishashank24@gmail.com'
const SMTP_HOST          = process.env.SMTP_HOST ?? 'smtp.gmail.com'
const SMTP_PORT          = parseInt(process.env.SMTP_PORT ?? '587')
const SMTP_USER          = process.env.SMTP_USER ?? ''
const SMTP_PASS          = process.env.SMTP_PASS ?? ''

// ─── Telegram ─────────────────────────────────────────────────────────────────

export async function sendTelegram(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[notify] Telegram env vars not set — skipping')
    return
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[notify] Telegram error:', body)
    }
  } catch (err) {
    console.error('[notify] Telegram fetch failed:', err)
  }
}

// ─── Email ────────────────────────────────────────────────────────────────────

function getTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
  })
}

export async function sendEmail(opts: {
  subject: string
  html: string
  to?: string
}): Promise<void> {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('[notify] SMTP not configured — skipping email')
    return
  }
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: `"SRP AI Labs" <${SMTP_USER}>`,
      to: opts.to ?? OWNER_EMAIL,
      subject: opts.subject,
      html: opts.html,
    })
  } catch (err) {
    console.error('[notify] Email send failed:', err)
  }
}

// ─── Composed notification helpers ───────────────────────────────────────────

export async function notifyNewSignup(user: {
  name: string | null; email: string; provider: string; created_at?: string
}): Promise<void> {
  const name  = user.name ?? 'Unknown'
  const now   = new Date().toISOString()

  // Telegram
  await sendTelegram(
    `🎉 <b>New Signup — SRP AI Labs</b>\n\n` +
    `👤 <b>Name:</b> ${name}\n` +
    `📧 <b>Email:</b> ${user.email}\n` +
    `🔐 <b>Provider:</b> ${user.provider}\n` +
    `🕒 <b>Time:</b> ${now}`
  )

  // Email
  await sendEmail({
    subject: `🎉 New Signup: ${name} (${user.email})`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f0f1a;padding:32px;border-radius:12px;color:#e5e7eb">
        <h2 style="color:#818cf8;margin:0 0 16px">New Signup — SRP AI Labs</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#9ca3af">Name</td><td style="padding:8px 0;color:#f9fafb"><b>${name}</b></td></tr>
          <tr><td style="padding:8px 0;color:#9ca3af">Email</td><td style="padding:8px 0;color:#f9fafb">${user.email}</td></tr>
          <tr><td style="padding:8px 0;color:#9ca3af">Provider</td><td style="padding:8px 0;color:#f9fafb">${user.provider}</td></tr>
          <tr><td style="padding:8px 0;color:#9ca3af">Time</td><td style="padding:8px 0;color:#f9fafb">${now}</td></tr>
        </table>
        <p style="margin-top:24px;font-size:12px;color:#6b7280">SRP AI Labs — Auto Alert System</p>
      </div>`,
  })
}

export async function notifyLogin(user: {
  name: string | null; email: string
}): Promise<void> {
  await sendTelegram(
    `🔑 <b>User Login</b>\n👤 ${user.name ?? user.email}\n📧 ${user.email}`
  )
}

export async function notifyError(ctx: {
  message: string; userId?: string | null; email?: string | null
  severity?: string; stack?: string
}): Promise<void> {
  const emoji = ctx.severity === 'critical' ? '🚨' : '⚠️'
  await sendTelegram(
    `${emoji} <b>Error Alert — SRP AI Labs</b>\n\n` +
    `<b>Message:</b> ${ctx.message}\n` +
    (ctx.email ? `<b>User:</b> ${ctx.email}\n` : '') +
    `<b>Severity:</b> ${ctx.severity ?? 'error'}\n` +
    `<b>Time:</b> ${new Date().toISOString()}`
  )
  await sendEmail({
    subject: `${emoji} Error: ${ctx.message}`,
    html: `<pre style="font-family:monospace;background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px">${JSON.stringify(ctx, null, 2)}</pre>`,
  })
}

export async function notifySubscriptionChange(user: {
  email: string; name: string | null
}, prev: string, next: string): Promise<void> {
  const msg = next === 'cancelled'
    ? `❌ Subscription CANCELLED by ${user.email} (was ${prev})`
    : `💳 Subscription changed: ${prev} → ${next} for ${user.email}`
  await sendTelegram(msg)
  await sendEmail({
    subject: `💳 Subscription change: ${user.email}`,
    html: `<p>${msg}<br>Time: ${new Date().toISOString()}</p>`,
  })
}

export async function notifyTrialExpiring(user: {
  email: string; name: string | null; daysLeft: number
}): Promise<void> {
  await sendTelegram(
    `⏰ <b>Trial Expiring Soon</b>\n📧 ${user.email}\n🕒 ${user.daysLeft} days left`
  )
  await sendEmail({
    to: user.email,
    subject: `⏰ Your SRP AI Labs trial expires in ${user.daysLeft} days`,
    html: `
      <div style="font-family:sans-serif;max-width:560px">
        <h2>Your trial is ending soon</h2>
        <p>Hi ${user.name ?? 'there'},</p>
        <p>Your SRP AI Labs Pro trial expires in <b>${user.daysLeft} days</b>. Upgrade now to keep access.</p>
        <a href="https://recruit.srpailabs.com/billing" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Upgrade Now</a>
      </div>`,
  })
}
