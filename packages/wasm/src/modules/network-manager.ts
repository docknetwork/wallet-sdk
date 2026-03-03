// @ts-nocheck
import assert from 'assert';

export type NetworkInfo = {
  name: string,
  cheqdApiUrl: string | string[],
};

export type NetworkId = 'mainnet' | 'testnet' | 'local' | 'custom';

export const BLOCKCHAIN_NETWORKS : Record<NetworkId, NetworkInfo> = {
  mainnet: {
    name: 'Cheqd Mainnet',
    cheqdApiUrl: [
      'https://mainnet.cheqd.docknode.io',
      'https://rpc.cheqd.net',
    ],
  },
  testnet: {
    name: 'Cheqd Testnet',
    cheqdApiUrl: [
      'https://testnet.cheqd.docknode.io',
      'https://api.cheqd.network',
    ],
  },
  local: {
    name: 'Local Node',
    cheqdApiUrl: [
      'http://localhost:8080',
    ],
  },
};

function getNetworkInfo(networkId): NetworkInfo {
  const networkInfo = BLOCKCHAIN_NETWORKS[networkId];

  assert(!!networkInfo, `Network ${networkId} not found`);

  return networkInfo;
}

/**
 * NetworkManager
 */
export class NetworkManager {
  networkId: NetworkId;
  isOnline: boolean;

  constructor() {
    this.networkId = 'mainnet';
    // TODO: Detect offline mode
    this.isOnline = true;
  }

  /**
   * Set current network id
   *
   * @param {string} networkId
   */
  setNetworkId(networkId: NetworkId) {
    assert(!!BLOCKCHAIN_NETWORKS[networkId], `invalid networkId ${networkId}`);

    this.networkId = networkId;
  }

  /**
   * Get current network info
   * @returns networkInfo
   */
  getNetworkInfo() {
    return getNetworkInfo(this.networkId);
  }

  /**
   * Set current network id
   *
   * @return {NetworkManager} substrateNetwork
   */
  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }

    return NetworkManager.instance;
  }
}
