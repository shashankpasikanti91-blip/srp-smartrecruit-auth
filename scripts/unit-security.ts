/**
 * Lightweight unit checks (no jest — run via tsx).
 * npm run test:unit
 */
import assert from 'node:assert/strict'
import {
  checkPermission,
  canAccessRecruitersModule,
  canAccessGovernance,
  canAccessTenantAudit,
  defaultRecruiterPermissions,
  defaultOwnerPermissions,
  defaultRecruitmentHeadPermissions,
  ROLE_PRESET,
  INVITE_TENANT_ROLES,
} from '../lib/tenant'
import { redactValue, redactUrl } from '../lib/requestLog'
import { isHighRiskAuditAction } from '../lib/audit'

function testPermissions() {
  const owner = defaultOwnerPermissions()
  assert.equal(checkPermission(owner, 'governance.read'), true)
  assert.equal(checkPermission(owner, 'recruiters.module'), true)
  assert.equal(checkPermission(owner, 'audit.tenant_read'), true)

  const recruiter = defaultRecruiterPermissions()
  assert.equal(checkPermission(recruiter, 'governance.read'), false)
  assert.equal(checkPermission(recruiter, 'recruiters.module'), false)
  assert.equal(checkPermission(recruiter, 'jobs.create'), true)

  const head = defaultRecruitmentHeadPermissions()
  assert.equal(checkPermission(head, 'recruiters.module'), true)
  assert.equal(checkPermission(head, 'governance.read'), false)

  assert.equal(canAccessRecruitersModule('recruiter'), false)
  assert.equal(canAccessRecruitersModule('manager'), true)
  assert.equal(canAccessRecruitersModule('recruitment_head'), true)
  assert.equal(canAccessGovernance('admin'), true)
  assert.equal(canAccessGovernance('recruiter'), false)
  assert.equal(canAccessTenantAudit('owner'), true)
  assert.equal(canAccessTenantAudit('recruiter'), false)

  for (const role of ['recruitment_head', 'manager', 'team_lead', 'hr'] as const) {
    assert.ok(ROLE_PRESET[role], `missing ROLE_PRESET for ${role}`)
    assert.ok(INVITE_TENANT_ROLES.includes(role), `invite roles missing ${role}`)
  }
}

function testRedaction() {
  const obj = redactValue({
    password: 'secret',
    api_key: 'sk-test',
    email: 'a@b.com',
    nested: { refresh_token: 'abc', ok: 1 },
  }) as Record<string, unknown>
  assert.equal(obj.password, '[REDACTED]')
  assert.equal(obj.api_key, '[REDACTED]')
  assert.equal(obj.email, 'a@b.com')
  assert.equal((obj.nested as Record<string, unknown>).refresh_token, '[REDACTED]')
  assert.equal((obj.nested as Record<string, unknown>).ok, 1)

  const url = redactUrl('https://x.test/callback?code=abc&token=zzz&keep=1')
  assert.ok(url.includes('[REDACTED]'))
  assert.ok(url.includes('keep=1'))
}

function testConnectionHonesty() {
  const { connectionStatusLabel, isHonestlyConnected } = require('../lib/connectionStatus') as typeof import('../lib/connectionStatus')
  assert.equal(isHonestlyConnected('connected'), true)
  assert.equal(isHonestlyConnected('not_tested'), false)
  assert.equal(isHonestlyConnected('not_configured'), false)
  assert.equal(connectionStatusLabel('not_tested'), 'Saved — not tested')
  assert.equal(connectionStatusLabel('connected'), 'Connected')
}

function testAuditRisk() {
  assert.equal(isHighRiskAuditAction('member_invite'), true)
  assert.equal(isHighRiskAuditAction('oauth_test_ok'), false)
  assert.equal(isHighRiskAuditAction('destructive_wipe'), true)
}

function testWhatsAppMeta() {
  const {
    mapMetaDeliveryStatus,
    verifyMetaChallenge,
    verifyMetaSignature,
    normalizePhoneE164Digits,
  } = require('../lib/whatsappMeta') as typeof import('../lib/whatsappMeta')

  assert.equal(mapMetaDeliveryStatus('delivered'), 'delivered')
  assert.equal(mapMetaDeliveryStatus('read'), 'read')
  assert.equal(mapMetaDeliveryStatus('failed'), 'failed')
  assert.equal(normalizePhoneE164Digits('whatsapp:+91-98-000'), '9198000')

  assert.equal(
    verifyMetaChallenge({
      mode: 'subscribe',
      token: 'tok',
      challenge: '12345',
      expectedTokens: ['tok'],
    }),
    '12345',
  )
  assert.equal(
    verifyMetaChallenge({
      mode: 'subscribe',
      token: 'wrong',
      challenge: '12345',
      expectedTokens: ['tok'],
    }),
    null,
  )

  const crypto = require('node:crypto') as typeof import('node:crypto')
  const body = '{"object":"whatsapp_business_account"}'
  const secret = 'test_app_secret'
  const digest = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  assert.equal(verifyMetaSignature(body, `sha256=${digest}`, secret).ok, true)
  assert.equal(verifyMetaSignature(body, 'sha256=deadbeef', secret).ok, false)
  assert.equal(verifyMetaSignature(body, null, secret).ok, false)
  assert.equal(verifyMetaSignature(body, null, '').reason, 'no_secret')
}

function main() {
  testPermissions()
  testRedaction()
  testConnectionHonesty()
  testAuditRisk()
  testWhatsAppMeta()
  console.log(JSON.stringify({
    ok: true,
    suites: ['permissions', 'redaction', 'connection_honesty', 'audit_risk', 'whatsapp_meta'],
  }))
}

main()
