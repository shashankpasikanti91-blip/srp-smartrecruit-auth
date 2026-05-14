import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  let db: { ok: boolean; user_count?: number; error?: string } = { ok: false }
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM auth_users')
    db = { ok: true, user_count: rows[0].n }
  } catch (e) {
    db = { ok: false, error: (e as Error).message.slice(0, 120) }
  }
  return NextResponse.json({ ok: true, ts: Date.now(), db })
}
