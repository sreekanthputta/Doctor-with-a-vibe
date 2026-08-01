import { expect, test } from '@playwright/test';

test.describe('VibeDoc four-shell demo', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/demo/reset', { headers: { 'X-Demo-Reset-Token': 'vibedoc-e2e-reset' } });
  });

  test('public access is synthetic and offers typed administrative access', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/synthetic data/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /One request\. One ready visit/i })).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
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
    await publicPage.getByLabel(/first name/i).fill('Maria');
    await publicPage.getByLabel(/last name/i).fill('Lopez');
    await publicPage.getByLabel(/date of birth/i).fill('1974-02-14');
    await publicPage.getByLabel(/postal code/i).fill('60601');
    await publicPage.getByRole('button', { name: 'Continue' }).click();
    await expect(publicPage.getByRole('textbox', { name: /message/i })).toBeVisible();
    await publicPage.getByRole('textbox', { name: /message/i }).fill('I need an annual wellness visit in the morning');
    await publicPage.getByRole('button', { name: /send request/i }).click();
    await expect(publicPage.getByRole('status')).toHaveText(/Book appointment completed/i);
    await publicPage.getByRole('button', { name: /Book appointment completed/i }).click();
    await expect(publicPage.getByText(/Appointment recorded/i)).toBeVisible();

    await patient.goto('/demo');
    await patient.getByRole('button', { name: /Continue as Maria Lopez/i }).click();
    await patient.waitForURL('**/patient/visit');
    await expect(patient.getByText(/visit readiness/i)).toBeVisible();
    await expect(patient.getByRole('status')).toHaveText('Needs attention');
    await patient.getByLabel(/insurance member id/i).fill('AETNA-DEMO-2048');
    await patient.getByRole('button', { name: /submit member id/i }).click();
    await expect(patient.getByRole('status')).toHaveText('Ready');

    await physician.goto('/demo');
    await physician.getByRole('button', { name: /Continue as Dr\. Maya Chen/i }).click();
    await physician.waitForURL('**/physician/inbox');
    await expect(physician.getByText(/suggested next visit/i)).toBeVisible();
    await expect(physician.getByText(/Updated:/i)).toBeVisible();
    await expect(physician.getByRole('status')).toHaveText('Ready');

    const unrelatedPublicContext = await browser.newContext();
    const unrelatedPublic = await unrelatedPublicContext.newPage();
    await unrelatedPublic.goto('/');
    await expect(unrelatedPublic.getByLabel(/first name/i)).toBeVisible();
    await expect(unrelatedPublic.getByText('Maria Lopez', { exact: true })).toHaveCount(0);

    await publicPage.goto('/physician/inbox');
    await expect(publicPage.getByText(/Physician access is required/i)).toBeVisible();

    await publicContext.close();
    await unrelatedPublicContext.close();
    await patientContext.close();
    await physicianContext.close();
  });

  test('mixed clinical input stops with safety copy and no booking', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/first name/i).fill('Maria');
    await page.getByLabel(/last name/i).fill('Lopez');
    await page.getByLabel(/date of birth/i).fill('1974-02-14');
    await page.getByLabel(/postal code/i).fill('60601');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('textbox', { name: /message/i }).fill('I have chest pain and need an annual wellness visit');
    await page.getByRole('button', { name: /send request/i }).click();
    await expect(page.getByText(/VibeDoc cannot assess symptoms or emergencies/i)).toBeVisible();
    await expect(page.getByText(/Appointment recorded/i)).toHaveCount(0);
    const stateText = await page.evaluate(async () => await fetch('/api/demo/state').then(async (response) => await response.text()));
    expect(stateText).toContain('"exceptions":[{');
    expect(stateText).not.toContain('"resourceType":"Appointment"');
  });

  test('uncertain identity reveals no patient and creates one owned exception', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Replay uncertain identity/i }).click();
    await expect(page.getByRole('heading', { name: /Identity could not be confirmed/i })).toBeVisible();
    await expect(page.getByText(/No patient information was disclosed/i)).toBeVisible();
    const stateText = await page.evaluate(async () => await fetch('/api/demo/state').then(async (response) => await response.text()));
    expect(stateText).toContain('"category":"identity"');
    expect(stateText).not.toContain('Maria');
    expect(stateText).not.toContain('"resourceType":"Patient"');
    expect(stateText).not.toContain('"resourceType":"Appointment"');
  });
});
