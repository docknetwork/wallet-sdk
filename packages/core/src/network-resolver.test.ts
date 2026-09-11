import {createWallet, IWallet} from './wallet';
import {
  credentialResolver,
  dockDocumentNetworkResolver,
  proofRequestResolver,
  resolveApiNetwork,
} from './network-resolver';
import {createDataStore} from '@docknetwork/wallet-sdk-data-store-typeorm/src';

describe('Wallet', () => {
  let wallet: IWallet;

  beforeEach(async () => {
    wallet = await createWallet({
      dataStore: await createDataStore({
        databasePath: ':memory:',
        documentNetworkResolver: dockDocumentNetworkResolver,
      }),
    });
  });

  it('resolveApiNetwork', () => {
    expect(
      resolveApiNetwork({
        url: 'https://creds-example.dock.io/proof/0bb39274-4ef1-4e7f-ab8d-d91d8926d9af',
        dataStore: wallet.dataStore,
      }),
    ).toBe('testnet');

    expect(
      resolveApiNetwork({
        url: 'https://creds.dock.io/proof/0bb39274-4ef1-4e7f-ab8d-d91d8926d9af',
        dataStore: wallet.dataStore,
      }),
    ).toBe('mainnet');
  });

  it('expect to add document to mainnet', async () => {
    const mockDocument = {
      id: 'test',
      type: 'VerifiableCredential',
    };

    await wallet.addDocument(mockDocument);

    const [result] = await wallet.getDocumentsByType(mockDocument.type);
    expect(result.id).toEqual(mockDocument.id);
  });

  it('expect to add document to testnet', async () => {
    const mockDocument = {
      id: 'test',
      type: 'VerifiableCredential',
    };

    wallet.setNetwork('testnet');

    await wallet.addDocument(mockDocument);

    const [result] = await wallet.getDocumentsByType(mockDocument.type);
    expect(result.id).toEqual(mockDocument.id);

    wallet.setNetwork('mainnet');

    const [result2] = await wallet.getDocumentsByType(mockDocument.type);
    expect(result2).toBeUndefined();
  });

  it('expect to allow adding using the same document id in different networks', async () => {
    const mockDocument = {
      id: 'test',
      type: 'VerifiableCredential',
    };

    wallet.setNetwork('mainnet');

    await wallet.addDocument(mockDocument);

    let [result] = await wallet.getDocumentsByType(mockDocument.type);
    expect(result.id).toEqual(mockDocument.id);

    wallet.setNetwork('testnet');

    await wallet.addDocument(mockDocument);
  });

  it('expect to filter documents by network', async () => {
    const mockDocument = {
      id: 'test',
      type: 'VerifiableCredential',
    };

    wallet.setNetwork('mainnet');

    await wallet.addDocument(mockDocument);

    let [result] = await wallet.getDocumentsByType(mockDocument.type);
    expect(result.id).toEqual(mockDocument.id);

    wallet.setNetwork('testnet');

    [result] = await wallet.getDocumentsByType(mockDocument.type);
    expect(result).toBeUndefined();
  });

  describe('credentialResolver', () => {
    it('expect to resolve credential to testnet', async () => {
      const result = await credentialResolver({
        document: {
          id: 'https://creds-example.dock.io/d39b15fe997004db702c9faaf98f9fd619cdf40088549648fb288ea679b53e23?_ga=2.46968743.1402343540.1684360698-1482908456.1677577177',
          type: ['VerifiableCredential'],
        },
        dataStore: wallet.dataStore,
      });

      expect(result).toBe('testnet');
    });
  });

  describe('proofRequestResolver', () => {
    it('should detect a testnet proof request', async () => {
      let result = await dockDocumentNetworkResolver({
        document: {
          qr: 'https://creds-testnet.dock.io/proof/4970377a-6283-46d8-b95e-db99b011e48c',
          id: '4970377a-6283-46d8-b95e-db99b011e48c',
          response_url:
            'https://api-testnet.dock.io/proof-requests/4970377a-6283-46d8-b95e-db99b011e48c/send-presentation',
          type: 'proof-request',
        },
        dataStore: wallet.dataStore,
      });

      expect(result.networkId).toBe('testnet');
      expect(result.resolver).toBe(proofRequestResolver);

      result = await dockDocumentNetworkResolver({
        document: {
          qr: 'https://creds-testnet.dock.io/proof/4970377a-6283-46d8-b95e-db99b011e48c',
          id: '4970377a-6283-46d8-b95e-db99b011e48c',
          response_url:
            'https://api-testnet.dock.io/proof-requests/4970377a-6283-46d8-b95e-db99b011e48c/send-presentation',
          type: 'proof-request',
        },
        dataStore: wallet.dataStore,
      });

      expect(result.networkId).toBe('testnet');
    });

    it('should detect a mainnet proof request', async () => {
      const result = await dockDocumentNetworkResolver({
        document: {
          qr: 'https://creds.dock.io/proof/4970377a-6283-46d8-b95e-db99b011e48c',
          id: '4970377a-6283-46d8-b95e-db99b011e48c',
          response_url:
            'https://api-testnet.dock.io/proof-requests/4970377a-6283-46d8-b95e-db99b011e48c/send-presentation',
          type: 'proof-request',
        },
        dataStore: wallet.dataStore,
      });

      expect(result.networkId).toBe('mainnet');
      expect(result.resolver).toBe(proofRequestResolver);
    });

    it('should fallback to current network', async () => {
      await wallet.setNetwork('mainnet');

      const result = await dockDocumentNetworkResolver({
        document: {
          qr: 'https://something.dock.io/proof/4970377a-6283-46d8-b95e-db99b011e48c',
          id: '4970377a-6283-46d8-b95e-db99b011e48c',
          response_url:
            'https://something.dock.io/proof-requests/4970377a-6283-46d8-b95e-db99b011e48c/send-presentation',
          type: 'proof-request',
        },
        dataStore: wallet.dataStore,
      });

      expect(result.networkId).toBe('mainnet');
      expect(result.isFallback).toBe(true);
    });
  });
});
