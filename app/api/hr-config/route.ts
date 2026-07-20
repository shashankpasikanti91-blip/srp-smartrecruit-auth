import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText } from '@/lib/validate'
import { listReminderRules, ensureDefaultReminderRules, runReminderSweep } from '@/lib/reminderEngine'
import { getDocumentChecklist, CHECKLIST_COUNTRIES } from '@/lib/recruitmentOs'
import { escalateOverdueWorkflows } from '@/lib/workflowEngine'
import { runAgentSweep } from '@/lib/agentFramework'

const PACK_COUNTRIES = ['MY', 'IN', 'SG', 'AU', 'CA', 'AE'] as const
const PACK_TEMPLATE_TYPES = ['offer_letter', 'joining_checklist', 'employment_contract', 'visa_requirements'] as const

const COUNTRY_DEFAULTS: Record<string, {
  default_currency: string
  holidays: string[]
  payroll_defaults: Record<string, unknown>
  visa_rules: Record<string, unknown>
}> = {
  MY: {
    default_currency: 'MYR',
    holidays: ['2026-01-01', '2026-02-01', '2026-05-01'],
    payroll_defaults: { epf: true, socso: true, eis: true, pcb: true },
    visa_rules: { employment_pass: 'MDEC/EP', visit_pass: 'Social visit pass for interviews' },
  },
  IN: {
    default_currency: 'INR',
    holidays: ['2026-01-26', '2026-08-15', '2026-10-02'],
    payroll_defaults: { pf: true, esi: true, tds: true },
    visa_rules: { work_permit: 'Employment visa via FRRO' },
  },
  SG: {
    default_currency: 'SGD',
    holidays: ['2026-01-01', '2026-02-17', '2026-08-09'],
    payroll_defaults: { cpf: true, sdl: true },
    visa_rules: { employment_pass: 'MOM EP/S Pass', wp: 'Work Permit for specific sectors' },
  },
  AU: {
    default_currency: 'AUD',
    holidays: ['2026-01-01', '2026-01-26', '2026-12-25'],
    payroll_defaults: { superannuation_pct: 11.5, payg: true },
    visa_rules: { subclass_482: 'TSS visa', subclass_186: 'ENS permanent' },
  },
  CA: {
    default_currency: 'CAD',
    holidays: ['2026-07-01', '2026-12-25', '2026-12-26'],
    payroll_defaults: { cpp: true, ei: true, provincial_tax: true },
    visa_rules: { lmia: 'LMIA required for most TFW', pgwp: 'Post-grad work permit' },
  },
  AE: {
    default_currency: 'AED',
    holidays: ['2026-01-01', '2026-12-02', '2026-12-03'],
    payroll_defaults: { gratuity: true, wps: true },
    visa_rules: { work_permit: 'MOHRE employment visa', emirates_id: 'Required after entry' },
  },
}

async function ensureCountryDefaults(tenantId: string) {
  for (const code of PACK_COUNTRIES) {
    const def = COUNTRY_DEFAULTS[code]
    if (!def) continue
    try {
      await pool.query(
        `INSERT INTO country_settings
           (tenant_id, country_code, default_currency, holidays, payroll_defaults, visa_rules, is_active)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,true)
         ON CONFLICT (tenant_id, country_code) DO NOTHING`,
        [
          tenantId,
          code,
          def.default_currency,
          JSON.stringify(def.holidays),
          JSON.stringify(def.payroll_defaults),
          JSON.stringify(def.visa_rules),
        ]
      )
    } catch { /* table may not exist */ }
  }
}

function packTemplateBody(type: string, country: string): string {
  const labels: Record<string, string> = {
    offer_letter: 'Offer Letter',
    joining_checklist: 'Joining Checklist',
    employment_contract: 'Employment Contract',
    visa_requirements: 'Visa Requirements',
  }
  const label = labels[type] ?? type
  return `[${country} ${label}]\n\nReplace with your tenant-specific ${label.toLowerCase()} template.\n\nCandidate: {{candidate_name}}\nRole: {{job_title}}\nStart date: {{expected_joining}}\n`
}

/**
 * HR Admin Configuration — templates + reminder rules (no hardcoding in UI).
 * GET  ?section=templates|reminders|checklists|countries
 * POST section-specific create/update
 */
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx

  const section = req.nextUrl.searchParams.get('section') ?? 'templates'
  const type = req.nextUrl.searchParams.get('type')

  if (section === 'countries') {
    return NextResponse.json({ countries: CHECKLIST_COUNTRIES })
  }

  if (section === 'country_settings') {
    await ensureCountryDefaults(ctx.tenantId)
    try {
      const { rows } = await pool.query(
        `SELECT * FROM country_settings WHERE tenant_id = $1 ORDER BY country_code`,
        [ctx.tenantId]
      )
      return NextResponse.json({ countries: rows, defaults: COUNTRY_DEFAULTS })
    } catch {
      return NextResponse.json({ countries: [], defaults: COUNTRY_DEFAULTS })
    }
  }

  if (section === 'checklists') {
    const country = req.nextUrl.searchParams.get('country') ?? 'MY'
    const employment = (req.nextUrl.searchParams.get('employment') ?? 'local') as 'local' | 'foreign'
    try {
      const { rows } = await pool.query(
        `SELECT * FROM document_checklist_templates
         WHERE tenant_id = $1 AND country_code = $2 AND employment_type = $3 AND is_active = true
         LIMIT 1`,
        [ctx.tenantId, country.toUpperCase(), employment]
      )
      if (rows[0]) {
        return NextResponse.json({ checklist: rows[0], source: 'tenant' })
      }
    } catch { /* fall through */ }
    return NextResponse.json({
      checklist: {
        country_code: country.toUpperCase(),
        employment_type: employment,
        items: getDocumentChecklist(country, employment),
      },
      source: 'default',
    })
  }

  if (section === 'reminders') {
    await ensureDefaultReminderRules(ctx.tenantId)
    const rules = await listReminderRules(ctx.tenantId)
    return NextResponse.json({ rules })
  }

  // templates
  try {
    const params: unknown[] = [ctx.tenantId]
    let sql = `SELECT * FROM hr_templates WHERE tenant_id = $1 AND is_active = true`
    if (type) {
      sql += ' AND template_type = $2'
      params.push(type)
    }
    sql += ' ORDER BY template_type, name'
    const { rows } = await pool.query(sql, params)
    return NextResponse.json({ templates: rows })
  } catch {
    return NextResponse.json({ templates: [] })
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (ctx instanceof NextResponse) return ctx
  if (!['owner', 'admin'].includes(ctx.tenantRole)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'sweep_reminders') {
    const result = await runReminderSweep({ tenantId: ctx.tenantId, userId: ctx.userId })
    const escalated = await escalateOverdueWorkflows({ tenantId: ctx.tenantId, userId: ctx.userId })
    const agent = await runAgentSweep({ tenantId: ctx.tenantId, userId: ctx.userId })
    return NextResponse.json({
      ...result,
      escalated,
      agent_created: agent.created,
      agent_run_id: agent.runId,
    })
  }

  if (action === 'upsert_country_settings') {
    const country = (sanitizeText(body.country_code, 10) ?? 'MY').toUpperCase()
    await pool.query(
      `INSERT INTO country_settings
         (tenant_id, country_code, default_currency, holidays, payroll_defaults, visa_rules, meta, is_active, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8,NOW())
       ON CONFLICT (tenant_id, country_code) DO UPDATE SET
         default_currency = EXCLUDED.default_currency,
         holidays = EXCLUDED.holidays,
         payroll_defaults = EXCLUDED.payroll_defaults,
         visa_rules = EXCLUDED.visa_rules,
         meta = EXCLUDED.meta,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      [
        ctx.tenantId,
        country,
        sanitizeText(body.default_currency, 10) ?? COUNTRY_DEFAULTS[country]?.default_currency ?? 'MYR',
        JSON.stringify(body.holidays ?? COUNTRY_DEFAULTS[country]?.holidays ?? []),
        JSON.stringify(body.payroll_defaults ?? COUNTRY_DEFAULTS[country]?.payroll_defaults ?? {}),
        JSON.stringify(body.visa_rules ?? COUNTRY_DEFAULTS[country]?.visa_rules ?? {}),
        JSON.stringify(body.meta ?? {}),
        body.is_active !== false,
      ]
    )
    return NextResponse.json({ ok: true })
  }

  if (action === 'seed_country_packs') {
    const countries = Array.isArray(body.countries)
      ? body.countries.map((c: string) => c.toUpperCase()).filter((c: string) => PACK_COUNTRIES.includes(c as typeof PACK_COUNTRIES[number]))
      : [...PACK_COUNTRIES]
    await ensureCountryDefaults(ctx.tenantId)
    let seeded = 0
    for (const country of countries) {
      for (const template_type of PACK_TEMPLATE_TYPES) {
        const name = `${country} ${template_type.replace(/_/g, ' ')}`
        const dup = await pool.query(
          `SELECT id FROM hr_templates
           WHERE tenant_id = $1 AND template_type = $2 AND country_code = $3 LIMIT 1`,
          [ctx.tenantId, template_type, country]
        )
        if (dup.rows[0]) continue
        await pool.query(
          `INSERT INTO hr_templates
             (tenant_id, template_type, name, subject, body, country_code, meta, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
          [
            ctx.tenantId,
            template_type,
            name,
            `${name} — {{candidate_name}}`,
            packTemplateBody(template_type, country),
            country,
            JSON.stringify({ seeded: true, pack: 'phase25' }),
            ctx.userId,
          ]
        )
        seeded++
      }
    }
    return NextResponse.json({ ok: true, seeded, countries })
  }

  if (action === 'upsert_reminder') {
    const rule_key = sanitizeText(body.rule_key, 80)
    const label = sanitizeText(body.label, 200)
    if (!rule_key || !label) return NextResponse.json({ error: 'rule_key and label required' }, { status: 400 })
    await pool.query(
      `INSERT INTO reminder_rules (tenant_id, rule_key, label, entity_type, offset_minutes, channel, is_active, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id, rule_key) DO UPDATE SET
         label = EXCLUDED.label,
         entity_type = EXCLUDED.entity_type,
         offset_minutes = EXCLUDED.offset_minutes,
         channel = EXCLUDED.channel,
         is_active = EXCLUDED.is_active,
         meta = EXCLUDED.meta,
         updated_at = NOW()`,
      [
        ctx.tenantId,
        rule_key,
        label,
        sanitizeText(body.entity_type, 50) ?? 'general',
        Number(body.offset_minutes) || 0,
        sanitizeText(body.channel, 40) ?? 'in_app',
        body.is_active !== false,
        JSON.stringify(body.meta ?? {}),
      ]
    )
    return NextResponse.json({ ok: true })
  }

  if (action === 'upsert_checklist') {
    const country = (sanitizeText(body.country_code, 10) ?? 'MY').toUpperCase()
    const employment = sanitizeText(body.employment_type, 20) ?? 'local'
    await pool.query(
      `INSERT INTO document_checklist_templates (tenant_id, country_code, employment_type, items, is_active, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,true,NOW())
       ON CONFLICT (tenant_id, country_code, employment_type) DO UPDATE SET
         items = EXCLUDED.items, is_active = true, updated_at = NOW()`,
      [ctx.tenantId, country, employment, JSON.stringify(body.items ?? [])]
    )
    return NextResponse.json({ ok: true })
  }

  if (action === 'upsert_template') {
    const template_type = sanitizeText(body.template_type, 40)
    const name = sanitizeText(body.name, 200)
    if (!template_type || !name) {
      return NextResponse.json({ error: 'template_type and name required' }, { status: 400 })
    }
    if (body.id) {
      await pool.query(
        `UPDATE hr_templates SET
           name = $1, subject = $2, body = $3, country_code = $4, meta = $5::jsonb,
           is_active = $6, updated_at = NOW()
         WHERE id = $7 AND tenant_id = $8`,
        [
          name,
          sanitizeText(body.subject, 500),
          body.body ?? null,
          sanitizeText(body.country_code, 10),
          JSON.stringify(body.meta ?? {}),
          body.is_active !== false,
          body.id,
          ctx.tenantId,
        ]
      )
    } else {
      await pool.query(
        `INSERT INTO hr_templates
           (tenant_id, template_type, name, subject, body, country_code, meta, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
        [
          ctx.tenantId,
          template_type,
          name,
          sanitizeText(body.subject, 500),
          body.body ?? null,
          sanitizeText(body.country_code, 10),
          JSON.stringify(body.meta ?? {}),
          ctx.userId,
        ]
      )
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
