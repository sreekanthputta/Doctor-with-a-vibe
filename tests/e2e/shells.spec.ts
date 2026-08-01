import { expect, test } from '@playwright/test';

test.describe('VibeDoc four-shell demo', () => {
  test('public access is synthetic and offers typed administrative access', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/synthetic data/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /One request\. One ready visit/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /message/i })).toBeVisible();
  });

  test('demo selector never presents itself as authentication', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: /Choose a fictional workspace/i })).toBeVisible();
    await expect(page.getByText(/not authentication/i)).toBeVisible();
  });

  test('patient and physician shells expose readiness and source context', async ({ browser }) => {
    const patientContext = await browser.newContext();
    const physicianContext = await browser.newContext();
    const patient = await patientContext.newPage();
    const physician = await physicianContext.newPage();

    await patient.goto('/patient/visit');
    await expect(patient.getByText(/visit readiness/i)).toBeVisible();

    await physician.goto('/physician/inbox');
    await expect(physician.getByText(/suggested next visit/i)).toBeVisible();
    await expect(physician.getByText(/Updated:/i)).toBeVisible();

    await patientContext.close();
    await physicianContext.close();
  });
});
