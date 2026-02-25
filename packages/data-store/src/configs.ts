import {BLOCKCHAIN_NETWORKS} from '@docknetwork/wallet-sdk-wasm/src/modules/network-manager';
import {DataStoreConfigs} from './types';
import {genericDocumentNetworkResolver} from './document-network-resolver';

export const DEFAULT_CONFIGS: DataStoreConfigs = {
  dbType: 'sqlite',
  databasePath: 'dock-wallet-sdk.db',
  documentNetworkResolver: genericDocumentNetworkResolver,
  networks: [
    {
      name: 'Mainnet',
      id: 'mainnet',
      credentialHostnames: [/creds\..*\.io/],
      configs: BLOCKCHAIN_NETWORKS.mainnet,
    },
    {
      name: 'Testnet',
      id: 'testnet',
      credentialHostnames: [/creds-.*\.*\.io/],
      configs: BLOCKCHAIN_NETWORKS.testnet,
    },
  ],
};
