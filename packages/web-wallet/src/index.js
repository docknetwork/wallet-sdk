import { createDataStore } from '@docknetwork/wallet-sdk-data-store-web/src/index';
import { initializeCloudWallet, generateCloudWalletMasterKey, recoverCloudWalletMasterKey } from '@docknetwork/wallet-sdk-core/src/cloud-wallet';
import { createWallet } from '@docknetwork/wallet-sdk-core/src/wallet';
import { createCredentialProvider } from '@docknetwork/wallet-sdk-core/src/credential-provider';
import { createDIDProvider } from '@docknetwork/wallet-sdk-core/src/did-provider';
import { createMessageProvider } from '@docknetwork/wallet-sdk-core/src/message-provider';

export {
  createDataStore,
  createWallet,
  createCredentialProvider,
  createDIDProvider,
  createMessageProvider,
  initializeCloudWallet,
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
}

