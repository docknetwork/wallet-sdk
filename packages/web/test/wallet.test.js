const {test, expect} = require('@playwright/test');

// Test configuration
const TEST_CONFIG = {
  edvUrl: 'https://edv.dock.io',
  edvAuthKey: process.env.TEST_EDV_AUTH_KEY,
  networkId: 'testnet',
};

test.describe('Wallet SDK', () => {
  test.beforeEach(async ({page}) => {
    // Navigate to test page
    await page.goto('http://localhost:8686/test/test-page.html');

    // Check current status for debugging
    const statusBefore = await page.locator('#status').textContent();
    console.log('Status before waiting:', statusBefore);

    // Wait for the SDK to load with increased timeout
    await page.waitForSelector('#status:has-text("Ready")', {timeout: 60000});
  });

  test('should generate master key, initialize wallet, get DID, and verify empty credentials', async ({
    page,
  }) => {
    const result = await page.evaluate(async config => {
      try {
        // 1. Generate master key with mnemonic
        const {mnemonic} =
          await window.TruveraWebWallet.generateCloudWalletMasterKey();

        // 2. Initialize wallet with the generated mnemonic
        const wallet = await window.TruveraWebWallet.initialize({
          edvUrl: config.edvUrl,
          edvAuthKey: config.edvAuthKey,
          mnemonic: mnemonic,
          networkId: config.networkId,
          databasePath: 'test-wallet-' + Date.now(),
        });

        // 3. Get the wallet DID
        const did = await wallet.getDID();

        // 4. Get credentials list (should be empty for new wallet)
        const credentials = await wallet.getCredentials();

        return {
          success: true,
          mnemonic: mnemonic,
          hasMnemonic: !!mnemonic,
          mnemonicWordCount: mnemonic ? mnemonic.split(' ').length : 0,
          did: did,
          hasDID: !!did,
          didStartsWithDid: did && did.startsWith('did:'),
          credentials: credentials,
          isCredentialsArray: Array.isArray(credentials),
          credentialsCount: credentials ? credentials.length : -1,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack,
        };
      }
    }, TEST_CONFIG);

    // Assertions
    expect(result.success).toBe(true);

    // Verify mnemonic was generated
    expect(result.hasMnemonic).toBe(true);
    expect(result.mnemonicWordCount).toBe(12);

    // Verify DID was retrieved
    expect(result.hasDID).toBe(true);
    expect(result.didStartsWithDid).toBe(true);

    // Verify credentials list is empty array
    expect(result.isCredentialsArray).toBe(true);
    expect(result.credentialsCount).toBe(0);
  });
});
