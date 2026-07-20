import { pool } from '@/lib/db'

/** Create an automatic follow-up if one with the same source+resume does not already exist pending. */
export async function ensureAutoFollowUp(opts: {
  tenantId: string
  userId: string
  resumeId?: string | null
  title: string
  dueAt: Date | string
  source: string
  channel?: string
  notes?: string
  submissionId?: string | null
  offerCaseId?: string | null
  interviewId?: string | null
}): Promise<void> {
  try {
    const due = typeof opts.dueAt === 'string' ? opts.dueAt : opts.dueAt.toISOString()
    const existing = await pool.query(
      `SELECT id FROM follow_ups
       WHERE tenant_id = $1 AND source = $2 AND status = 'pending'
         AND ($3::uuid IS NULL OR resume_id = $3)
         AND title = $4
       LIMIT 1`,
      [opts.tenantId, opts.source, opts.resumeId ?? null, opts.title],
    ).catch(async () => {
      // source column may not exist yet
      const r = await pool.query(
        `SELECT id FROM follow_ups
         WHERE tenant_id = $1 AND status = 'pending'
           AND ($2::uuid IS NULL OR resume_id = $2)
           AND title = $3
         LIMIT 1`,
        [opts.tenantId, opts.resumeId ?? null, opts.title],
      )
      return r
    })
    if (existing.rows[0]) return

    try {
      await pool.query(
        `INSERT INTO follow_ups
           (tenant_id, resume_id, submission_id, user_id, channel, title, notes, due_at, status, source, offer_case_id, interview_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,$11)`,
        [
          opts.tenantId,
          opts.resumeId ?? null,
          opts.submissionId ?? null,
          opts.userId,
          opts.channel ?? 'other',
          opts.title,
          opts.notes ?? null,
          due,
          opts.source,
          opts.offerCaseId ?? null,
          opts.interviewId ?? null,
        ],
      )
    } catch {
      await pool.query(
        `INSERT INTO follow_ups
           (tenant_id, resume_id, submission_id, user_id, channel, title, notes, due_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
        [
          opts.tenantId,
          opts.resumeId ?? null,
          opts.submissionId ?? null,
          opts.userId,
          opts.channel ?? 'other',
          opts.title,
          opts.notes ?? null,
          due,
        ],
      )
    }
  } catch (e) {
    console.warn('[autoFollowUp]', e instanceof Error ? e.message : e)
  }
}

/** Generate OS-style reminders from offer joining date. */
export async function scheduleJoiningFollowUps(opts: {
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
  const dayBefore = new Date(join)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const weekBefore = new Date(join)
  weekBefore.setDate(weekBefore.getDate() - 7)

  await ensureAutoFollowUp({
    ...opts,
    title: `Joining tomorrow — ${name}`,
    dueAt: dayBefore,
    source: 'joining_tomorrow',
    notes: 'Auto reminder: joining tomorrow',
  })
  await ensureAutoFollowUp({
    ...opts,
    title: `Joining next week — ${name}`,
    dueAt: weekBefore,
    source: 'joining_week',
    notes: 'Auto reminder: joining in 7 days',
  })
  await ensureAutoFollowUp({
    ...opts,
    title: `Joining follow-up — ${name}`,
    dueAt: join,
    source: 'joining_day',
    notes: 'Confirm joining / no-show check',
  })
}
