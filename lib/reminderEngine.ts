import { pool } from './db'
import { ensureAutoFollowUp, scheduleJoiningFollowUps } from './autoFollowUps'
import { createNotification } from './notificationCenter'

export { ensureAutoFollowUp, scheduleJoiningFollowUps }

const DEFAULT_RULES = [
  { rule_key: 'interview_1d', label: 'Interview — 1 day before', entity_type: 'interview', offset_minutes: -1440 },
  { rule_key: 'interview_2h', label: 'Interview — 2 hours before', entity_type: 'interview', offset_minutes: -120 },
  { rule_key: 'interview_30m', label: 'Interview — 30 minutes before', entity_type: 'interview', offset_minutes: -30 },
  { rule_key: 'joining_7d', label: 'Joining — 7 days before', entity_type: 'offer', offset_minutes: -10080 },
  { rule_key: 'joining_3d', label: 'Joining — 3 days before', entity_type: 'offer', offset_minutes: -4320 },
  { rule_key: 'joining_1d', label: 'Joining — 1 day before', entity_type: 'offer', offset_minutes: -1440 },
  { rule_key: 'joining_day', label: 'Joining day', entity_type: 'offer', offset_minutes: 0 },
  { rule_key: 'docs_missing', label: 'Missing documents', entity_type: 'document', offset_minutes: 0 },
  { rule_key: 'visa_expiry_30d', label: 'Visa expiry — 30 days', entity_type: 'candidate', offset_minutes: -43200 },
  { rule_key: 'passport_expiry_30d', label: 'Passport expiry — 30 days', entity_type: 'candidate', offset_minutes: -43200 },
] as const

/** Ensure tenant has default reminder rules. */
export async function ensureDefaultReminderRules(tenantId: string): Promise<void> {
  for (const r of DEFAULT_RULES) {
    try {
      await pool.query(
        `INSERT INTO reminder_rules (tenant_id, rule_key, label, entity_type, offset_minutes, channel)
         VALUES ($1,$2,$3,$4,$5,'in_app')
         ON CONFLICT (tenant_id, rule_key) DO NOTHING`,
        [tenantId, r.rule_key, r.label, r.entity_type, r.offset_minutes]
      )
    } catch {
      /* table may not exist yet */
    }
  }
}

export async function listReminderRules(tenantId: string) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reminder_rules WHERE tenant_id = $1 ORDER BY entity_type, offset_minutes`,
      [tenantId]
    )
    if (rows.length === 0) {
      await ensureDefaultReminderRules(tenantId)
      const retry = await pool.query(
        `SELECT * FROM reminder_rules WHERE tenant_id = $1 ORDER BY entity_type, offset_minutes`,
        [tenantId]
      )
      return retry.rows
    }
    return rows
  } catch {
    return [...DEFAULT_RULES].map(r => ({ ...r, is_active: true, tenant_id: tenantId }))
  }
}

/** Schedule interview reminders at 1d / 2h / 30m before. */
export async function scheduleInterviewReminders(opts: {
  tenantId: string
  userId: string
  resumeId: string
  interviewId: string
  scheduledAt: string | Date
  candidateName?: string
}) {
  const at = new Date(opts.scheduledAt)
  if (Number.isNaN(at.getTime())) return
  const name = opts.candidateName || 'Candidate'
  const offsets: { mins: number; source: string; label: string }[] = [
    { mins: 1440, source: 'interview_1d', label: `Interview in 1 day — ${name}` },
    { mins: 120, source: 'interview_2h', label: `Interview in 2 hours — ${name}` },
    { mins: 30, source: 'interview_30m', label: `Interview in 30 minutes — ${name}` },
  ]
  for (const o of offsets) {
    const due = new Date(at.getTime() - o.mins * 60_000)
    if (due.getTime() < Date.now() - 60_000) continue
    await ensureAutoFollowUp({
      tenantId: opts.tenantId,
      userId: opts.userId,
      resumeId: opts.resumeId,
      interviewId: opts.interviewId,
      title: o.label,
      dueAt: due,
      source: o.source,
      channel: 'other',
      notes: 'Auto interview reminder',
    })
  }
}

/** Expanded joining reminders: 7d / 3d / 1d / day-of. */
export async function scheduleFullJoiningReminders(opts: {
  tenantId: string
  userId: string
  resumeId: string
  offerCaseId: string
  joiningDate: string
  candidateName?: string
}) {
  const join = new Date(opts.joiningDate)
  if (Number.isNaN(join.getTime())) return
  const name = opts.candidateName || 'Candidate'
  const offsets: { days: number; source: string; title: string }[] = [
    { days: 7, source: 'joining_7d', title: `Joining in 7 days — ${name}` },
    { days: 3, source: 'joining_3d', title: `Joining in 3 days — ${name}` },
    { days: 1, source: 'joining_1d', title: `Joining tomorrow — ${name}` },
    { days: 0, source: 'joining_day', title: `Joining today — ${name}` },
  ]
  for (const o of offsets) {
    const due = new Date(join)
    due.setDate(due.getDate() - o.days)
    await ensureAutoFollowUp({
      ...opts,
      title: o.title,
      dueAt: due,
      source: o.source,
      notes: `Auto joining reminder (${o.days}d)`,
    })
  }
}

/**
 * Sweep: create visa/passport expiry + missing-doc reminders from tenant data.
 * Call from cron or on dashboard load (throttled by caller).
 */
export async function runReminderSweep(opts: {
  tenantId: string
  userId: string
}): Promise<{ created: number }> {
  let created = 0
  const now = Date.now()
  const in30 = new Date(now + 30 * 86400000)

  try {
    const { rows } = await pool.query<{
      id: string
      candidate_name: string | null
      visa_expiry: string | null
      user_id: string
    }>(
      `SELECT id, candidate_name,
              candidate_profile->>'visa_expiry' AS visa_expiry,
              user_id
       FROM resumes
       WHERE tenant_id = $1
         AND candidate_profile->>'visa_expiry' IS NOT NULL
         AND candidate_profile->>'visa_expiry' <> ''
       LIMIT 200`,
      [opts.tenantId]
    )
    for (const r of rows) {
      const exp = new Date(r.visa_expiry!)
      if (Number.isNaN(exp.getTime())) continue
      if (exp <= in30 && exp >= new Date(now - 86400000)) {
        await ensureAutoFollowUp({
          tenantId: opts.tenantId,
          userId: r.user_id || opts.userId,
          resumeId: r.id,
          title: `Visa expiring — ${r.candidate_name || 'Candidate'}`,
          dueAt: exp,
          source: 'visa_expiry_30d',
          notes: `Visa expiry ${r.visa_expiry}`,
        })
        await createNotification({
          tenantId: opts.tenantId,
          userId: r.user_id || opts.userId,
          category: 'visa',
          title: `Visa expiring soon`,
          body: `${r.candidate_name || 'Candidate'} — ${r.visa_expiry}`,
          resumeId: r.id,
          entityType: 'candidate',
          entityId: r.id,
        })
        created++
      }
    }
  } catch (e) {
    console.warn('[reminderSweep visa]', e instanceof Error ? e.message : e)
  }

  try {
    const { rows } = await pool.query<{
      id: string
      candidate_name: string | null
      user_id: string
      missing: number
    }>(
      `SELECT r.id, r.candidate_name, r.user_id,
              (SELECT COUNT(*)::int FROM offer_cases o
               WHERE o.resume_id = r.id AND o.status IN ('document_collection','document_verification','selected'))
               AS missing
       FROM resumes r
       WHERE r.tenant_id = $1
       LIMIT 100`,
      [opts.tenantId]
    )
    for (const r of rows) {
      if ((r.missing ?? 0) > 0) {
        await ensureAutoFollowUp({
          tenantId: opts.tenantId,
          userId: r.user_id || opts.userId,
          resumeId: r.id,
          title: `Missing documents — ${r.candidate_name || 'Candidate'}`,
          dueAt: new Date(),
          source: 'docs_missing',
          notes: 'Candidate in document collection — check Document Center',
        })
        created++
      }
    }
  } catch (e) {
    console.warn('[reminderSweep docs]', e instanceof Error ? e.message : e)
  }

  return { created }
}
