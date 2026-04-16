import WalletSDK from './index';

// Track call order
let mockCallOrder;

jest.mock('@docknetwork/wallet-sdk-data-store-web/src/index', () => ({
  createDataStore: jest.fn().mockImplementation(async () => {
    mockCallOrder.push('createDataStore');
    return {mockDataStore: true};
  }),
}));

jest.mock('@docknetwork/wallet-sdk-core/src/cloud-wallet', () => ({
  initializeCloudWallet: jest.fn().mockImplementation(async () => {
    mockCallOrder.push('initializeCloudWallet');
    return {
      pullDocuments: jest.fn().mockImplementation(async () => {
        mockCallOrder.push('pullDocuments');
      }),
    };
  }),
  generateCloudWalletMasterKey: jest.fn(),
  recoverCloudWalletMasterKey: jest.fn().mockImplementation(async () => {
    mockCallOrder.push('recoverCloudWalletMasterKey');
    return 'mock-master-key';
  }),
  enrollUserWithPasskey: jest.fn().mockImplementation(async () => ({
    masterKey: new Uint8Array([1, 2, 3]),
    mnemonic: 'mock passkey mnemonic',
  })),
  authenticateWithPasskey: jest
    .fn()
    .mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

jest.mock('./passkey', () => ({
  checkPasskeySupport: jest
    .fn()
    .mockResolvedValue({webauthn: true, prf: 'unknown'}),
  registerPasskey: jest.fn().mockResolvedValue({
    credentialId: new Uint8Array([10, 20, 30]),
    prfSupported: true,
  }),
  getPasskeyPRFKey: jest.fn().mockResolvedValue({
    prfOutput: new Uint8Array(32).fill(42),
    credentialId: new Uint8Array([10, 20, 30]),
  }),
  credentialIdToBase64url: jest.fn().mockReturnValue('ChQe'),
  base64urlToCredentialId: jest
    .fn()
    .mockReturnValue(new Uint8Array([10, 20, 30])),
}));

jest.mock('@docknetwork/wallet-sdk-core/src/wallet', () => ({
  createWallet: jest.fn().mockImplementation(async () => {
    mockCallOrder.push('createWallet');
    return {mockWallet: true};
  }),
}));

jest.mock('@docknetwork/wallet-sdk-core/src/credential-provider', () => ({
  createCredentialProvider: jest.fn().mockImplementation(async () => {
    mockCallOrder.push('createCredentialProvider');
    return {mockCredentialProvider: true};
  }),
}));

jest.mock('@docknetwork/wallet-sdk-core/src/did-provider', () => ({
  createDIDProvider: jest.fn().mockImplementation(() => {
    mockCallOrder.push('createDIDProvider');
    return {mockDIDProvider: true};
  }),
}));

jest.mock('@docknetwork/wallet-sdk-core/src/message-provider', () => ({
  createMessageProvider: jest.fn().mockImplementation(() => {
    mockCallOrder.push('createMessageProvider');
    return {mockMessageProvider: true};
  }),
}));

jest.mock('@docknetwork/wallet-sdk-core/src/verification-controller', () => ({
  createVerificationController: jest.fn(),
}));

jest.mock('@docknetwork/wallet-sdk-wasm/src/services/blockchain', () => ({
  blockchainService: {ensureBlockchainReady: jest.fn()},
}));

const {
  initializeCloudWallet,
} = require('@docknetwork/wallet-sdk-core/src/cloud-wallet');
const {createWallet} = require('@docknetwork/wallet-sdk-core/src/wallet');

const validConfig = {
  edvUrl: 'https://edv.example.com',
  edvAuthKey: 'test-auth-key',
  mnemonic: 'test mnemonic phrase',
  networkId: 'testnet',
  databasePath: 'test-db',
};

describe('WalletSDK initialize', () => {
  beforeEach(() => {
    mockCallOrder = [];
    jest.clearAllMocks();
  });

  it('should create data store, pull cloud documents, then create wallet', async () => {
    await WalletSDK.initialize(validConfig);

    expect(mockCallOrder).toEqual([
      'createDataStore',
      'recoverCloudWalletMasterKey',
      'initializeCloudWallet',
      'pullDocuments',
      'createWallet',
      'createDIDProvider',
      'createCredentialProvider',
      'createMessageProvider',
    ]);
  });

  it('should pull cloud documents before creating wallet to avoid duplicate DIDs', async () => {
    await WalletSDK.initialize(validConfig);

    const pullIndex = mockCallOrder.indexOf('pullDocuments');
    const walletIndex = mockCallOrder.indexOf('createWallet');

    expect(pullIndex).toBeLessThan(walletIndex);
  });

  it('should create data store before initializing cloud wallet', async () => {
    await WalletSDK.initialize(validConfig);

    const dataStoreIndex = mockCallOrder.indexOf('createDataStore');
    const cloudWalletIndex = mockCallOrder.indexOf('initializeCloudWallet');

    expect(dataStoreIndex).toBeLessThan(cloudWalletIndex);
  });

  it('should pass the data store to cloud wallet initialization', async () => {
    await WalletSDK.initialize(validConfig);

    expect(initializeCloudWallet).toHaveBeenCalledWith({
      dataStore: {mockDataStore: true},
      edvUrl: validConfig.edvUrl,
      masterKey: 'mock-master-key',
      authKey: validConfig.edvAuthKey,
    });
  });

  it('should pass the data store to wallet creation', async () => {
    await WalletSDK.initialize(validConfig);

    expect(createWallet).toHaveBeenCalledWith({
      dataStore: {mockDataStore: true},
    });
  });

  it('should still create wallet if pullDocuments fails', async () => {
    initializeCloudWallet.mockImplementationOnce(async () => {
      mockCallOrder.push('initializeCloudWallet');
      return {
        pullDocuments: jest.fn().mockImplementation(async () => {
          mockCallOrder.push('pullDocuments');
          throw new Error('Network error');
        }),
      };
    });

    const result = await WalletSDK.initialize(validConfig);

    expect(result.wallet).toBeDefined();
    expect(mockCallOrder).toContain('createWallet');
  });

  it('should use masterKey directly when provided instead of mnemonic', async () => {
    await WalletSDK.initialize({
      ...validConfig,
      mnemonic: undefined,
      masterKey: 'direct-master-key',
    });

    expect(mockCallOrder).not.toContain('recoverCloudWalletMasterKey');
    expect(initializeCloudWallet).toHaveBeenCalledWith(
      expect.objectContaining({masterKey: 'direct-master-key'}),
    );
  });

  describe('validation', () => {
    it('should throw when neither masterKey nor mnemonic is provided', async () => {
      await expect(
        WalletSDK.initialize({
          ...validConfig,
          mnemonic: undefined,
          masterKey: undefined,
        }),
      ).rejects.toThrow(
        'Provide one of masterKey, mnemonic, or passkey for wallet access',
      );
    });

    it('should throw when both masterKey and mnemonic are provided', async () => {
      await expect(
        WalletSDK.initialize({
          ...validConfig,
          masterKey: 'some-key',
        }),
      ).rejects.toThrow('Cannot provide both masterKey and mnemonic');
    });

    it('should throw when edvUrl is not provided', async () => {
      await expect(
        WalletSDK.initialize({...validConfig, edvUrl: undefined}),
      ).rejects.toThrow('edvUrl is required');
    });

    it('should throw when edvAuthKey is not provided', async () => {
      await expect(
        WalletSDK.initialize({...validConfig, edvAuthKey: undefined}),
      ).rejects.toThrow('edvAuthKey is required');
    });

    it('should throw when networkId is invalid', async () => {
      await expect(
        WalletSDK.initialize({...validConfig, networkId: 'invalid'}),
      ).rejects.toThrow('networkId is required');
    });

    it('should throw when passkey is combined with masterKey', async () => {
      await expect(
        WalletSDK.initialize({
          ...validConfig,
          mnemonic: undefined,
          masterKey: 'some-key',
          passkey: true,
        }),
      ).rejects.toThrow('Cannot combine passkey with masterKey or mnemonic');
    });

    it('should throw when passkey is combined with mnemonic', async () => {
      await expect(
        WalletSDK.initialize({
          ...validConfig,
          passkey: true,
        }),
      ).rejects.toThrow('Cannot combine passkey with masterKey or mnemonic');
    });
  });

  describe('passkey', () => {
    const {
      authenticateWithPasskey,
      enrollUserWithPasskey,
    } = require('@docknetwork/wallet-sdk-core/src/cloud-wallet');
    const {
      registerPasskey,
      getPasskeyPRFKey,
      base64urlToCredentialId,
    } = require('./passkey');

    const passkeyConfig = {
      edvUrl: 'https://edv.example.com',
      edvAuthKey: 'test-auth-key',
      networkId: 'testnet',
    };

    beforeEach(() => {
      localStorage.clear();
    });

    it('should enroll a new passkey on first use with passkey: true', async () => {
      const result = await WalletSDK.initialize({
        ...passkeyConfig,
        passkey: true,
      });

      expect(registerPasskey).toHaveBeenCalled();
      expect(enrollUserWithPasskey).toHaveBeenCalled();
      expect(result.mnemonic).toBe('mock passkey mnemonic');
    });

    it('should store enrollment data in localStorage after enrollment', async () => {
      await WalletSDK.initialize({
        ...passkeyConfig,
        passkey: true,
      });

      const stored = JSON.parse(localStorage.getItem('truvera-wallet-passkey'));
      expect(stored).toBeTruthy();
      expect(stored.passkeyCredentialId).toBe('ChQe');
      expect(stored.identifier).toBeDefined();
    });

    it('should authenticate with stored passkey on subsequent visits', async () => {
      localStorage.setItem(
        'truvera-wallet-passkey',
        JSON.stringify({
          passkeyCredentialId: 'ChQe',
          identifier: 'localhost',
        }),
      );

      const result = await WalletSDK.initialize({
        ...passkeyConfig,
        passkey: true,
      });

      expect(registerPasskey).not.toHaveBeenCalled();
      expect(enrollUserWithPasskey).not.toHaveBeenCalled();
      expect(authenticateWithPasskey).toHaveBeenCalled();
      expect(result.mnemonic).toBeUndefined();
    });

    it('should use stored identifier for PRF salt consistency on return visits', async () => {
      localStorage.setItem(
        'truvera-wallet-passkey',
        JSON.stringify({
          passkeyCredentialId: 'ChQe',
          identifier: 'user@example.com',
        }),
      );

      await WalletSDK.initialize({
        ...passkeyConfig,
        passkey: true,
      });

      expect(getPasskeyPRFKey).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(Object),
      );
    });

    it('should throw when localStorage has no valid enrollment data', async () => {
      localStorage.setItem('truvera-wallet-passkey', 'invalid-json');

      await expect(
        WalletSDK.initialize({
          ...passkeyConfig,
          passkey: {passkeyCredentialId: null},
        }),
      ).rejects.toThrow('No valid passkey enrollment data found');
    });

    it('should use custom storageKey when provided', async () => {
      await WalletSDK.initialize({
        ...passkeyConfig,
        passkey: {storageKey: 'custom-key'},
      });

      expect(localStorage.getItem('custom-key')).toBeTruthy();
    });

    it('should authenticate directly when passkeyCredentialId is provided', async () => {
      const result = await WalletSDK.initialize({
        ...passkeyConfig,
        passkey: {
          passkeyCredentialId: 'ChQe',
          identifier: 'user@example.com',
        },
      });

      expect(registerPasskey).not.toHaveBeenCalled();
      expect(enrollUserWithPasskey).not.toHaveBeenCalled();
      expect(base64urlToCredentialId).toHaveBeenCalledWith('ChQe');
      expect(getPasskeyPRFKey).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          credentialId: expect.any(Uint8Array),
        }),
      );
      expect(result.mnemonic).toBeUndefined();
    });

    it('should pass custom rpId and rpName during enrollment', async () => {
      await WalletSDK.initialize({
        ...passkeyConfig,
        passkey: {
          rpId: 'example.com',
          rpName: 'My App',
        },
      });

      expect(registerPasskey).toHaveBeenCalledWith(
        expect.any(String),
        'My App',
        'example.com',
      );
    });
  });
});
