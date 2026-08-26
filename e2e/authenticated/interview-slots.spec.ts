import { test, expect } from '@playwright/test'
import { gotoDashboard, openTab, expectTabHeading } from '../helpers/dashboard'

test.describe('Interview editable slots', () => {
  test('Interviews table has 1st–4th date/time columns and editable inputs', async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Interviews')
    await expectTabHeading(page, /Interview Scheduling|Interviews/i)
    const table = page.locator('table.ent-table').first()
    await expect(table.getByRole('columnheader', { name: '1st Date' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: '2nd Time' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: '3rd Date' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: '4th Time' })).toBeVisible()

    const dateInput = page.getByTestId('interview-slot-1-date').first()
    if (await dateInput.count()) {
      await expect(dateInput).toBeEnabled()
      const timeInput = page.getByTestId('interview-slot-1-time').first()
      await expect(timeInput).toBeEnabled()
    }

    await page.getByRole('button', { name: /^Schedule$/i }).click()
    await expect(page.getByRole('heading', { name: /Schedule interview/i })).toBeVisible()
    await expect(page.getByTestId('schedule-slot-1')).toHaveValue('')
    await expect(page.getByTestId('schedule-slot-2')).toHaveValue('')
    await page.getByRole('button', { name: /Add another slot/i }).click()
    await expect(page.getByTestId('schedule-slot-5')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('PATCH scheduled_at persists a slot and POST can add another round', async ({ request }) => {
    const list = await request.get('/api/interviews?limit=20&mine=0')
    expect(list.status()).toBeLessThan(500)
    test.skip(!list.ok(), 'Need interviews API')
    const body = await list.json()
    const interviews = (body.interviews ?? []) as Array<{
      id: string
      resume_id: string
      candidate_name: string
      scheduled_at?: string | null
      round?: number
    }>
    test.skip(!interviews.length, 'Need at least one interview')
    const iv = interviews[0]
    const when = new Date()
    when.setDate(when.getDate() + 3)
    when.setHours(11, 15, 0, 0)

    const patch = await request.patch(`/api/interviews/${iv.id}`, {
      data: { scheduled_at: when.toISOString() },
    })
    expect(patch.status(), await patch.text()).toBeLessThan(500)
    expect(patch.ok()).toBeTruthy()
    const patched = await patch.json()
    expect(patched.interview?.scheduled_at).toBeTruthy()

    const round2 = await request.post('/api/interviews', {
      data: {
        resume_id: iv.resume_id,
        candidate_name: iv.candidate_name,
        scheduled_at: new Date(when.getTime() + 3600_000).toISOString(),
        round: 2,
        send_invite: false,
        create_calendar: false,
      },
    })
    expect(round2.status(), await round2.text()).not.toBe(500)
    expect(round2.ok() || round2.status() === 201).toBeTruthy()
  })
})
