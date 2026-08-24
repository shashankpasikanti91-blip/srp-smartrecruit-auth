/**
 * Local smoke: migrate check + optional index/retrieve against DATABASE_URL.
 * Usage: npx tsx scripts/smoke-rag.ts
 */
import pg from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }
  const pool = new pg.Pool({ connectionString: url })
  try {
    const ext = await pool.query(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`,
    )
    const tables = await pool.query(
      `SELECT to_regclass('public.rag_chunks') AS rag,
              to_regclass('public.talent_edges') AS edges`,
    )
    const tenants = await pool.query(`SELECT COUNT(*)::int AS n FROM tenants`)
    const resumes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM resumes WHERE COALESCE(raw_text, '') <> ''`,
    )
    console.log(
      JSON.stringify(
        {
          vector: ext.rows.map(r => r.extname),
          tables: tables.rows[0],
          tenants: tenants.rows[0].n,
          resumes_with_text: resumes.rows[0].n,
        },
        null,
        2,
      ),
    )

    if (!ext.rows.length || !tables.rows[0].rag) {
      console.error('FAIL: vector extension or rag_chunks missing — run migrations')
      process.exit(2)
    }

    // Optional: index one resume + retrieve if AI key present
    const hasKey = Boolean(
      (process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || '').trim(),
    )
    if (!hasKey) {
      console.log('SKIP index/retrieve — no OPENAI/OPENROUTER key')
      return
    }

    const { rows: tenantRows } = await pool.query<{ id: string }>(
      `SELECT id FROM tenants ORDER BY created_at NULLS LAST LIMIT 1`,
    )
    const { rows: resumeRows } = await pool.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM resumes
       WHERE tenant_id = $1 AND COALESCE(raw_text, '') <> ''
       ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [tenantRows[0]?.id],
    )
    if (!tenantRows[0] || !resumeRows[0]) {
      console.log('SKIP index — no tenant/resume text')
      return
    }
    const userId =
      resumeRows[0].user_id ||
      (
        await pool.query<{ id: string }>(
          `SELECT id FROM auth_users ORDER BY created_at NULLS LAST LIMIT 1`,
        )
      ).rows[0]?.id
    if (!userId) {
      console.log('SKIP index — no auth user id for usage logging')
      return
    }

    const { indexResumeCorpus } = await import('../lib/rag/indexCorpus')
    const { retrieveChunks } = await import('../lib/rag/retrieve')
    const indexed = await indexResumeCorpus({
      tenantId: tenantRows[0].id,
      resumeId: resumeRows[0].id,
      userId,
    })
    console.log('indexed', indexed)
    const chunks = await retrieveChunks({
      tenantId: tenantRows[0].id,
      query: 'skills experience',
      topK: 3,
      userId,
    })
    console.log(
      'retrieve',
      chunks.map(c => ({
        source: c.source_type,
        id: c.source_id.slice(0, 8),
        sim: c.score,
        preview: c.content.slice(0, 80),
      })),
    )
    console.log('SMOKE_OK')
  } finally {
    await pool.end()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
