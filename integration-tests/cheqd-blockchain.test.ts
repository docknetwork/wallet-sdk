import {
    closeWallet,
    getWallet,
  } from './helpers';
import { blockchainService } from '@docknetwork/wallet-sdk-wasm/src/services/blockchain';
import { BLOCKCHAIN_NETWORKS } from '@docknetwork/wallet-sdk-wasm/src/modules/network-manager';

describe('Test cheqd blockchain connection', () => {
  beforeEach(() => getWallet());

  it('should use fallback blockchain network if the first one is not working', async () => {
    const result = await blockchainService.init({
      cheqdApiUrl: [
        'https://some-invalid-network.local',
        ...BLOCKCHAIN_NETWORKS.mainnet.cheqdApiUrl,
      ],
      networkId: 'mainnet',
    })
    expect(result).toBe(true);
  });

  it('should be able to connect to cheqd mainnet', async () => {
    const result = await blockchainService.init({
      cheqdApiUrl: BLOCKCHAIN_NETWORKS.mainnet.cheqdApiUrl,
      networkId: 'mainnet',
    })
    expect(result).toBe(true);
  });

  it('should be able to connect to cheqd testnet', async () => {
    const result = await blockchainService.init({
      cheqdApiUrl: BLOCKCHAIN_NETWORKS.testnet.cheqdApiUrl,
      networkId: 'testnet',
    })
    expect(result).toBe(true);
  });

  afterAll(() => closeWallet());
});
  