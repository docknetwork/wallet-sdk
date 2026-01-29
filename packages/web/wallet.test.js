const { test, expect } = require('@playwright/test');

/**
 * Wallet SDK End-to-End Tests
 *
 * These tests verify core wallet functionality including:
 * - Wallet initialization with mnemonic
 * - DID retrieval
 * - Master key generation and recovery
 */

// Test configuration
const TEST_CONFIG = {
  edvUrl: 'https://edv.dock.io',
  // Note: In a real test environment, you would use a test EDV server
  // and manage test credentials securely
  edvAuthKey: process.env.TEST_EDV_AUTH_KEY,
  networkId: 'testnet',
  // Test mnemonic (12-word BIP39 phrase)
  // WARNING: This is for testing only - never use this in production
  testMnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  // Alternative test mnemonic for key generation tests
  altMnemonic: 'original there settle romance crazy fringe session wage despair medal bleak need',
};

test.describe('Wallet SDK - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto('http://localhost:8080/test.html');

    // Wait for the SDK to load
    await page.waitForSelector('#status:has-text("Ready")');

    // Verify SDK is available
    const sdkLoaded = await page.evaluate(() => {
      return typeof window.WalletSDK !== 'undefined' &&
             typeof window.WalletSDK.initialize === 'function';
    });

    expect(sdkLoaded).toBe(true);
  });

  test('should have WalletSDK available globally', async ({ page }) => {
    const sdkMethods = await page.evaluate(() => {
      return {
        hasInitialize: typeof window.WalletSDK.initialize === 'function',
        hasGenerateKey: typeof window.WalletSDK.generateCloudWalletMasterKey === 'function',
        hasRecoverKey: typeof window.WalletSDK.recoverCloudWalletMasterKey === 'function',
        hasCreateDataStore: typeof window.WalletSDK.createDataStore === 'function',
        hasCreateWallet: typeof window.WalletSDK.createWallet === 'function',
      };
    });

    expect(sdkMethods.hasInitialize).toBe(true);
    expect(sdkMethods.hasGenerateKey).toBe(true);
    expect(sdkMethods.hasRecoverKey).toBe(true);
    expect(sdkMethods.hasCreateDataStore).toBe(true);
    expect(sdkMethods.hasCreateWallet).toBe(true);
  });

  test('should generate a new master key', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const masterKey = await window.WalletSDK.generateCloudWalletMasterKey();

        return {
          success: true,
          hasMasterKey: !!masterKey,
          hasPublicKey: !!masterKey.publicKey,
          hasPrivateKey: !!masterKey.privateKey,
          hasMnemonic: !!masterKey.mnemonic,
          mnemonicWordCount: masterKey.mnemonic ? masterKey.mnemonic.split(' ').length : 0,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasMasterKey).toBe(true);
    expect(result.hasPublicKey).toBe(true);
    expect(result.hasPrivateKey).toBe(true);
    expect(result.hasMnemonic).toBe(true);
    expect(result.mnemonicWordCount).toBe(12); // BIP39 standard 12-word mnemonic
  });

  test('should recover master key from mnemonic phrase', async ({ page }) => {
    const result = await page.evaluate(async (mnemonic) => {
      try {
        const masterKey = await window.WalletSDK.recoverCloudWalletMasterKey(mnemonic);

        return {
          success: true,
          hasMasterKey: !!masterKey,
          hasPublicKey: !!masterKey.publicKey,
          hasPrivateKey: !!masterKey.privateKey,
          publicKeyType: typeof masterKey.publicKey,
          privateKeyType: typeof masterKey.privateKey,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    }, TEST_CONFIG.testMnemonic);

    expect(result.success).toBe(true);
    expect(result.hasMasterKey).toBe(true);
    expect(result.hasPublicKey).toBe(true);
    expect(result.hasPrivateKey).toBe(true);
  });

  test('should recover same master key from same mnemonic consistently', async ({ page }) => {
    const result = await page.evaluate(async (mnemonic) => {
      try {
        const masterKey1 = await window.WalletSDK.recoverCloudWalletMasterKey(mnemonic);
        const masterKey2 = await window.WalletSDK.recoverCloudWalletMasterKey(mnemonic);

        return {
          success: true,
          keysMatch: JSON.stringify(masterKey1) === JSON.stringify(masterKey2),
          publicKeysMatch: masterKey1.publicKey === masterKey2.publicKey,
          privateKeysMatch: masterKey1.privateKey === masterKey2.privateKey,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    }, TEST_CONFIG.testMnemonic);

    expect(result.success).toBe(true);
    expect(result.keysMatch).toBe(true);
    expect(result.publicKeysMatch).toBe(true);
    expect(result.privateKeysMatch).toBe(true);
  });

  test('should initialize wallet with mnemonic', async ({ page }) => {
    // Skip this test if no auth key is provided
    if (TEST_CONFIG.edvAuthKey === 'test-auth-key-placeholder') {
      test.skip();
      return;
    }

    const result = await page.evaluate(async (config) => {
      try {
        const wallet = await window.WalletSDK.initialize({
          edvUrl: config.edvUrl,
          edvAuthKey: config.edvAuthKey,
          mnemonic: config.mnemonic,
          networkId: config.networkId,
          databasePath: 'test-wallet-' + Date.now(), // Unique DB for each test
        });

        return {
          success: true,
          hasWallet: !!wallet,
          hasGetCredentials: typeof wallet.getCredentials === 'function',
          hasAddCredential: typeof wallet.addCredential === 'function',
          hasGetDID: typeof wallet.getDID === 'function',
          hasSubmitPresentation: typeof wallet.submitPresentation === 'function',
          hasCloudWallet: !!wallet.cloudWallet,
          hasDidProvider: !!wallet.didProvider,
          hasCredentialProvider: !!wallet.credentialProvider,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    }, TEST_CONFIG);

    expect(result.success).toBe(true);
    expect(result.hasWallet).toBe(true);
    expect(result.hasGetCredentials).toBe(true);
    expect(result.hasAddCredential).toBe(true);
    expect(result.hasGetDID).toBe(true);
    expect(result.hasSubmitPresentation).toBe(true);
    expect(result.hasCloudWallet).toBe(true);
    expect(result.hasDidProvider).toBe(true);
    expect(result.hasCredentialProvider).toBe(true);
  });

  test('should retrieve wallet DID after initialization', async ({ page }) => {
    // Skip this test if no auth key is provided
    if (TEST_CONFIG.edvAuthKey === 'test-auth-key-placeholder') {
      test.skip();
      return;
    }

    const result = await page.evaluate(async (config) => {
      try {
        const wallet = await window.WalletSDK.initialize({
          edvUrl: config.edvUrl,
          edvAuthKey: config.edvAuthKey,
          mnemonic: config.mnemonic,
          networkId: config.networkId,
          databasePath: 'test-wallet-did-' + Date.now(),
        });

        const did = await wallet.getDID();

        return {
          success: true,
          hasDID: !!did,
          didType: typeof did,
          didStartsWithDid: did.startsWith('did:'),
          didValue: did,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    }, TEST_CONFIG);

    expect(result.success).toBe(true);
    expect(result.hasDID).toBe(true);
    expect(result.didType).toBe('string');
    expect(result.didStartsWithDid).toBe(true);
  });

  test('should retrieve empty credentials list from new wallet', async ({ page }) => {
    // Skip this test if no auth key is provided
    if (TEST_CONFIG.edvAuthKey === 'test-auth-key-placeholder') {
      test.skip();
      return;
    }

    const result = await page.evaluate(async (config) => {
      try {
        const wallet = await window.WalletSDK.initialize({
          edvUrl: config.edvUrl,
          edvAuthKey: config.edvAuthKey,
          mnemonic: config.mnemonic,
          networkId: config.networkId,
          databasePath: 'test-wallet-creds-' + Date.now(),
        });

        const credentials = await wallet.getCredentials();

        return {
          success: true,
          hasCredentials: !!credentials,
          isArray: Array.isArray(credentials),
          credentialCount: credentials.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    }, TEST_CONFIG);

    expect(result.success).toBe(true);
    expect(result.hasCredentials).toBe(true);
    expect(result.isArray).toBe(true);
    expect(result.credentialCount).toBeGreaterThanOrEqual(0);
  });

  test('should throw error when initializing without required parameters', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        await window.WalletSDK.initialize({
          // Missing required parameters
        });

        return {
          success: true,
          shouldNotReachHere: true,
        };
      } catch (error) {
        return {
          success: false,
          caughtError: true,
          errorMessage: error.message,
          hasInitializationFailedMessage: error.message.includes('Initialization failed'),
        };
      }
    });

    expect(result.success).toBe(false);
    expect(result.caughtError).toBe(true);
    expect(result.hasInitializationFailedMessage).toBe(true);
  });

  test('should throw error when networkId is invalid', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        await window.WalletSDK.initialize({
          edvUrl: 'https://edv.dock.io',
          edvAuthKey: 'test-key',
          mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
          networkId: 'invalid-network', // Invalid network
        });

        return {
          success: true,
          shouldNotReachHere: true,
        };
      } catch (error) {
        return {
          success: false,
          caughtError: true,
          errorMessage: error.message,
          hasInvalidNetworkMessage: error.message.includes('Invalid networkId'),
        };
      }
    });

    expect(result.success).toBe(false);
    expect(result.caughtError).toBe(true);
    expect(result.hasInvalidNetworkMessage).toBe(true);
  });

  test('should throw error when both masterKey and mnemonic are provided', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        await window.WalletSDK.initialize({
          edvUrl: 'https://edv.dock.io',
          edvAuthKey: 'test-key',
          masterKey: { publicKey: 'test', privateKey: 'test' },
          mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
          networkId: 'testnet',
        });

        return {
          success: true,
          shouldNotReachHere: true,
        };
      } catch (error) {
        return {
          success: false,
          caughtError: true,
          errorMessage: error.message,
          hasBothProvidedMessage: error.message.includes('Cannot provide both'),
        };
      }
    });

    expect(result.success).toBe(false);
    expect(result.caughtError).toBe(true);
    expect(result.hasBothProvidedMessage).toBe(true);
  });

  test('should generate different master keys on each call', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const masterKey1 = await window.WalletSDK.generateCloudWalletMasterKey();
        const masterKey2 = await window.WalletSDK.generateCloudWalletMasterKey();

        return {
          success: true,
          keysDifferent: JSON.stringify(masterKey1) !== JSON.stringify(masterKey2),
          mnemonicsDifferent: masterKey1.mnemonic !== masterKey2.mnemonic,
          publicKeysDifferent: masterKey1.publicKey !== masterKey2.publicKey,
          privateKeysDifferent: masterKey1.privateKey !== masterKey2.privateKey,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.keysDifferent).toBe(true);
    expect(result.mnemonicsDifferent).toBe(true);
    expect(result.publicKeysDifferent).toBe(true);
    expect(result.privateKeysDifferent).toBe(true);
  });

  test('should generate different keys from different mnemonics', async ({ page }) => {
    const result = await page.evaluate(async (config) => {
      try {
        const masterKey1 = await window.WalletSDK.recoverCloudWalletMasterKey(config.testMnemonic);
        const masterKey2 = await window.WalletSDK.recoverCloudWalletMasterKey(config.altMnemonic);

        return {
          success: true,
          keysDifferent: JSON.stringify(masterKey1) !== JSON.stringify(masterKey2),
          publicKeysDifferent: masterKey1.publicKey !== masterKey2.publicKey,
          privateKeysDifferent: masterKey1.privateKey !== masterKey2.privateKey,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    }, TEST_CONFIG);

    expect(result.success).toBe(true);
    expect(result.keysDifferent).toBe(true);
    expect(result.publicKeysDifferent).toBe(true);
    expect(result.privateKeysDifferent).toBe(true);
  });
});

test.describe('Wallet SDK - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080/test.html');
    await page.waitForSelector('#status:has-text("Ready")');
  });

  test('should handle invalid mnemonic gracefully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        await window.WalletSDK.recoverCloudWalletMasterKey('invalid mnemonic phrase');

        return {
          success: true,
          shouldNotReachHere: true,
        };
      } catch (error) {
        return {
          success: false,
          caughtError: true,
          errorMessage: error.message,
        };
      }
    });

    expect(result.success).toBe(false);
    expect(result.caughtError).toBe(true);
  });

  test('should validate edvUrl parameter', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        await window.WalletSDK.initialize({
          edvUrl: '', // Empty string
          edvAuthKey: 'test-key',
          mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
          networkId: 'testnet',
        });

        return {
          success: true,
          shouldNotReachHere: true,
        };
      } catch (error) {
        return {
          success: false,
          caughtError: true,
          errorMessage: error.message,
          hasEdvUrlMessage: error.message.toLowerCase().includes('edvurl'),
        };
      }
    });

    expect(result.success).toBe(false);
    expect(result.caughtError).toBe(true);
    expect(result.hasEdvUrlMessage).toBe(true);
  });
});
