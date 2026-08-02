import { expect, test } from '@playwright/test';

test('booking trace starts locally and resolves from the sanitized server snapshot', async ({ page, request }) => {
  await request.post('/api/demo/reset', { headers: { 'X-Demo-Reset-Token': 'vibedoc-e2e-reset' } });

  let releaseBooking!: () => void;
  const bookingReleased = new Promise<void>((resolve) => {
    releaseBooking = resolve;
  });
  await page.route('**/api/demo/request', async (route) => {
    await bookingReleased;
    await route.continue();
  });
  let traceSnapshotReads = 0;
  await page.route('**/api/traces', async (route) => {
    traceSnapshotReads += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          traceId: 'trace:server-booking',
          messageId: 'message:booking',
          toolName: 'book_appointment',
          status: 'succeeded',
          startedAt: '2026-08-01T15:02:41-05:00',
          completedAt: '2026-08-01T15:02:41.323-05:00',
          safeInput: { slotDisplay: 'Tuesday morning' },
          safeOutput: { appointmentDisplay: 'Tuesday, August 4 at 10:30 AM' },
        },
      ]),
    });
  });

  await page.goto('/');
  await page.getByLabel(/first name/i).fill('Maria');
  await page.getByLabel(/last name/i).fill('Lopez');
  await page.getByLabel(/date of birth/i).fill('1974-02-14');
  await page.getByLabel(/postal code/i).fill('60601');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: /message/i }).fill(
    "I'm a new patient. I want an annual wellness visit next Tuesday morning and I have Aetna.",
  );
  await page.getByRole('button', { name: /send request/i }).click();

  await expect(page.getByRole('status')).toHaveText(/Book appointment running/i);
  releaseBooking();
  await expect(page.getByRole('status')).toHaveText(/Book appointment completed/i);
  await page.getByRole('button', { name: /Book appointment completed/i }).click();
  await expect(page.getByText('Tuesday, August 4 at 10:30 AM', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your annual-wellness visit is booked' })).toBeVisible();
  expect(traceSnapshotReads).toBeGreaterThan(0);
});
