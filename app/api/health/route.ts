import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  let db: { ok: boolean; user_count?: number; users?: object[]; error?: string } = { ok: false }
  try {
    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS n FROM auth_users')
    const { rows: users } = await pool.query(
      `SELECT email, is_active, (password_hash IS NOT NULL) AS has_hash,
              LEFT(password_hash, 10) AS hash_prefix
       FROM auth_users
       WHERE email IN ('demo@srpailabs.com','pasikantishashank24@gmail.com','hareesh4u22@gmail.com','priyapasikanti0@gmail.com')
       ORDER BY email`
    )
    db = { ok: true, user_count: countRows[0].n, users }
  } catch (e) {
    db = { ok: false, error: (e as Error).message.slice(0, 120) }
  }
  return NextResponse.json({ ok: true, ts: Date.now(), db })
}
