import { pool } from './db'
import {
  saveCandidateDocumentFile,
  mimeForExt,
  extFromFilename,
  SLOT_LABELS,
} from './documentStorage'

/** Sync resume file into candidate_documents resume slot + document_versions. */
export async function syncResumeToDocumentSlot(opts: {
  tenantId: string
  resumeId: string
  shortId: string
  userId: string
  storagePath: string
  fileName: string
  fileSize: number
  file: File
}): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let docRow = await client.query<{ id: string }>(
      `SELECT id FROM candidate_documents
       WHERE tenant_id = $1 AND resume_id = $2 AND slot_type = 'resume' LIMIT 1`,
      [opts.tenantId, opts.resumeId]
    )

    let documentId: string
    if (!docRow.rows[0]) {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO candidate_documents (tenant_id, resume_id, slot_type, label)
         VALUES ($1,$2,'resume',$3) RETURNING id`,
        [opts.tenantId, opts.resumeId, SLOT_LABELS.resume]
      )
      documentId = ins.rows[0].id
    } else {
      documentId = docRow.rows[0].id
    }

    const verRes = await client.query<{ max: number | null }>(
      'SELECT MAX(version_no) AS max FROM document_versions WHERE document_id = $1',
      [documentId]
    )
    const versionNo = (verRes.rows[0]?.max ?? 0) + 1
    const ext = extFromFilename(opts.fileName)
    const { relative } = await saveCandidateDocumentFile(
      opts.tenantId, opts.resumeId, documentId, versionNo, opts.file
    )

    await client.query(
      `INSERT INTO document_versions
         (document_id, tenant_id, version_no, storage_path, file_name, mime_type, file_size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        documentId, opts.tenantId, versionNo, relative, opts.fileName.slice(0, 255),
        mimeForExt(ext), opts.fileSize, opts.userId,
      ]
    )

    await client.query(
      'UPDATE candidate_documents SET updated_at = NOW() WHERE id = $1',
      [documentId]
    )

    await client.query(
      `UPDATE resumes SET resume_original_path = $1, file_name = $2, file_size_bytes = $3, updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [relative, opts.fileName.slice(0, 255), opts.fileSize, opts.resumeId, opts.tenantId]
    )

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
