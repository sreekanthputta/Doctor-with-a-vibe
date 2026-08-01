import { expect, test } from '@playwright/test';
import type { DemoWorkflowSnapshot } from '../../src/server/demo-workflow-store';

test.describe('VibeDoc four-shell demo', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/demo/reset');
  });

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
    const publicContext = await browser.newContext();
    const patientContext = await browser.newContext();
    const physicianContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    const patient = await patientContext.newPage();
    const physician = await physicianContext.newPage();

    await publicPage.goto('/');
    await publicPage.getByRole('textbox', { name: /message/i }).fill('I need an annual wellness visit in the morning');
    await publicPage.getByRole('button', { name: /send request/i }).click();
    await expect(publicPage.getByRole('status')).toHaveText(/Book appointment completed/i);
    await publicPage.getByRole('button', { name: /Book appointment completed/i }).click();
    await expect(publicPage.getByText(/Appointment recorded/i)).toBeVisible();

    await patient.goto('/patient/visit');
    await expect(patient.getByText(/visit readiness/i)).toBeVisible();
    await expect(patient.getByRole('status')).toHaveText('Needs attention');
    await patient.getByLabel(/insurance member id/i).fill('AETNA-DEMO-2048');
    await patient.getByRole('button', { name: /submit member id/i }).click();
    await expect(patient.getByRole('status')).toHaveText('Ready');

    await physician.goto('/physician/inbox');
    await expect(physician.getByText(/suggested next visit/i)).toBeVisible();
    await expect(physician.getByText(/Updated:/i)).toBeVisible();
    await expect(physician.getByRole('status')).toHaveText('Ready');

    await publicContext.close();
    await patientContext.close();
    await physicianContext.close();
  });

  test('mixed clinical input stops with safety copy and no booking', async ({ page, request }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: /message/i }).fill('I have chest pain and need an annual wellness visit');
    await page.getByRole('button', { name: /send request/i }).click();
    await expect(page.getByText(/VibeDoc cannot assess symptoms or emergencies/i)).toBeVisible();
    await expect(page.getByText(/Appointment recorded/i)).toHaveCount(0);
    const state = await request.get('/api/demo/state');
    const body = await state.json() as DemoWorkflowSnapshot;
    expect(body.exceptions).toHaveLength(1);
    expect(body.resourceEvidence.some((item) => item.resourceType === 'Appointment')).toBe(false);
  });
});
