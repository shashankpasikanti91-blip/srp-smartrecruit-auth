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
      from: `"SRP SmartRecruit" <${SMTP_USER}>`,
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

// ─── Welcome Email to New Users ──────────────────────────────────────────────

export async function sendWelcomeEmail(user: {
  name: string | null; email: string; provider: string
}): Promise<void> {
  const name = user.name ?? 'there'
  const loginMethod = user.provider === 'google' ? 'Google Sign-In' : 'Email & Password'

  await sendEmail({
    to: user.email,
    subject: '🎉 Welcome to SRP SmartRecruit — Your AI Recruitment Platform',
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">

    <!-- Logo Header -->
    <div style="text-align:center;margin-bottom:32px">
      <div style="display:inline-block;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#9333ea);text-align:center;line-height:52px">
        <span style="color:#fff;font-size:22px;font-weight:bold">⚡</span>
      </div>
      <h1 style="color:#fff;font-size:22px;margin:16px 0 4px;font-weight:700">SRP SmartRecruit</h1>
      <p style="color:#6b7280;font-size:13px;margin:0">AI-Powered Recruitment Platform</p>
    </div>

    <!-- Welcome Card -->
    <div style="background:#111118;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:36px;text-align:center">
      <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(147,51,234,0.2));margin:0 auto 20px;text-align:center;line-height:64px;border:1px solid rgba(99,102,241,0.2)">
        <span style="font-size:28px">🎉</span>
      </div>
      <h2 style="color:#f9fafb;font-size:20px;margin:0 0 8px;font-weight:700">Welcome, ${name}!</h2>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;line-height:1.6">
        Congratulations! Your SRP SmartRecruit account is ready. You now have access to our AI-powered recruitment tools to streamline your hiring process.
      </p>

      <a href="https://recruit.srpailabs.com/dashboard" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none;box-shadow:0 4px 16px rgba(99,102,241,0.3)">
        Go to Dashboard →
      </a>
    </div>

    <!-- Features Grid -->
    <div style="margin-top:24px;background:#111118;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px">
      <h3 style="color:#e5e7eb;font-size:14px;font-weight:600;margin:0 0 20px;text-align:center;text-transform:uppercase;letter-spacing:0.5px">What You Can Do</h3>

      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:12px 16px;vertical-align:top;width:50%">
            <div style="text-align:center">
              <div style="font-size:24px;margin-bottom:8px">🤖</div>
              <p style="color:#f9fafb;font-size:13px;font-weight:600;margin:0 0 4px">AI Screening</p>
              <p style="color:#6b7280;font-size:11px;margin:0;line-height:1.4">Score candidates against job descriptions with AI</p>
            </div>
          </td>
          <td style="padding:12px 16px;vertical-align:top;width:50%">
            <div style="text-align:center">
              <div style="font-size:24px;margin-bottom:8px">📝</div>
              <p style="color:#f9fafb;font-size:13px;font-weight:600;margin:0 0 4px">Job Post Generator</p>
              <p style="color:#6b7280;font-size:11px;margin:0;line-height:1.4">Generate posts for LinkedIn, Indeed, WhatsApp & more</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;vertical-align:top">
            <div style="text-align:center">
              <div style="font-size:24px;margin-bottom:8px">✉️</div>
              <p style="color:#f9fafb;font-size:13px;font-weight:600;margin:0 0 4px">AI Compose</p>
              <p style="color:#6b7280;font-size:11px;margin:0;line-height:1.4">Write professional emails, replies & messages</p>
            </div>
          </td>
          <td style="padding:12px 16px;vertical-align:top">
            <div style="text-align:center">
              <div style="font-size:24px;margin-bottom:8px">📊</div>
              <p style="color:#f9fafb;font-size:13px;font-weight:600;margin:0 0 4px">Pipeline Kanban</p>
              <p style="color:#6b7280;font-size:11px;margin:0;line-height:1.4">Track candidates through your hiring stages</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Account Info -->
    <div style="margin-top:24px;background:#111118;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px">
      <h3 style="color:#e5e7eb;font-size:13px;font-weight:600;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.5px">Your Account</h3>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;width:110px">Email</td>
          <td style="padding:8px 0;color:#f9fafb;font-size:13px;font-weight:500">${user.email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px">Sign-in</td>
          <td style="padding:8px 0;color:#f9fafb;font-size:13px;font-weight:500">${loginMethod}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px">Plan</td>
          <td style="padding:8px 0">
            <span style="display:inline-block;padding:3px 10px;background:rgba(99,102,241,0.15);color:#818cf8;font-size:11px;font-weight:600;border-radius:6px;text-transform:uppercase">Free</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px">Includes</td>
          <td style="padding:8px 0;color:#9ca3af;font-size:12px">20 AI screens/mo &bull; 5 job posts &bull; AI compose</td>
        </tr>
      </table>
    </div>

    <!-- Upgrade CTA -->
    <div style="margin-top:24px;background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(147,51,234,0.1));border:1px solid rgba(99,102,241,0.15);border-radius:16px;padding:24px;text-align:center">
      <p style="color:#c4b5fd;font-size:13px;margin:0 0 12px;font-weight:500">
        ✨ Need unlimited AI screenings & job posts?
      </p>
      <a href="mailto:pasikantishashank24@gmail.com?subject=Upgrade%20to%20Pro%20-%20SRP%20SmartRecruit" style="display:inline-block;padding:10px 24px;background:rgba(99,102,241,0.2);color:#a5b4fc;font-size:12px;font-weight:600;border-radius:8px;text-decoration:none;border:1px solid rgba(99,102,241,0.3)">
        Contact Us to Upgrade →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.05)">
      <p style="color:#4b5563;font-size:11px;margin:0 0 8px">
        SRP AI Labs &bull; AI-Powered Recruitment Platform
      </p>
      <p style="margin:0">
        <a href="https://recruit.srpailabs.com" style="color:#6366f1;font-size:11px;text-decoration:none">recruit.srpailabs.com</a>
      </p>
      <p style="color:#374151;font-size:10px;margin:12px 0 0">
        You're receiving this because you created an account on SRP SmartRecruit.
      </p>
    </div>

  </div>
</body>
</html>`
  })
}
