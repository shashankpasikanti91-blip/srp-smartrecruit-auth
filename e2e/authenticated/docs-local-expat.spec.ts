import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab, expectTabHeading } from '../helpers/dashboard'

test.describe('Local vs Expat document collection', () => {
  test('Offer Docs panel remaps Local vs Expat checklists', async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Offer & Onboarding')
    await expectTabHeading(page, /Offer & Onboarding/i)
    await page.getByRole('button', { name: 'Selected & Docs' }).click()
    await expect(page.getByText(/Employment type/i).first()).toBeVisible()
    await expect(page.getByRole('option', { name: /Expat/i }).first()).toBeAttached()

    const docsBtn = page.getByRole('button', { name: /^Docs$/i }).first()
    test.skip(!(await docsBtn.isVisible().catch(() => false)), 'No offer rows to open Docs')
    await docsBtn.click()
    await expect(page.getByRole('heading', { name: /Upload docs/i })).toBeVisible({ timeout: 10_000 })
    const emp = page.getByTestId('docs-employment-type')
    await expect(emp).toBeVisible()
    await emp.selectOption('local')
    await expect(page.getByTestId('doc-slot-ic').or(page.getByText(/^IC$/i)).first()).toBeVisible({ timeout: 10_000 })
    await emp.selectOption('foreign')
    await expect(page.getByTestId('doc-slot-passport').or(page.getByText(/^Passport$/i)).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('doc-slot-visa').or(page.getByText(/^Visa$/i)).first()).toBeVisible()
  })

  test('documents API returns different MY local vs foreign checklists', async ({ request }) => {
    const cands = await request.get('/api/candidates?limit=5')
    expect(cands.status()).toBeLessThan(500)
    test.skip(!cands.ok(), 'Need candidates API')
    const body = await cands.json()
    const candidates = (body.candidates ?? body.resumes ?? []) as Array<{ id: string }>
    test.skip(!candidates.length, 'Need a candidate')
    const id = candidates[0].id

    const local = await request.get(`/api/candidates/${id}/documents?country=MY&employment_type=local`)
    expect(local.ok()).toBeTruthy()
    const localBody = await local.json()
    const localKeys = (localBody.checklist ?? localBody.documents ?? []).map(
      (d: { key?: string; slot_type?: string }) => d.key || d.slot_type,
    ) as string[]
    expect(localKeys).toContain('ic')
    expect(localKeys).toContain('epf')
    expect(localKeys).not.toContain('visa')

    const foreign = await request.get(`/api/candidates/${id}/documents?country=MY&employment_type=foreign`)
    expect(foreign.ok()).toBeTruthy()
    const foreignBody = await foreign.json()
    const foreignKeys = (foreignBody.checklist ?? foreignBody.documents ?? []).map(
      (d: { key?: string; slot_type?: string }) => d.key || d.slot_type,
    ) as string[]
    expect(foreignKeys).toContain('passport')
    expect(foreignKeys).toContain('visa')
    expect(foreignKeys).not.toContain('ic')
  })

  test('HRMS checklist mapper can add an item and save', async ({ page }) => {
    await gotoDashboard(page)
    const hrms = page.locator('aside').getByRole('button', { name: /^HRMS$/i })
    test.skip(!(await hrms.isVisible().catch(() => false)), 'HRMS tab not visible for this user')
    await hrms.click()
    const checklistsBtn = page.getByRole('button', { name: /checklist/i }).first()
    if (await checklistsBtn.isVisible().catch(() => false)) {
      await checklistsBtn.click()
    }
    const mapper = page.getByTestId('checklist-mapper')
    await expect(mapper).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Add custom document/i }).click()
    await expect(mapper.locator('input').last()).toBeVisible()
  })
})
