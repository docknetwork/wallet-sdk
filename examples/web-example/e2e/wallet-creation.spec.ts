import { test, expect } from '@playwright/test';

test.describe('Wallet Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should create a new wallet successfully', async ({ page }) => {
    // Click create new wallet button
    await page.getByRole('button', { name: 'Create New Wallet' }).click();

    // Wait for wallet creation to complete - check for header
    await page.waitForSelector('.App-header:has-text("Truvera Demo Web Wallet")', { timeout: 30000 });

    // Should show the main app interface
    await expect(page.getByText('Credentials (')).toBeVisible();

    // Should show action buttons
    await expect(page.getByTestId('import-credential-button')).toBeVisible();
    await expect(page.getByTestId('verify-credential-button')).toBeVisible();
    await expect(page.getByTestId('refresh-button')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();

    // Should automatically create and display default DID
    await expect(page.locator('.did-value')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('copy-did-button')).toBeVisible();
    await expect(page.getByTestId('fetch-messages-button')).toBeVisible();

    // Verify wallet keys were stored in localStorage
    const keys = await page.evaluate(() => localStorage.getItem('keys'));
    expect(keys).not.toBeNull();
    const parsedKeys = JSON.parse(keys);
    expect(parsedKeys).toHaveProperty('masterKey');
    expect(parsedKeys).toHaveProperty('mnemonic');
  });

  test('should display default DID after wallet creation', async ({ page }) => {
    // Create new wallet first
    await page.getByRole('button', { name: 'Create New Wallet' }).click();
    await page.waitForSelector('.App-header:has-text("Truvera Demo Web Wallet")', { timeout: 30000 });

    // Wait for DID to be displayed (it's created automatically)
    await page.waitForSelector('.did-value', { timeout: 30000 });

    // Should show the DID
    await expect(page.locator('.did-value')).toBeVisible();

    // Should show Copy button
    await expect(page.getByTestId('copy-did-button')).toBeVisible();

    // Should show Fetch Messages button
    await expect(page.getByTestId('fetch-messages-button')).toBeVisible();

    // The DID should start with 'did:'
    const didText = await page.locator('.did-value').textContent();
    expect(didText).toContain('did:');
  });

  test('should clear wallet data but preserve keys', async ({ page }) => {
    // Create new wallet first
    await page.getByRole('button', { name: 'Create New Wallet' }).click();
    await page.waitForSelector('.App-header:has-text("Truvera Demo Web Wallet")', { timeout: 30000 });

    // Wait for DID to be created
    await page.waitForSelector('.did-value', { timeout: 30000 });

    // Get the wallet keys before clearing
    const keysBefore = await page.evaluate(() => {
      const keys = localStorage.getItem('keys');
      return keys ? JSON.parse(keys) : null;
    });

    // Open settings menu and click Clear Wallet
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitem', { name: 'Clear Wallet' }).click();

    // Page should reload and still show the wallet interface (keys are preserved)
    await page.waitForSelector('.App-header:has-text("Truvera Demo Web Wallet")', { timeout: 10000 });

    // Verify keys are still present and have same values
    const keysAfter = await page.evaluate(() => {
      const keys = localStorage.getItem('keys');
      return keys ? JSON.parse(keys) : null;
    });
    expect(keysAfter).toBeTruthy();
    expect(keysAfter.mnemonic).toBe(keysBefore.mnemonic);
    expect(JSON.stringify(keysAfter.masterKey)).toBe(JSON.stringify(keysBefore.masterKey));

    // Should still be on the wallet page with credentials section
    await expect(page.getByText('Credentials (')).toBeVisible();
  });

  test('should persist wallet after page reload', async ({ page }) => {
    // Create new wallet
    await page.getByRole('button', { name: 'Create New Wallet' }).click();
    await page.waitForSelector('.App-header:has-text("Truvera Demo Web Wallet")', { timeout: 30000 });

    // Reload the page
    await page.reload();

    // Should still show the main app interface (not the setup screen)
    await expect(page.getByText('Credentials (')).toBeVisible();
    await expect(page.getByTestId('import-credential-button')).toBeVisible();
  });
});