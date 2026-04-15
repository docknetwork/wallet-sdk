const EventEmitter = require('events');
const {
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
  initializeCloudWallet,
  derivePasskeyVaultKeys,
  derivePasskeyEncryptionKey,
  initializePasskeyKeyMappingVault,
  enrollUserWithPasskey,
  authenticateWithPasskey,
  initializeCloudWalletWithPasskey,
  PASSKEY_KEY_MAPPING_TYPE,
} = require('./cloud-wallet');

const mockInitializeFromMasterKey = jest.fn().mockResolvedValue(undefined);
const mockInitializeFromMnemonic = jest.fn().mockResolvedValue(undefined);
const mockFind = jest.fn().mockResolvedValue({documents: []});
const mockDeriveBiometricKey = jest.fn().mockReturnValue(Buffer.alloc(32));
const mockDeriveKeys = jest.fn().mockResolvedValue({
  hmacKey: 'mock-hmac',
  agreementKey: 'mock-agreement',
  verificationKey: 'mock-verification',
});
const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockDeriveBiometricEncryptionKey = jest.fn().mockResolvedValue({
  key: Buffer.alloc(32),
  iv: Buffer.alloc(16),
});
const mockEncryptMasterKey = jest
  .fn()
  .mockResolvedValue(new Uint8Array([99, 99]));
const mockDecryptMasterKey = jest
  .fn()
  .mockResolvedValue(new Uint8Array([1, 2, 3]));
const mockGetController = jest.fn().mockResolvedValue('mock-controller');
const mockInsert = jest.fn().mockResolvedValue(undefined);

jest.mock('@docknetwork/wallet-sdk-wasm/src/services/edv', () => ({
  edvService: {
    initializeFromMasterKey: (...args) => mockInitializeFromMasterKey(...args),
    initializeFromMnemonic: (...args) => mockInitializeFromMnemonic(...args),
    find: (...args) => mockFind(...args),
    deriveBiometricKey: (...args) => mockDeriveBiometricKey(...args),
    deriveKeys: (...args) => mockDeriveKeys(...args),
    initialize: (...args) => mockInitialize(...args),
    deriveBiometricEncryptionKey: (...args) =>
      mockDeriveBiometricEncryptionKey(...args),
    encryptMasterKey: (...args) => mockEncryptMasterKey(...args),
    decryptMasterKey: (...args) => mockDecryptMasterKey(...args),
    getController: (...args) => mockGetController(...args),
    insert: (...args) => mockInsert(...args),
  },
}));

const mockMnemonicGenerate = jest.fn();
const mockMnemonicToMiniSecret = jest.fn();

jest.mock('@docknetwork/wallet-sdk-wasm/src/services/util-crypto', () => ({
  utilCryptoService: {
    mnemonicGenerate: (...args) => mockMnemonicGenerate(...args),
    mnemonicToMiniSecret: (...args) => mockMnemonicToMiniSecret(...args),
  },
}));

function createMockDataStore() {
  return {
    events: new EventEmitter(),
    documents: {
      getDocumentById: jest.fn(),
      addDocument: jest.fn(),
      removeDocument: jest.fn(),
      updateDocument: jest.fn(),
      getAllDocuments: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('cloud-wallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCloudWalletMasterKey', () => {
    it('should generate a mnemonic and master key', async () => {
      const mockMnemonic =
        'test mnemonic phrase with twelve words one two three four five six';
      const mockMasterKey = new Uint8Array([1, 2, 3, 4]);

      mockMnemonicGenerate.mockResolvedValue(mockMnemonic);
      mockMnemonicToMiniSecret.mockResolvedValue(mockMasterKey);

      const result = await generateCloudWalletMasterKey();

      expect(result.mnemonic).toBe(mockMnemonic);
      expect(result.masterKey).toBeInstanceOf(Uint8Array);
      expect(result.masterKey).toEqual(mockMasterKey);
    });

    it('should convert plain object to Uint8Array when JSON-RPC serialization occurs', async () => {
      const mockMnemonic = 'test mnemonic';
      const serializedKey = {0: 10, 1: 20, 2: 30};

      mockMnemonicGenerate.mockResolvedValue(mockMnemonic);
      mockMnemonicToMiniSecret.mockResolvedValue(serializedKey);

      const result = await generateCloudWalletMasterKey();

      expect(result.masterKey).toBeInstanceOf(Uint8Array);
      expect(result.masterKey).toEqual(new Uint8Array([10, 20, 30]));
    });
  });

  describe('recoverCloudWalletMasterKey', () => {
    it('should recover master key from mnemonic', async () => {
      const mockMasterKey = new Uint8Array([5, 6, 7, 8]);
      mockMnemonicToMiniSecret.mockResolvedValue(mockMasterKey);

      const result = await recoverCloudWalletMasterKey('test mnemonic');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result).toEqual(mockMasterKey);
      expect(mockMnemonicToMiniSecret).toHaveBeenCalledWith('test mnemonic');
    });

    it('should convert plain object to Uint8Array when JSON-RPC serialization occurs', async () => {
      const serializedKey = {0: 100, 1: 200};
      mockMnemonicToMiniSecret.mockResolvedValue(serializedKey);

      const result = await recoverCloudWalletMasterKey('test mnemonic');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result).toEqual(new Uint8Array([100, 200]));
    });
  });

  describe('initializeCloudWallet', () => {
    const edvUrl = 'https://edv.example.com';
    const authKey = 'test-auth-key';

    it('should use masterKey when both masterKey and mnemonic are provided', async () => {
      const masterKey = new Uint8Array([1, 2, 3]);
      const dataStore = createMockDataStore();

      await initializeCloudWallet({
        dataStore,
        edvUrl,
        authKey,
        masterKey,
        mnemonic: 'should be ignored',
      });

      expect(mockInitializeFromMasterKey).toHaveBeenCalledWith({
        masterKey,
        edvUrl,
        authKey,
      });
      expect(mockInitializeFromMnemonic).not.toHaveBeenCalled();
    });

    it('should use mnemonic when masterKey is not provided', async () => {
      const mnemonic = 'test mnemonic phrase';
      const dataStore = createMockDataStore();

      await initializeCloudWallet({
        dataStore,
        edvUrl,
        authKey,
        mnemonic,
      });

      expect(mockInitializeFromMnemonic).toHaveBeenCalledWith({
        mnemonic,
        edvUrl,
        authKey,
      });
      expect(mockInitializeFromMasterKey).not.toHaveBeenCalled();
    });

    it('should throw when neither masterKey nor mnemonic is provided', async () => {
      const dataStore = createMockDataStore();

      await expect(
        initializeCloudWallet({dataStore, edvUrl, authKey}),
      ).rejects.toThrow('Either masterKey or mnemonic is required');
    });
  });

  describe('passkey functions', () => {
    const edvUrl = 'https://edv.example.com';
    const authKey = 'test-auth-key';
    const prfOutput = new Uint8Array(32).fill(42);
    const identifier = 'user@example.com';

    describe('derivePasskeyVaultKeys', () => {
      it('should derive vault keys from PRF output and identifier', async () => {
        const result = await derivePasskeyVaultKeys(prfOutput, identifier);

        expect(mockDeriveBiometricKey).toHaveBeenCalledWith(
          expect.any(Buffer),
          identifier,
        );
        expect(mockDeriveKeys).toHaveBeenCalled();
        expect(result).toEqual({
          hmacKey: 'mock-hmac',
          agreementKey: 'mock-agreement',
          verificationKey: 'mock-verification',
        });
      });

      it('should convert prfOutput to Buffer before calling deriveBiometricKey', async () => {
        await derivePasskeyVaultKeys(prfOutput, identifier);

        const bufferArg = mockDeriveBiometricKey.mock.calls[0][0];
        expect(Buffer.isBuffer(bufferArg)).toBe(true);
        expect(bufferArg).toEqual(Buffer.from(prfOutput));
      });
    });

    describe('derivePasskeyEncryptionKey', () => {
      it('should derive encryption key from PRF output and identifier', async () => {
        const result = await derivePasskeyEncryptionKey(prfOutput, identifier);

        expect(mockDeriveBiometricEncryptionKey).toHaveBeenCalledWith(
          expect.any(Buffer),
          identifier,
        );
        expect(result).toHaveProperty('key');
        expect(result).toHaveProperty('iv');
      });
    });

    describe('initializePasskeyKeyMappingVault', () => {
      it('should initialize the EDV with derived vault keys', async () => {
        await initializePasskeyKeyMappingVault(
          edvUrl,
          authKey,
          prfOutput,
          identifier,
        );

        expect(mockInitialize).toHaveBeenCalledWith({
          hmacKey: 'mock-hmac',
          agreementKey: 'mock-agreement',
          verificationKey: 'mock-verification',
          edvUrl,
          authKey,
        });
      });
    });

    describe('enrollUserWithPasskey', () => {
      beforeEach(() => {
        mockMnemonicGenerate.mockResolvedValue('mock mnemonic phrase');
        mockMnemonicToMiniSecret.mockResolvedValue(
          new Uint8Array([1, 2, 3, 4]),
        );
      });

      it('should generate a master key and store it encrypted in the vault', async () => {
        const result = await enrollUserWithPasskey(
          edvUrl,
          authKey,
          prfOutput,
          identifier,
        );

        expect(result.mnemonic).toBe('mock mnemonic phrase');
        expect(result.masterKey).toEqual(new Uint8Array([1, 2, 3, 4]));
      });

      it('should encrypt the master key before storing', async () => {
        await enrollUserWithPasskey(edvUrl, authKey, prfOutput, identifier);

        expect(mockEncryptMasterKey).toHaveBeenCalledWith(
          new Uint8Array([1, 2, 3, 4]),
          expect.any(Buffer),
          expect.any(Buffer),
        );
      });

      it('should insert document with PASSKEY_KEY_MAPPING_TYPE', async () => {
        await enrollUserWithPasskey(edvUrl, authKey, prfOutput, identifier);

        expect(mockInsert).toHaveBeenCalledWith({
          document: {
            content: {
              id: 'mock-controller#master-key',
              type: PASSKEY_KEY_MAPPING_TYPE,
              encryptedKey: expect.objectContaining({
                data: expect.any(Array),
                iv: expect.any(Array),
              }),
            },
          },
        });
      });
    });

    describe('authenticateWithPasskey', () => {
      it('should initialize vault and retrieve decrypted master key', async () => {
        mockFind.mockResolvedValueOnce({
          documents: [
            {
              content: {
                id: 'mock-controller#master-key',
                encryptedKey: {
                  data: [99, 99],
                  iv: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                },
              },
            },
          ],
        });

        const result = await authenticateWithPasskey(
          edvUrl,
          authKey,
          prfOutput,
          identifier,
        );

        expect(mockInitialize).toHaveBeenCalled();
        expect(mockDecryptMasterKey).toHaveBeenCalled();
        expect(result).toEqual(new Uint8Array([1, 2, 3]));
      });

      it('should throw when no key mapping document is found', async () => {
        mockFind.mockResolvedValueOnce({documents: []});

        await expect(
          authenticateWithPasskey(edvUrl, authKey, prfOutput, identifier),
        ).rejects.toThrow('Authentication failed: Invalid identifier');
      });
    });

    describe('initializeCloudWalletWithPasskey', () => {
      it('should authenticate and initialize cloud wallet', async () => {
        mockFind.mockResolvedValueOnce({
          documents: [
            {
              content: {
                id: 'mock-controller#master-key',
                encryptedKey: {
                  data: [99, 99],
                  iv: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                },
              },
            },
          ],
        });

        const dataStore = createMockDataStore();
        await initializeCloudWalletWithPasskey(
          edvUrl,
          authKey,
          prfOutput,
          identifier,
          dataStore,
        );

        expect(mockInitializeFromMasterKey).toHaveBeenCalledWith({
          masterKey: new Uint8Array([1, 2, 3]),
          edvUrl,
          authKey,
        });
      });
    });
  });
});
