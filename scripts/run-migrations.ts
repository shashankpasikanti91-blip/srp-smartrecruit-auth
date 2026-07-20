/**
 * Run pending SQL migrations. Usage: npx tsx scripts/run-migrations.ts
 */
import { readFileSync } from 'fs'
import path from 'path'
import pg from 'pg'

const MIGRATIONS = [
  'migrate_v0_schema_migrations.sql',
  'migrate_v14_candidate_documents.sql',
  'migrate_v15_workflow.sql',
  'migrate_v16_ess_lite.sql',
  'migrate_v17_submission_history.sql',
  'migrate_v18_offer_history.sql',
  'migrate_v19_ess_full.sql',
  'migrate_v20_governance.sql',
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }
  const pool = new pg.Pool({ connectionString: url })
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    for (const file of MIGRATIONS) {
      const version = file.replace('.sql', '')
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      )
      if (rows.length) {
        console.log('SKIP', version)
        continue
      }
      const sqlPath = path.join(__dirname, '..', 'db', file)
      const sql = readFileSync(sqlPath, 'utf8')
      console.log('APPLY', version)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        )
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    }
    console.log('Done.')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
