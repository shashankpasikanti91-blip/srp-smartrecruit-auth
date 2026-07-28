/**
 * Shared platform health probes for /api/health and owner Status dashboard.
 * Never include secrets, connection strings, or raw error messages in public payloads.
 */
import { access, constants, mkdir } from 'fs/promises'
import path from 'path'
import { pool } from '@/lib/db'
import { getAIStatus } from '@/lib/aiClient'
import { documentsRoot, legacyResumesRoot } from '@/lib/documentStorage'

const startedAt = Date.now()

export type ProbeResult = { ok: boolean; detail?: string }

export type QueueHealth = {
  ok: boolean
  running: number
  pending: number
  failedJobs: number
  failedItems: number
}

export type PlatformHealthSnapshot = {
  ok: boolean
  ts: number
  responseMs: number
  application: {
    ok: boolean
    version: string
    env: string
    uptimeSec: number
  }
  database: ProbeResult
  ai: { ok: boolean; configured: boolean; provider?: string; model?: string }
  storage: ProbeResult
  email: ProbeResult
  queues: QueueHealth
}

function appVersion(): string {
  return process.env.npm_package_version || '1.0.0'
}

export function isSmtpConfigured(): boolean {
  const user = process.env.SMTP_USER ?? ''
  const pass = (process.env.SMTP_PASS ?? process.env.SMTP_Pass ?? '').replace(/\s+/g, '')
  return Boolean(user && pass)
}

async function checkStorage(): Promise<ProbeResult> {
  try {
    const roots = [
      path.join(process.cwd(), 'uploads'),
      documentsRoot(),
      legacyResumesRoot(),
    ]
    for (const root of roots) {
      await mkdir(root, { recursive: true })
      await access(root, constants.R_OK | constants.W_OK)
    }
    return { ok: true }
  } catch {
    return { ok: false, detail: 'Storage unavailable' }
  }
}

async function checkDatabase(): Promise<ProbeResult & { inRecovery?: boolean }> {
  try {
    const res = await pool.query<{ recovery: boolean }>(
      'SELECT pg_is_in_recovery() AS recovery'
    )
    return { ok: true, inRecovery: !!res.rows[0]?.recovery }
  } catch {
    try {
      await pool.query('SELECT 1')
      return { ok: true }
    } catch {
      return { ok: false, detail: 'DB unavailable' }
    }
  }
}

async function checkQueues(): Promise<QueueHealth> {
  const empty: QueueHealth = {
    ok: true,
    running: 0,
    pending: 0,
    failedJobs: 0,
    failedItems: 0,
  }
  try {
    const [jobs, items] = await Promise.all([
      pool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count
         FROM bulk_screening_jobs
         GROUP BY status`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM bulk_screening_items
         WHERE status = 'failed'`
      ),
    ])
    const byStatus: Record<string, number> = {}
    for (const row of jobs.rows) {
      byStatus[row.status] = parseInt(row.count, 10) || 0
    }
    const running = byStatus.running ?? 0
    const pending = byStatus.pending ?? 0
    const failedJobs = byStatus.failed ?? 0
    const failedItems = parseInt(items.rows[0]?.count ?? '0', 10) || 0
    return {
      ok: true,
      running,
      pending,
      failedJobs,
      failedItems,
    }
  } catch {
    // Table may not exist yet on older DBs — report soft failure without crashing health
    return { ...empty, ok: false }
  }
}

export async function collectPlatformHealth(): Promise<PlatformHealthSnapshot> {
  const t0 = Date.now()
  const [database, storage, queues] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkQueues(),
  ])

  const aiRaw = getAIStatus()
  const ai = {
    ok: aiRaw.configured,
    configured: aiRaw.configured,
    ...(aiRaw.configured
      ? { provider: aiRaw.provider, model: aiRaw.model }
      : {}),
  }

  const emailConfigured = isSmtpConfigured()
  const email: ProbeResult = emailConfigured
    ? { ok: true }
    : { ok: false, detail: 'SMTP not configured' }

  const application = {
    ok: true,
    version: appVersion(),
    env: process.env.NODE_ENV ?? 'development',
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  }

  const ok =
    database.ok &&
    storage.ok &&
    application.ok

  return {
    ok,
    ts: Date.now(),
    responseMs: Date.now() - t0,
    application,
    database: { ok: database.ok, ...(database.ok ? {} : { detail: database.detail }) },
    ai,
    storage: { ok: storage.ok, ...(storage.ok ? {} : { detail: storage.detail }) },
    email,
    queues,
  }
}
