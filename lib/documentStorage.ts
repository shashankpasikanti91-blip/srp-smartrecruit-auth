import { mkdir, writeFile, readFile } from 'fs/promises'
import path from 'path'

export const DOCUMENT_SLOTS = [
  'resume',
  'passport',
  'visa',
  'certificate',
  'offer_letter',
  'experience_letter',
  'other',
] as const

export type DocumentSlot = (typeof DOCUMENT_SLOTS)[number]

export const SLOT_LABELS: Record<DocumentSlot, string> = {
  resume: 'Resume / CV',
  passport: 'Passport',
  visa: 'Visa / Work Permit',
  certificate: 'Certificates',
  offer_letter: 'Offer Letter',
  experience_letter: 'Experience Letter',
  other: 'Other',
}

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png'])
const MAX_BYTES = 15 * 1024 * 1024

export function documentsRoot() {
  return path.join(process.cwd(), 'uploads', 'candidate-documents')
}

export function extFromFilename(name: string): string {
  const lower = (name || '').toLowerCase()
  for (const e of ALLOWED_EXT) {
    if (lower.endsWith(e)) return e
  }
  return ''
}

export function mimeForExt(ext: string): string {
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === '.doc') return 'application/msword'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  return 'text/plain; charset=utf-8'
}

export function validateUpload(file: { name: string; size: number }) {
  if (file.size > MAX_BYTES) return 'File too large (max 15 MB)'
  if (!extFromFilename(file.name)) return 'Unsupported type — use PDF, DOCX, DOC, TXT, JPG, or PNG'
  return null
}

export async function saveCandidateDocumentFile(
  tenantId: string,
  resumeId: string,
  documentId: string,
  versionNo: number,
  file: File
): Promise<{ relative: string; ext: string }> {
  const ext = extFromFilename(file.name)
  const relative = path.join(tenantId, resumeId, `${documentId}_v${versionNo}${ext}`)
  const absDir = path.join(documentsRoot(), tenantId, resumeId)
  const absFile = path.join(documentsRoot(), relative)
  await mkdir(absDir, { recursive: true })
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(absFile, buf)
  return { relative, ext }
}

export async function readStoredFile(relative: string): Promise<Buffer> {
  const normalized = path.normalize(relative)
  if (normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new Error('Invalid storage path')
  }
  const absFile = path.join(documentsRoot(), normalized)
  const root = documentsRoot()
  if (!absFile.startsWith(root)) throw new Error('Invalid storage path')
  return readFile(absFile)
}
