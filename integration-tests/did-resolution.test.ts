import {blockchainService} from '@docknetwork/wallet-sdk-wasm/src/services/blockchain';
import {BLOCKCHAIN_NETWORKS} from '@docknetwork/wallet-sdk-wasm/src/modules/network-manager';
import {
  getWallet,
  getDIDProvider,
  closeWallet,
} from './helpers/wallet-helpers';
import { storageService } from '@docknetwork/wallet-sdk-wasm/src/services/storage';

describe('DID resolution', () => {

  it('should resolve did service endpoints', async () => {
    const wallet = await getWallet();
    const currentDID = await getDIDProvider().getDefaultDID();

    const doc1 = await blockchainService.resolveDID(
      'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7',
    );

    const messagingService = doc1.service.find(service => service.type === 'DIDCommMessaging');
    expect(messagingService).toBeDefined();

    const cacheKey = `did-cache:did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7`;
    const cacheJSON = await storageService.getItem(cacheKey);
    expect(cacheJSON).toBeDefined();

    const cachedEntry = JSON.parse(cacheJSON);
    expect(cachedEntry.value).toEqual(doc1);
    expect(cachedEntry.id).toEqual('did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7');

    closeWallet(wallet)
  });

  it('should resolve DID without active blockchain connection (fallback resolver)', async () => {
    const doc1 = await blockchainService.resolveDID(
      'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7',
    );

    const messagingService = doc1.service.find(service => service.type === 'DIDCommMessaging');
    expect(messagingService).toBeDefined();

    const cacheKey = `did-cache:did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7`;
    const cacheJSON = await storageService.getItem(cacheKey);
    expect(cacheJSON).toBeDefined();

    const cachedEntry = JSON.parse(cacheJSON);
    expect(cachedEntry.value).toEqual(doc1);
    expect(cachedEntry.id).toEqual('did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7');
  });
});

describe('BBS+ assertion keys in resolved DID document', () => {
  const did = 'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7';
  const bbsKeyId = `${did}#keys-2`;

  afterAll(async () => {
    await blockchainService.disconnect();
  });

  // BBS+ key must be a proper verificationMethod object (so jsonld.frame can
  // read publicKeyBase58), and assertionMethod must hold only string refs.
  function expectBBSKeyReachable(doc) {
    const bbsMethod = (doc.verificationMethod ?? []).find(
      method => method?.id === bbsKeyId,
    );

    expect(bbsMethod).toBeDefined();
    expect(bbsMethod.type).toEqual('Bls12381BBSVerificationKeyDock2023');
    expect(typeof bbsMethod.publicKeyBase58).toEqual('string');

    for (const entry of doc.assertionMethod ?? []) {
      expect(typeof entry).toEqual('string');
      expect(() => JSON.parse(entry)).toThrow();
    }
  }

  it('should expose BBS+ assertion keys via the fallback (universal) resolver', async () => {
    // No blockchain: the router falls back to the universal resolver.
    const fallbackResolver = blockchainService.createDIDResolver(false);

    await fallbackResolver.clearCache(did);

    const doc = await fallbackResolver.resolve(did);

    expectBBSKeyReachable(doc);
  });

  it('should expose BBS+ assertion keys via the on-chain (blockchain) resolver', async () => {
    // Control: the on-chain path normalises BBS+ keys, so it should pass for
    // the same DID. Connect inline (not beforeAll) to avoid a stray teardown
    // from another describe block disconnecting between setup and resolve.
    await blockchainService.init({
      cheqdApiUrl: BLOCKCHAIN_NETWORKS.testnet.cheqdApiUrl,
      networkId: 'testnet',
    });

    const onChainResolver = blockchainService.createDIDResolver(true);
    await onChainResolver.clearCache(did);

    const doc = await onChainResolver.resolve(did);

    expectBBSKeyReachable(doc);
  }, 30000);
});
