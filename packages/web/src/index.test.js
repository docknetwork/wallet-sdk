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
      ).rejects.toThrow('Either masterKey or mnemonic must be provided');
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
  });
});
