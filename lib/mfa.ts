/**
 * Minimal TOTP MFA helpers (no external dependency).
 * Algorithm: HMAC-SHA1, 30s window, 6 digits (RFC 6238).
 */
import crypto from 'crypto'
import { pool } from './db'

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31]
  return output
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = input.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const clean = String(token).replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  const key = base32Decode(secret)
  const timestep = Math.floor(Date.now() / 1000 / 30)
  for (let w = -window; w <= window; w++) {
    if (hotp(key, timestep + w) === clean) return true
  }
  return false
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

export function totpUri(secret: string, email: string, issuer = 'SRP SmartRecruit'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase().replace(/\s/g, '')).digest('hex')
}

export function generateRecoveryCodes(n = 8): string[] {
  return Array.from({ length: n }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-')
  )
}

export async function userHasMfa(userId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT mfa_enabled FROM auth_users WHERE id = $1`,
      [userId]
    )
    return Boolean(rows[0]?.mfa_enabled)
  } catch {
    return false
  }
}

export async function getEnabledTotpSecret(userId: string): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `SELECT secret_enc FROM mfa_devices
       WHERE user_id = $1 AND method = 'totp' AND is_enabled = TRUE
       ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    )
    return (rows[0]?.secret_enc as string) ?? null
  } catch {
    return null
  }
}

export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const hash = hashRecoveryCode(code)
  try {
    const { rowCount } = await pool.query(
      `UPDATE mfa_recovery_codes SET used_at = NOW()
       WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`,
      [userId, hash]
    )
    return (rowCount ?? 0) > 0
  } catch {
    return false
  }
}
