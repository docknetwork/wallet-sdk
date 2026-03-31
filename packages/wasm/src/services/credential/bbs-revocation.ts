import {
  Accumulator,
  PositiveAccumulator,
  AccumulatorPublicKey,
  dockAccumulatorParams,
  VBMembershipWitness,
  VBWitnessUpdateInfo,
  Encoder,
} from '@docknetwork/crypto-wasm-ts';
// @ts-ignore
import {hexToU8a} from '@docknetwork/credential-sdk/utils';

import {
  blockchainService,
} from '../blockchain/service';

const trimHexID = id => {
  if (id.substr(0, 2) !== '0x') {
    return id;
  }

  return id.substr(2);
};

const blockchainCache = new Map<string, {data: any; timestamp: number}>();
export const WITNESS_CACHE_TTL = 60_000; // 60 seconds

export const clearWitnessCache = () => blockchainCache.clear();

async function fetchBlockchainData(credential, _membershipWitness) {
  let witness = _membershipWitness;
  let blockNo;

  try {
    ({witness, blockNo} = JSON.parse(_membershipWitness));
  } catch (err) {
    console.error(err);
  }

  const {credentialStatus} = credential;
  const registryId = credentialStatus?.id;

  const queriedAccumulator =
    await blockchainService.modules.accumulator.getAccumulator(
      registryId,
      false,
    );

  if (!queriedAccumulator) {
    throw new Error('Accumulator not found');
  }

  const publicKey = await blockchainService.modules.accumulator.getPublicKey(
    queriedAccumulator.keyRef[0],
    queriedAccumulator.keyRef[1],
  );

  let updatedWitness = witness;
  try {
    const credentialStatusId = credential.credentialStatus.id;
    const accumulatorId = blockchainService
      .getTypesForDIDOrAccumulator(credentialStatusId)
      .AccumulatorId.from(credentialStatusId);

    const history =
      await blockchainService.modules.accumulator.accumulatorHistory(
        accumulatorId,
      );

    const blockNoIndex = history.updates.findIndex(
      update => update.id.toString() === blockNo,
    );

    const nextBlockNo = history.updates[blockNoIndex + 1]?.id?.toString();

    if (nextBlockNo) {
      const revocationIndex = credentialStatus.revocationId;
      const encodedRevId = Encoder.defaultEncodeFunc()(revocationIndex.toString());
      const membershipWitness = new VBMembershipWitness(hexToU8a(witness));

      await blockchainService.modules.accumulator.updateWitness(
        registryId,
        encodedRevId,
        membershipWitness,
        nextBlockNo,
        queriedAccumulator.lastModified,
      );
      updatedWitness = witness;
    }
  } catch (err) {
    console.error(err);
  }

  return {
    accumulatedBytes: queriedAccumulator.accumulated.bytes,
    publicKeyBytes: publicKey.bytes,
    witness: updatedWitness,
  };
}

export const getWitnessDetails = async (credential, _membershipWitness) => {
  const cacheKey = credential?.credentialStatus?.id;
  let rawData;

  if (cacheKey) {
    const cached = blockchainCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < WITNESS_CACHE_TTL) {
      rawData = cached.data;
    }
  }

  if (!rawData) {
    rawData = await fetchBlockchainData(credential, _membershipWitness);
    if (cacheKey) {
      blockchainCache.set(cacheKey, {data: rawData, timestamp: Date.now()});
    }
  }

  const {credentialStatus} = credential;
  const revocationIndex = credentialStatus.revocationId;

  return {
    encodedRevId: Encoder.defaultEncodeFunc()(revocationIndex.toString()),
    membershipWitness: new VBMembershipWitness(hexToU8a(rawData.witness)),
    pk: new AccumulatorPublicKey(rawData.publicKeyBytes),
    params: dockAccumulatorParams(),
    accumulator: PositiveAccumulator.fromAccumulated(rawData.accumulatedBytes),
  };
};

export const getIsRevoked = async (credential, _membershipWitness) => {
  const {encodedRevId, membershipWitness, pk, params, accumulator} =
    await getWitnessDetails(credential, _membershipWitness);

  try {
    return !accumulator.verifyMembershipWitness(
      encodedRevId,
      membershipWitness,
      pk,
      params,
    );
  } catch (err) {
    console.error(err);
    return false;
  }
};
