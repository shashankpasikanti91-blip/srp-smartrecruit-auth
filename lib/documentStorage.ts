import { mkdir, writeFile, readFile, access } from 'fs/promises'
import path from 'path'

/** Core + country-specific checklist slots accepted by Document Center. */
export const DOCUMENT_SLOTS = [
  'resume',
  'passport',
  'visa',
  'certificate',
  'offer_letter',
  'experience_letter',
  'other',
  // MY
  'ic',
  'nric',
  'epf',
  'socso',
  'income_tax',
  'payslips',
  'bank_details',
  'photo',
  'education',
  'ep',
  'passport_copy',
  'medical',
  'bestinet',
  'immigration',
  // IN
  'aadhaar',
  'pan',
  'education_10',
  'education_12',
  'degree',
  'pf',
  'uan',
  'form16',
  'relieving',
  // SG
  'fin',
  'cpf',
  // AU / CA / AE
  'tfn',
  'police',
  'super',
  'sin',
  'pr',
  'work_permit',
  'emirates_id',
  'labour_card',
] as const

export type DocumentSlot = (typeof DOCUMENT_SLOTS)[number]

export const SLOT_LABELS: Record<string, string> = {
  resume: 'Resume / CV',
  passport: 'Passport',
  visa: 'Visa / Work Permit',
  certificate: 'Certificates',
  offer_letter: 'Offer Letter',
  experience_letter: 'Experience Letter',
  other: 'Other',
  ic: 'IC / NRIC',
  nric: 'NRIC',
  epf: 'EPF',
  socso: 'SOCSO',
  income_tax: 'Income Tax',
  payslips: 'Payslips',
  bank_details: 'Bank Details',
  photo: 'Photo',
  education: 'Educational Documents',
  ep: 'Employment Pass / EP',
  passport_copy: 'Passport Copy',
  medical: 'Medical',
  bestinet: 'Bestinet',
  immigration: 'Immigration Documents',
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  education_10: '10th',
  education_12: '12th',
  degree: 'Degree',
  pf: 'PF Number',
  uan: 'UAN',
  form16: 'Form 16',
  relieving: 'Relieving Letter',
  fin: 'FIN',
  cpf: 'CPF',
  tfn: 'TFN',
  police: 'Police Clearance',
  super: 'Superannuation',
  sin: 'SIN',
  pr: 'PR',
  work_permit: 'Work Permit',
  emirates_id: 'Emirates ID',
  labour_card: 'Labour Card',
}

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png'])
const MAX_BYTES = 15 * 1024 * 1024

export function documentsRoot() {
  return path.join(process.cwd(), 'uploads', 'candidate-documents')
}

export function legacyResumesRoot() {
  return path.join(process.cwd(), 'uploads', 'candidate-resumes')
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

export function isValidDocumentSlot(slot: string): slot is DocumentSlot {
  return (DOCUMENT_SLOTS as readonly string[]).includes(slot)
}

export function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] ?? slot.replace(/_/g, ' ')
}

/** Safe path containment check that works on Windows (case / separators). */
function isPathInsideRoot(absFile: string, root: string): boolean {
  const normalizedFile = path.resolve(absFile)
  const normalizedRoot = path.resolve(root)
  const rel = path.relative(normalizedRoot, normalizedFile)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
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
  return { relative: relative.replace(/\\/g, '/'), ext }
}

export async function readStoredFile(relative: string): Promise<Buffer> {
  const normalized = path.normalize(relative).replace(/^[/\\]+/, '')
  if (normalized.includes('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid storage path')
  }

  const primary = path.join(documentsRoot(), normalized)
  if (isPathInsideRoot(primary, documentsRoot())) {
    try {
      await access(primary)
      return await readFile(primary)
    } catch { /* try legacy */ }
  }

  const legacy = path.join(legacyResumesRoot(), normalized)
  if (isPathInsideRoot(legacy, legacyResumesRoot())) {
    try {
      await access(legacy)
      return await readFile(legacy)
    } catch { /* fall through */ }
  }

  // Also try basename-only under legacy (older flat paths)
  const base = path.basename(normalized)
  const legacyFlat = path.join(legacyResumesRoot(), base)
  if (isPathInsideRoot(legacyFlat, legacyResumesRoot())) {
    try {
      await access(legacyFlat)
      return await readFile(legacyFlat)
    } catch { /* fall through */ }
  }

  throw new Error('File missing on disk')
}
