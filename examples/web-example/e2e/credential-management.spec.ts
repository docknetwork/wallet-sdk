import { test, expect } from '@playwright/test';

// You'll need to provide this URL for testing
const TEST_CREDENTIAL_URL = 'openid-credential-offer://?credential_offer_uri=https://api-staging.dock.io/openid/credential-offers/6b873dcc-2e20-476f-a800-b21422d9921a';

test.describe('Credential Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Clear localStorage and create a new wallet with DID
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Create new wallet
    await page.getByTestId('create-wallet-button').click();
    await page.waitForSelector('.App-header:has-text("Truvera Demo Web Wallet")', { timeout: 30000 });

    // Wait for default DID to be created automatically
    await page.waitForSelector('.did-value', { timeout: 30000 });
  });

  test('should open import credential modal', async ({ page }) => {
    await page.getByTestId('import-credential-button').click();

    // Modal should be visible
    await expect(page.getByRole('heading', { name: 'Import Credential' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter credential offer URL')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
  });

  test('should validate credential URL format', async ({ page }) => {
    // Wait a bit longer for credential provider to be ready
    await page.waitForTimeout(2000);

    await page.getByTestId('import-credential-button').click();

    // Enter invalid URL
    await page.getByPlaceholder('Enter credential offer URL').fill('https://invalid-url.com');

    // Set up dialog handler and click import
    let dialogMessage = '';
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.getByRole('button', { name: 'Import' }).click({ force: true });

    // Wait for dialog to be handled
    await page.waitForTimeout(1000);

    // Verify the alert message was shown
    expect(dialogMessage).toContain('Invalid credential offer URL');
  });

  test.skip('should import a credential successfully', async ({ page }) => {
    // Skip this test by default as it requires a real credential URL
    // Remove .skip and provide TEST_CREDENTIAL_URL env var to run

    await page.getByTestId('import-credential-button').click();

    // Enter credential URL
    await page.getByPlaceholder('Enter credential offer URL').fill(TEST_CREDENTIAL_URL);
    await page.getByRole('button', { name: 'Import' }).click();

    // Wait for import to complete and modal to close
    await page.waitForSelector('role=heading[name="Import Credential"]', { state: 'hidden', timeout: 30000 });

    // Should show the imported credential
    const credentialElements = await page.locator('.credential-card').count();
    expect(credentialElements).toBeGreaterThan(0);
  });

  // test('should open verify credential modal', async ({ page }) => {
  //   await page.getByRole('button', { name: 'Verify Credential' }).click();
    
  //   // Step 1: Should show proof request URL input
  //   await expect(page.getByRole('heading', { name: 'Verify Credential' })).toBeVisible();
  //   await expect(page.getByLabel('Proof Request URL')).toBeVisible();
  //   await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
    
  //   // Next button should be disabled without URL
  //   await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    
  //   // Enter URL and proceed
  //   await page.getByLabel('Proof Request URL').fill(TEST_PROOF_REQUEST_URL);
  //   await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  // });

  // test('should navigate verify credential flow', async ({ page }) => {
  //   // First, we need to have at least one credential
  //   // For this test, we'll check the flow without actual credentials
    
  //   await page.getByRole('button', { name: 'Verify Credential' }).click();
    
  //   // Step 1: Enter proof request URL
  //   await page.getByLabel('Proof Request URL').fill(TEST_PROOF_REQUEST_URL);
  //   await page.getByRole('button', { name: 'Next' }).click();
    
  //   // Step 2: Should show credential selection
  //   await expect(page.getByRole('heading', { name: 'Select Credential to Present' })).toBeVisible();
  //   await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  //   await expect(page.getByRole('button', { name: 'Verify' })).toBeVisible();
    
  //   // Verify button should be disabled without selection
  //   await expect(page.getByRole('button', { name: 'Verify' })).toBeDisabled();
    
  //   // Can navigate back
  //   await page.getByRole('button', { name: 'Back' }).click();
  //   await expect(page.getByRole('heading', { name: 'Verify Credential' })).toBeVisible();
  //   await expect(page.getByLabel('Proof Request URL')).toBeVisible();
  // });

  // test('should refresh credentials list', async ({ page }) => {
  //   // Click refresh button
  //   await page.getByRole('button', { name: 'Refresh' }).click();
    
  //   // Should not show any errors
  //   await expect(page.locator('.App-header')).toBeVisible();
    
  //   // The button should remain clickable
  //   await expect(page.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  // });

  test('should fetch messages', async ({ page }) => {
    // Click Fetch Messages button
    await page.getByTestId('fetch-messages-button').click();

    // Should not show any errors
    await expect(page.locator('.did-value')).toBeVisible();

    // The button should remain clickable
    await expect(page.getByTestId('fetch-messages-button')).toBeEnabled();
  });

  test('should copy DID to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Get the DID text from the did-value element
    const did = await page.locator('.did-value').textContent();
    
    // Click copy button
    await page.getByTestId('copy-did-button').click();
    
    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(did);
  });
});