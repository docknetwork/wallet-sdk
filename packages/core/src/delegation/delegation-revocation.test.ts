import axios from 'axios';
import {isDelegationChainRevoked} from './delegation-revocation';
import {getDelegationChain} from './delegation-chain';
import {credentialServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/credential';

jest.mock('axios');
jest.mock('./delegation-chain');
jest.mock('@docknetwork/wallet-sdk-wasm/src/services/credential', () => ({
  credentialServiceRPC: {isStatusList2021Revoked: jest.fn()},
}));
jest.mock('@docknetwork/wallet-sdk-wasm/src/services/dids/index', () => ({
  didServiceRPC: {createSignedJWT: jest.fn()},
}));
jest.mock('@docknetwork/wallet-sdk-wasm/src/services/util-crypto', () => ({
  utilCryptoService: {generateRegistryId: jest.fn()},
}));
jest.mock('../did-provider', () => ({
  getAllDIDs: jest.fn(),
  getDIDKeyPair: jest.fn(),
}));

const REGISTRY = 'a'.repeat(64);
const STATUS_LIST_URL = 'https://api.example.com/status-list/1';

function credential(id: string, index: number, url = STATUS_LIST_URL) {
  return {
    id,
    credentialStatus: {
      id: `status-list2021:dock:0x${REGISTRY}#${index}`,
      type: 'StatusList2021Entry',
      statusPurpose: 'revocation',
      statusListIndex: String(index),
      statusListCredential: url,
    },
  };
}

describe('isDelegationChainRevoked', () => {
  const wallet = {} as any;
  const root = {id: 'root'}; // no credentialStatus: not delegatable-revocable
  const parent = credential('parent', 1);
  const child = credential('child', 2);

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.get as jest.Mock).mockResolvedValue({data: {mock: 'statusList'}});
    (getDelegationChain as jest.Mock).mockResolvedValue([root, parent, child]);
  });

  /** Mark the given credential ids revoked, everything else valid. */
  function revoke(...indexes: number[]) {
    (credentialServiceRPC.isStatusList2021Revoked as jest.Mock).mockImplementation(
      ({statusListIndex}) => Promise.resolve(indexes.includes(statusListIndex)),
    );
  }

  it('reports revoked when an ancestor is revoked but the credential is not', async () => {
    revoke(1); // parent only

    expect(await isDelegationChainRevoked(child, wallet)).toBe(true);
  });

  it('reports revoked when the credential itself is revoked', async () => {
    revoke(2); // child only

    expect(await isDelegationChainRevoked(child, wallet)).toBe(true);
  });

  it('reports not revoked when no link in the chain is revoked', async () => {
    revoke();

    expect(await isDelegationChainRevoked(child, wallet)).toBe(false);
  });

  it('skips chain links that carry no StatusList2021Entry', async () => {
    revoke();
    await isDelegationChainRevoked(child, wallet);

    // root has no credentialStatus, so only parent and child are checked
    expect(credentialServiceRPC.isStatusList2021Revoked).toHaveBeenCalledTimes(2);
  });

  it('fetches each distinct status list once', async () => {
    revoke();
    await isDelegationChainRevoked(child, wallet);

    // parent and child share one registry URL
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('fetches once per URL when the chain spans registries', async () => {
    revoke();
    const other = credential('child', 2, 'https://api.example.com/status-list/2');
    (getDelegationChain as jest.Mock).mockResolvedValue([parent, other]);

    await isDelegationChainRevoked(other, wallet);

    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
