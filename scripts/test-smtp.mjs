import nodemailer from 'nodemailer'

const user = process.env.SMTP_USER || 'pasikantishashank24@gmail.com'
const passRaw = process.env.SMTP_PASS || ''
const pass = passRaw.replace(/\s+/g, '')
const host = process.env.SMTP_HOST || 'smtp.gmail.com'
const port = parseInt(process.env.SMTP_PORT || '587', 10)
const sendTo = process.env.SMTP_TEST_TO || user

console.log(JSON.stringify({ user, passLen: passRaw.length, strippedLen: pass.length, is16: pass.length === 16, host, port }))

if (!pass) {
  console.log('NO_PASS')
  process.exit(2)
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  tls: { rejectUnauthorized: false },
})

try {
  await transport.verify()
  console.log('VERIFY_OK')
  const info = await transport.sendMail({
    from: `"SRP SmartRecruit" <${user}>`,
    to: sendTo,
    subject: `SRP SMTP test — ${new Date().toISOString()}`,
    html: '<p>SMTP is working. Delivery test from SmartRecruit.</p>',
  })
  console.log('SENT_OK', info.messageId || 'ok')
} catch (e) {
  console.log('FAIL', String(e.message || e).slice(0, 300))
  process.exit(1)
}
