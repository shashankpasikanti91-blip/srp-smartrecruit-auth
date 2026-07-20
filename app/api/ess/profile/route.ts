import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant'
import { pool } from '@/lib/db'
import { sanitizeText } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { logDataAccess, logUserActivity } from '@/lib/activityLog'

function getIpAddress(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const { rows: profile } = await pool.query(
    `SELECT * FROM employee_profiles WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
    [ctx.userId, ctx.tenantId]
  )

  const { rows: payslips } = await pool.query(
    `SELECT id, period_label, period_month, external_url, created_at
     FROM employee_payslips WHERE user_id = $1 AND tenant_id = $2
     ORDER BY period_month DESC LIMIT 24`,
    [ctx.userId, ctx.tenantId]
  )

  const { rows: leaves } = await pool.query(
    `SELECT * FROM leave_requests WHERE user_id = $1 AND tenant_id = $2
     ORDER BY created_at DESC LIMIT 20`,
    [ctx.userId, ctx.tenantId]
  )

  const { rows: docs } = await pool.query(
    `SELECT id, doc_type, title, external_url, created_at FROM company_documents
     WHERE tenant_id = $1 AND (visible_to_all = TRUE OR user_id = $2)
     ORDER BY created_at DESC LIMIT 50`,
    [ctx.tenantId, ctx.userId]
  )

  const { rows: userRow } = await pool.query(
    `SELECT name, email FROM auth_users WHERE id = $1`,
    [ctx.userId]
  )

  const { rows: tenantRow } = await pool.query<{ settings: unknown }>(
    'SELECT settings FROM tenants WHERE id = $1',
    [ctx.tenantId]
  )
  const settings = (tenantRow[0]?.settings ?? {}) as Record<string, unknown>
  const leaveBalance = typeof settings.annual_leave_balance === 'number' ? settings.annual_leave_balance : 14

  await Promise.allSettled([
    logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ess.profile.view',
      resourceType: 'employee_profile',
      resourceId: ctx.userId,
      pagePath: '/api/ess/profile',
      ipAddress: getIpAddress(req) ?? undefined,
    }),
    logDataAccess({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      userRole: ctx.tenantRole,
      accessType: 'ess_profile_view',
      resourceType: 'employee_profile',
      resourceId: ctx.userId,
      ipAddress: getIpAddress(req) ?? undefined,
    }),
  ])

  return NextResponse.json({
    user: userRow[0] ?? null,
    profile: profile[0] ?? null,
    payslips,
    leave_requests: leaves,
    company_documents: docs,
    leave_balance: leaveBalance,
  })
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req, 'ess.access')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json()
  const fields = {
    emergency_contact: sanitizeText(body.emergency_contact, 200),
    emergency_phone: sanitizeText(body.emergency_phone, 40),
    address: sanitizeText(body.address, 500),
    bank_name: sanitizeText(body.bank_name, 120),
    bank_account_masked: sanitizeText(body.bank_account_masked, 40),
    id_document_ref: sanitizeText(body.id_document_ref, 80),
  }

  const updated = await pool.query(
    `UPDATE employee_profiles
       SET emergency_contact = $3,
           emergency_phone = $4,
           address = $5,
           bank_name = $6,
           bank_account_masked = $7,
           id_document_ref = $8,
           updated_at = NOW()
     WHERE user_id = $1 AND tenant_id = $2
     RETURNING *`,
    [
      ctx.userId, ctx.tenantId,
      fields.emergency_contact, fields.emergency_phone, fields.address,
      fields.bank_name, fields.bank_account_masked, fields.id_document_ref,
    ]
  )
  const rows = updated.rows.length > 0
    ? updated.rows
    : (await pool.query(
        `INSERT INTO employee_profiles
           (user_id, tenant_id, emergency_contact, emergency_phone, address, bank_name, bank_account_masked, id_document_ref, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         RETURNING *`,
        [
          ctx.userId, ctx.tenantId,
          fields.emergency_contact, fields.emergency_phone, fields.address,
          fields.bank_name, fields.bank_account_masked, fields.id_document_ref,
        ]
      )).rows

  await Promise.allSettled([
    logUserActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ess.profile.update',
      resourceType: 'employee_profile',
      resourceId: ctx.userId,
      details: { fields: Object.keys(fields).filter(k => fields[k as keyof typeof fields] !== null) },
      ipAddress: getIpAddress(req) ?? undefined,
    }),
    logAudit({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: 'ess.profile.update',
      resourceType: 'employee_profile',
      resourceId: ctx.userId,
      tenantId: ctx.tenantId,
      details: { updated_fields: Object.keys(fields).filter(k => fields[k as keyof typeof fields] !== null) },
    }),
  ])

  return NextResponse.json({ profile: rows[0] })
}
