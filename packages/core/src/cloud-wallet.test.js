const EventEmitter = require('events');
const {
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
  initializeCloudWallet,
} = require('./cloud-wallet');

const mockInitializeFromMasterKey = jest.fn().mockResolvedValue(undefined);
const mockInitializeFromMnemonic = jest.fn().mockResolvedValue(undefined);
const mockFind = jest.fn().mockResolvedValue({documents: []});

jest.mock('@docknetwork/wallet-sdk-wasm/src/services/edv', () => ({
  edvService: {
    initializeFromMasterKey: (...args) => mockInitializeFromMasterKey(...args),
    initializeFromMnemonic: (...args) => mockInitializeFromMnemonic(...args),
    find: (...args) => mockFind(...args),
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
      const mockMnemonic = 'test mnemonic phrase with twelve words one two three four five six';
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
        initializeCloudWallet({dataStore, edvUrl, authKey})
      ).rejects.toThrow('Either masterKey or mnemonic is required');
    });
  });
});
