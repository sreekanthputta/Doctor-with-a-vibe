import { expect, test } from '@playwright/test';

test.describe('VibeDoc four-shell demo', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/demo/reset', { headers: { 'X-Demo-Reset-Token': 'vibedoc-e2e-reset' } });
  });

  test('public access is synthetic and offers typed administrative access', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(response?.headers()['x-frame-options']).toBe('DENY');
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    await expect(page.getByText(/synthetic data/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /One request\. One ready visit/i })).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
  });

  test('demo selector never presents itself as authentication', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: /Choose a fictional workspace/i })).toBeVisible();
    await expect(page.getByText(/not authentication/i)).toBeVisible();
  });

  test('opening demo access after the public page rotates to a fresh neutral session', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel(/first name/i)).toBeVisible();

    await page.goto('/demo');

    await expect(page.getByRole('heading', { name: /Choose a fictional workspace/i })).toBeVisible();
    await expect(page.getByText(/temporarily unavailable/i)).toHaveCount(0);
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
    await publicPage.getByRole('textbox', { name: /message/i }).fill("I'm a new patient. I want an annual wellness visit next Tuesday morning and I have Aetna.");
    await publicPage.getByRole('button', { name: /send request/i }).click();
    await expect(publicPage.getByRole('status')).toHaveText(/Book appointment completed/i);
    await publicPage.getByRole('button', { name: /Book appointment completed/i }).click();
    await expect(publicPage.getByText('Tuesday, August 4 at 10:30 AM', { exact: true })).toBeVisible();
    await expect(publicPage.getByRole('heading', { name: 'Your annual-wellness visit is booked' })).toBeVisible();
    await expect(publicPage.getByText('Voice unavailable — continue by typing')).toBeVisible();

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
    await expect(physician.getByRole('heading', { name: 'Completed administrative work' })).toBeVisible();
    await expect(physician.getByText('✓ Missing member-ID follow-up requested and delivered', { exact: true })).toBeVisible();
    await expect(physician.getByText(/original required-field Task completed/i)).toBeVisible();
    await expect(physician.getByText(/CommunicationRequest\//).first()).toBeVisible();
    await expect(physician.getByText(/Communication\//).first()).toBeVisible();

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

  test('a second public session cannot take over an active workflow', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const attackerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const attacker = await attackerContext.newPage();

    await owner.goto('/');
    await owner.getByLabel(/first name/i).fill('Maria');
    await owner.getByLabel(/last name/i).fill('Lopez');
    await owner.getByLabel(/date of birth/i).fill('1974-02-14');
    await owner.getByLabel(/postal code/i).fill('60601');
    await owner.getByRole('button', { name: 'Continue' }).click();
    await owner.getByRole('textbox', { name: /message/i }).fill('I need an annual wellness visit in the morning');
    await owner.getByRole('button', { name: /send request/i }).click();
    await expect(owner.getByRole('status')).toHaveText(/Book appointment completed/i);

    await attacker.goto('/');
    await attacker.getByLabel(/first name/i).fill('Attacker');
    await attacker.getByLabel(/last name/i).fill('Session');
    await attacker.getByLabel(/date of birth/i).fill('1980-01-01');
    await attacker.getByLabel(/postal code/i).fill('00000');
    await attacker.getByRole('button', { name: 'Continue' }).click();
    await expect(attacker.getByText(/front desk is temporarily unavailable/i)).toBeVisible();
    await expect(attacker.getByText('Maria Lopez', { exact: true })).toHaveCount(0);
    const attackerTraces = await attacker.evaluate(async () => await fetch('/api/traces').then(async (response) => await response.text()));
    expect(attackerTraces).toBe('[]');

    await owner.reload();
    await expect(owner.getByRole('textbox', { name: /message/i })).toBeVisible();
    await expect(owner.getByRole('status')).toHaveText(/Book appointment completed/i);

    await ownerContext.close();
    await attackerContext.close();
  });

  test('Ready Maria coexists with one separately owned identity exception that the physician can acknowledge', async ({ browser }) => {
    const publicContext = await browser.newContext();
    const patientContext = await browser.newContext();
    const uncertainContext = await browser.newContext();
    const physicianContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    const patient = await patientContext.newPage();
    const uncertain = await uncertainContext.newPage();
    const physician = await physicianContext.newPage();

    await publicPage.goto('/');
    await publicPage.getByLabel(/first name/i).fill('Maria');
    await publicPage.getByLabel(/last name/i).fill('Lopez');
    await publicPage.getByLabel(/date of birth/i).fill('1974-02-14');
    await publicPage.getByLabel(/postal code/i).fill('60601');
    await publicPage.getByRole('button', { name: 'Continue' }).click();
    await publicPage.getByRole('textbox', { name: /message/i }).fill("I'm a new patient. I want an annual wellness visit next Tuesday morning and I have Aetna.");
    await publicPage.getByRole('button', { name: /send request/i }).click();

    await patient.goto('/demo');
    await patient.getByRole('button', { name: /Continue as Maria Lopez/i }).click();
    await patient.waitForURL('**/patient/visit');
    await patient.getByLabel(/insurance member id/i).fill('AETNA-DEMO-2048');
    await patient.getByRole('button', { name: /submit member id/i }).click();
    await expect(patient.getByRole('status')).toHaveText('Ready');

    await uncertain.goto('/');
    await uncertain.getByRole('button', { name: /Replay uncertain identity/i }).click();
    await expect(uncertain.getByRole('heading', { name: /Identity could not be confirmed/i })).toBeVisible();
    await expect(uncertain.getByText(/No patient information was disclosed/i)).toBeVisible();

    await physician.goto('/demo');
    await physician.getByRole('button', { name: /Continue as Dr\. Maya Chen/i }).click();
    await physician.waitForURL('**/physician/inbox');
    await expect(physician.getByRole('status')).toHaveText('Ready');
    await physician.getByRole('button', { name: /Exceptions \(1\)/i }).click();
    await expect(physician.getByText(/requested · unacknowledged/i)).toBeVisible();
    await physician.getByRole('button', { name: /Acknowledge identity exception/i }).click();
    await expect(physician.getByText(/accepted · acknowledged/i)).toBeVisible();

    await publicContext.close();
    await patientContext.close();
    await uncertainContext.close();
    await physicianContext.close();
  });
});
