import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAIStatus } from '@/lib/aiClient'

export async function GET() {
  let db: { ok: boolean; error?: string } = { ok: false }
  try {
    await pool.query('SELECT 1')
    db = { ok: true }
  } catch (e) {
    db = { ok: false, error: 'DB unavailable' }
  }
  return NextResponse.json({ ok: true, ts: Date.now(), db, ai: getAIStatus() })
}
