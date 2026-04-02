import {initializeWasm} from '@docknetwork/crypto-wasm-ts/lib/index';

const {blockchainService} = require('../blockchain/service');
const {
  getWitnessDetails,
  clearWitnessCache,
  getWitnessCacheTTL,
  setWitnessCacheTTL,
} = require('./bbs-revocation');

const mockAccumulatorResult = {
  accumulated: {bytes: new Uint8Array([1, 2, 3])},
  keyRef: ['key1', 1],
  lastModified: 100,
};

const mockPublicKeyResult = {
  bytes: new Uint8Array([4, 5, 6]),
};

const mockHistoryResult = {
  updates: [{id: {toString: () => '1'}}],
};

const createCredential = (statusId = 'dock:accumulator:test-registry-1') => ({
  credentialStatus: {
    id: statusId,
    revocationId: '42',
  },
});

const membershipWitness = JSON.stringify({
  witness: '0xaabbcc',
  blockNo: '1',
});

describe('bbs-revocation witness cache', () => {
  let originalModules;
  let originalGetTypes;

  beforeAll(async () => {
    await initializeWasm();
    originalModules = blockchainService.modules;
    originalGetTypes = blockchainService.getTypesForDIDOrAccumulator;
  });

  afterAll(() => {
    blockchainService.modules = originalModules;
    blockchainService.getTypesForDIDOrAccumulator = originalGetTypes;
  });

  beforeEach(() => {
    clearWitnessCache();
    setWitnessCacheTTL(120_000); // Enable cache for unit tests

    blockchainService.modules = {
      accumulator: {
        getAccumulator: jest.fn().mockResolvedValue(mockAccumulatorResult),
        getPublicKey: jest.fn().mockResolvedValue(mockPublicKeyResult),
        accumulatorHistory: jest.fn().mockResolvedValue(mockHistoryResult),
      },
    };

    blockchainService.getTypesForDIDOrAccumulator = jest.fn().mockReturnValue({
      AccumulatorId: {from: jest.fn().mockReturnValue('acc-id')},
    });
  });

  it('should call blockchain on first request', async () => {
    const credential = createCredential();
    await getWitnessDetails(credential, membershipWitness);

    expect(
      blockchainService.modules.accumulator.getAccumulator,
    ).toHaveBeenCalledTimes(1);
    expect(
      blockchainService.modules.accumulator.getPublicKey,
    ).toHaveBeenCalledTimes(1);
  });

  it('should return cached result on second call with same credential', async () => {
    const credential = createCredential();

    const result1 = await getWitnessDetails(credential, membershipWitness);
    const result2 = await getWitnessDetails(credential, membershipWitness);

    expect(result1).toEqual(result2);
    expect(
      blockchainService.modules.accumulator.getAccumulator,
    ).toHaveBeenCalledTimes(1);
    expect(
      blockchainService.modules.accumulator.getPublicKey,
    ).toHaveBeenCalledTimes(1);
  });

  it('should not share cache between different credentials', async () => {
    const credential1 = createCredential('dock:accumulator:registry-1');
    const credential2 = createCredential('dock:accumulator:registry-2');

    await getWitnessDetails(credential1, membershipWitness);
    await getWitnessDetails(credential2, membershipWitness);

    expect(
      blockchainService.modules.accumulator.getAccumulator,
    ).toHaveBeenCalledTimes(2);
  });

  it('should refresh cache after TTL expires', async () => {
    const credential = createCredential();
    const originalTTL = getWitnessCacheTTL();

    await getWitnessDetails(credential, membershipWitness);

    setWitnessCacheTTL(0); // expire immediately

    await getWitnessDetails(credential, membershipWitness);

    expect(
      blockchainService.modules.accumulator.getAccumulator,
    ).toHaveBeenCalledTimes(2);

    setWitnessCacheTTL(originalTTL);
  });

  it('should clear cache when clearWitnessCache is called', async () => {
    const credential = createCredential();

    await getWitnessDetails(credential, membershipWitness);
    clearWitnessCache();
    await getWitnessDetails(credential, membershipWitness);

    expect(
      blockchainService.modules.accumulator.getAccumulator,
    ).toHaveBeenCalledTimes(2);
  });

  it('should bypass cache when credential has no credentialStatus.id', async () => {
    const credential = {credentialStatus: {id: undefined, revocationId: '42'}};

    await getWitnessDetails(credential, membershipWitness);
    await getWitnessDetails(credential, membershipWitness);

    expect(
      blockchainService.modules.accumulator.getAccumulator,
    ).toHaveBeenCalledTimes(2);
  });
});
