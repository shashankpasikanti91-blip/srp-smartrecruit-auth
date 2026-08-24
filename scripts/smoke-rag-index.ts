/**
 * One-off: insert sample resume on DATABASE_URL and exercise index + retrieve.
 */
import pg from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const url =
    process.env.SMOKE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://srp_ats:ats_dev_password@127.0.0.1:5436/srp_auth'
  process.env.DATABASE_URL = url

  const pool = new pg.Pool({ connectionString: url })
  try {
    const t = await pool.query(
      `SELECT id FROM tenants ORDER BY created_at NULLS LAST LIMIT 1`,
    )
    if (!t.rows[0]) throw new Error('no tenants')
    const tenantId = String(t.rows[0].id)

    const u = await pool.query(
      `SELECT id FROM auth_users ORDER BY created_at NULLS LAST LIMIT 1`,
    )
    if (!u.rows[0]) throw new Error('no auth_users')
    const userId = String(u.rows[0].id)

    const text = `Jane Doe is a senior TypeScript and React engineer with 8 years experience.
Skills: TypeScript, React, Node.js, PostgreSQL, pgvector, RAG systems.
Previously built recruitment AI copilots and internal talent matching.`

    const ins = await pool.query(
      `INSERT INTO resumes (tenant_id, user_id, candidate_name, raw_text, pipeline_stage)
       VALUES ($1, $2, $3, $4, 'sourced')
       RETURNING id`,
      [tenantId, userId, 'Smoke RAG Candidate', text],
    )
    const resumeId = String(ins.rows[0].id)
    console.log('resume', resumeId)

    const { indexResumeCorpus } = await import('../lib/rag/indexCorpus')
    const { retrieveChunks } = await import('../lib/rag/retrieve')
    const indexed = await indexResumeCorpus({
      tenantId,
      resumeId,
      userId,
      rawText: text,
    })
    console.log('indexed', indexed)
    const chunks = await retrieveChunks({
      tenantId,
      query: 'TypeScript React RAG engineer',
      topK: 3,
      userId,
    })
    console.log(
      'chunks',
      chunks.length,
      chunks.map(c => ({ sim: c.score, preview: c.content.slice(0, 60) })),
    )
    console.log(chunks.length ? 'SMOKE_OK' : 'SMOKE_EMPTY')
  } finally {
    await pool.end()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
