import { pool } from '@/lib/db'
import {
  getDocumentChecklist,
  type DocTemplateItem,
  type EmploymentType,
} from '@/lib/recruitmentOs'

export type DocsCollectionStatus = 'not_started' | 'collecting' | 'with_hr' | 'clearance_done'

function normalizeEmployment(raw?: string | null): EmploymentType {
  return raw === 'foreign' ? 'foreign' : 'local'
}

function normalizeCountry(raw?: string | null): string {
  const c = (raw || 'MY').trim().toUpperCase()
  if (c === 'MALAYSIA') return 'MY'
  if (c === 'INDIA') return 'IN'
  if (c === 'SINGAPORE') return 'SG'
  if (c === 'AUSTRALIA') return 'AU'
  if (c === 'CANADA') return 'CA'
  if (c === 'UAE' || c === 'DUBAI') return 'AE'
  return c || 'MY'
}

function sanitizeItems(raw: unknown): DocTemplateItem[] {
  if (!Array.isArray(raw)) return []
  const out: DocTemplateItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const key = typeof rec.key === 'string' ? rec.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') : ''
    if (!key) continue
    const label = typeof rec.label === 'string' && rec.label.trim() ? rec.label.trim() : key.replace(/_/g, ' ')
    out.push({ key, label, required: rec.required !== false })
  }
  return out
}

export async function resolveDocumentChecklist(
  tenantId: string,
  country: string,
  employmentType: EmploymentType = 'local',
): Promise<{ items: DocTemplateItem[]; source: 'tenant' | 'default' }> {
  const c = normalizeCountry(country)
  const emp = normalizeEmployment(employmentType)
  try {
    const { rows } = await pool.query<{ items: unknown }>(
      `SELECT items FROM document_checklist_templates
       WHERE tenant_id = $1 AND UPPER(country_code) = $2 AND employment_type = $3 AND is_active = true
       LIMIT 1`,
      [tenantId, c, emp],
    )
    const items = sanitizeItems(rows[0]?.items)
    if (items.length > 0) return { items, source: 'tenant' }
  } catch { /* fall through to defaults */ }
  return { items: getDocumentChecklist(c, emp), source: 'default' }
}

export async function loadTenantChecklists(
  tenantId: string,
): Promise<Map<string, DocTemplateItem[]>> {
  const map = new Map<string, DocTemplateItem[]>()
  try {
    const { rows } = await pool.query<{
      country_code: string
      employment_type: string
      items: unknown
    }>(
      `SELECT country_code, employment_type, items
       FROM document_checklist_templates
       WHERE tenant_id = $1 AND is_active = true`,
      [tenantId],
    )
    for (const r of rows) {
      const items = sanitizeItems(r.items)
      if (items.length) {
        map.set(`${normalizeCountry(r.country_code)}:${normalizeEmployment(r.employment_type)}`, items)
      }
    }
  } catch { /* ignore missing table */ }
  return map
}

export function checklistFromCache(
  cache: Map<string, DocTemplateItem[]>,
  country: string,
  employmentType?: string | null,
): DocTemplateItem[] {
  const c = normalizeCountry(country)
  const emp = normalizeEmployment(employmentType)
  return cache.get(`${c}:${emp}`) ?? getDocumentChecklist(c, emp)
}

export function computeDocsStatusFromSlots(
  checklist: DocTemplateItem[],
  filledSlots: Record<string, boolean>,
  verifiedSlots?: Record<string, boolean>,
): DocsCollectionStatus {
  const required = checklist.filter(i => i.required !== false)
  const reqKeys = required.map(i => i.key)
  if (reqKeys.length === 0) {
    return Object.values(filledSlots).some(Boolean) ? 'collecting' : 'not_started'
  }
  const filledReq = reqKeys.filter(k => filledSlots[k]).length
  if (filledReq === 0) return 'not_started'
  if (filledReq < reqKeys.length) return 'collecting'
  if (verifiedSlots && reqKeys.every(k => verifiedSlots[k])) return 'clearance_done'
  return 'with_hr'
}

/** Recalc offer docs_status from uploaded / verified slots. Never throws. */
export async function syncOfferDocsStatusForResume(opts: {
  tenantId: string
  resumeId: string
}): Promise<DocsCollectionStatus | null> {
  try {
    const offer = await pool.query<{
      id: string
      employment_type: string | null
      country_code: string | null
      remarks: string | null
      status: string
    }>(
      `SELECT id, employment_type, country_code, remarks, status
       FROM offer_cases
       WHERE tenant_id = $1 AND resume_id = $2
         AND LOWER(COALESCE(status, '')) NOT IN ('dropped','cancelled','offer_rejected','no_show')
       ORDER BY updated_at DESC
       LIMIT 1`,
      [opts.tenantId, opts.resumeId],
    )
    const row = offer.rows[0]
    if (!row) return null

    const country = normalizeCountry(row.country_code || 'MY')
    const emp = normalizeEmployment(row.employment_type)
    const { items } = await resolveDocumentChecklist(opts.tenantId, country, emp)

    const docs = await pool.query<{
      slot_type: string
      verification_status: string | null
      has_file: boolean
    }>(
      `SELECT cd.slot_type, cd.verification_status,
              EXISTS (SELECT 1 FROM document_versions dv WHERE dv.document_id = cd.id) AS has_file
       FROM candidate_documents cd
       WHERE cd.tenant_id = $1 AND cd.resume_id = $2`,
      [opts.tenantId, opts.resumeId],
    )

    const filled: Record<string, boolean> = {}
    const verified: Record<string, boolean> = {}
    for (const d of docs.rows) {
      filled[d.slot_type] = d.has_file
      verified[d.slot_type] = d.has_file && d.verification_status === 'verified'
    }

    const next = computeDocsStatusFromSlots(items, filled, verified)
    const raw = row.remarks ?? ''
    const cleaned = raw.replace(/\s*docs_status:\w+/g, '').trim()
    const nextRemarks = `${cleaned}${cleaned ? ' ' : ''}docs_status:${next}`.trim()

    let offerStatus: string | null = null
    if (next === 'collecting' && ['selected', 'document_collection'].includes(row.status)) {
      offerStatus = 'document_collection'
    } else if (next === 'with_hr' && ['selected', 'document_collection', 'document_verification'].includes(row.status)) {
      offerStatus = 'document_verification'
    } else if (next === 'clearance_done' && ['selected', 'document_collection', 'document_verification'].includes(row.status)) {
      offerStatus = 'offer_draft'
    } else if (next === 'not_started' && row.status === 'document_collection') {
      offerStatus = 'selected'
    }

    if (offerStatus) {
      await pool.query(
        `UPDATE offer_cases SET remarks = $1, status = $2, updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [nextRemarks, offerStatus, row.id, opts.tenantId],
      )
    } else {
      await pool.query(
        `UPDATE offer_cases SET remarks = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [nextRemarks, row.id, opts.tenantId],
      )
    }
    return next
  } catch (e) {
    console.warn('[syncOfferDocsStatusForResume]', e instanceof Error ? e.message : e)
    return null
  }
}
