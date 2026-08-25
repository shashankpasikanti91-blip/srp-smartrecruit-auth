/**
 * One-shot migration runner for RC release checks.
 * Usage: node --env-file=.env.local scripts/run-migrations.mjs
 */
import pg from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const FILES = [
  'migrate_v0_schema_migrations.sql',
  'migrate_v14_candidate_documents.sql',
  'migrate_v15_workflow.sql',
  'migrate_v16_ess_lite.sql',
  'migrate_v17_submission_history.sql',
  'migrate_v18_offer_history.sql',
  'migrate_v19_ess_full.sql',
  'migrate_v20_governance.sql',
  'migrate_v21_ess_approval_audit.sql',
  'migrate_v22_recruitment_os.sql',
  'migrate_v23_phase2_os.sql',
  'migrate_v24_job_candidate_parse.sql',
  'migrate_v25_phase25_production.sql',
  'migrate_v26_phase3_intelligence.sql',
  'migrate_v27_perf_indexes.sql',
  'migrate_v28_entity_notes.sql',
  'migrate_v29_lifecycle.sql',
  'migrate_v30_bulk_queue.sql',
  'migrate_v31_enterprise.sql',
  'migrate_v32_platform.sql',
  'migrate_v33_security.sql',
  'migrate_v34_jd_original.sql',
  'migrate_v35_job_posts_enriched.sql',
  'migrate_v36_rag_graph.sql',
  'migrate_v37_audit_ai.sql',
  'migrate_v38_bulk_stale.sql',
]

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL missing')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: url, ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined })
const client = await pool.connect()
const applied = []
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  for (const file of FILES) {
    const version = file.replace('.sql', '')
    const { rows } = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [version])
    if (rows[0]) continue
    const sqlPath = join(process.cwd(), 'db', file)
    let sql
    try {
      sql = readFileSync(sqlPath, 'utf8')
    } catch {
      console.warn('skip missing', file)
      continue
    }
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [version])
      await client.query('COMMIT')
      applied.push(version)
      console.log('applied', version)
    } catch (e) {
      await client.query('ROLLBACK')
      console.error('FAILED', version, e.message)
      throw e
    }
  }
  console.log('Done. Newly applied:', applied.length ? applied.join(', ') : '(none)')
} finally {
  client.release()
  await pool.end()
}
