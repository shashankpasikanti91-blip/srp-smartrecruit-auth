import { NextResponse } from 'next/server'
import { collectPlatformHealth } from '@/lib/platformHealth'

export async function GET() {
  const health = await collectPlatformHealth()
  // Public payload: structured probes only — no secrets or raw errors.
  return NextResponse.json({
    ok: health.ok,
    ts: health.ts,
    responseMs: health.responseMs,
    application: health.application,
    database: health.database,
    db: health.database, // backward-compatible alias
    ai: health.ai,
    storage: health.storage,
    email: health.email,
    queues: health.queues,
    rag: health.rag,
  })
}
