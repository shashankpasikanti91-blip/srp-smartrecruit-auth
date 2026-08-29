/**
 * Offline RAG evaluation helpers (no live LLM / DB required).
 * Run: npx tsx scripts/eval-rag.ts
 */
import assert from 'node:assert/strict'
import type { RetrievedChunk } from '../lib/rag/retrieve'

function filterByPermissionFlags(
  chunks: RetrievedChunk[],
  allowResumes: boolean,
  allowJobs: boolean,
): RetrievedChunk[] {
  return chunks.filter(c => {
    if (c.source_type === 'resume' && !allowResumes) return false
    if (c.source_type === 'job' && !allowJobs) return false
    return true
  })
}

function groundednessScore(answer: string, chunks: RetrievedChunk[]): number {
  const text = answer.toLowerCase()
  if (!chunks.length) return 0
  let hits = 0
  for (const c of chunks) {
    const tokens = c.content.toLowerCase().split(/\W+/).filter(t => t.length > 4).slice(0, 12)
    if (tokens.some(t => text.includes(t))) hits++
  }
  return hits / chunks.length
}

function citationCount(answer: string): number {
  return (answer.match(/\[(?:resume|job|source)[^\]]*\]/gi) ?? []).length
}

function main() {
  const fixtures: RetrievedChunk[] = [
    {
      id: '1',
      source_type: 'resume',
      source_id: '11111111-1111-4111-8111-111111111111',
      chunk_index: 0,
      content: 'Senior Java engineer with Spring Boot and PostgreSQL experience in Singapore.',
      score: 0.91,
    },
    {
      id: '2',
      source_type: 'job',
      source_id: '22222222-2222-4222-8222-222222222222',
      chunk_index: 0,
      content: 'Looking for Java backend developers familiar with Spring and cloud deployments.',
      score: 0.88,
    },
  ]

  const answer =
    'The candidate is a Senior Java engineer with Spring Boot experience [resume]. The job seeks Java backend developers [job].'
  const g = groundednessScore(answer, fixtures)
  const cites = citationCount(answer)
  assert.ok(g >= 0.5, `expected groundedness >= 0.5, got ${g}`)
  assert.ok(cites >= 1, `expected citations >= 1, got ${cites}`)

  const deniedResumes = filterByPermissionFlags(fixtures, false, true)
  assert.equal(deniedResumes.length, 1)
  assert.equal(deniedResumes[0].source_type, 'job')

  const deniedJobs = filterByPermissionFlags(fixtures, true, false)
  assert.equal(deniedJobs.every(c => c.source_type === 'resume'), true)

  assert.equal(groundednessScore('', []), 0)

  console.log(JSON.stringify({
    ok: true,
    groundedness: Number(g.toFixed(3)),
    citations: cites,
    acl_resume_denied_remaining: deniedResumes.length,
    note: 'Fixture eval only — run smoke-rag.ts against live pgvector for retrieval quality. Production RAG requires pgvector extension.',
  }, null, 2))
}

main()
