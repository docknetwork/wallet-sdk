/**
 * Integration test for empty wallet
 *
 * Ensure that a new wallet can be created and will be functional
 */
import {DataStoreSnapshotV1} from '../data/data-store';
import {WalletBackupJSON, WalletBackupPasssword} from '../data/wallet-backup';
import {
  CreateWalletProps,
  IWallet,
} from '@docknetwork/wallet-sdk-core/lib/types';
import {createWallet} from '@docknetwork/wallet-sdk-core/lib/wallet';
import {WalletEvents} from '@docknetwork/wallet-sdk-core/src/wallet';
import {setV1LocalStorage} from '@docknetwork/wallet-sdk-data-store-typeorm/src/migration/migration1/v1-data-store';
import {
  IMessageProvider,
  createMessageProvider,
} from '@docknetwork/wallet-sdk-core/src/message-provider';
import {
  IDIDProvider,
  createDIDProvider,
} from '@docknetwork/wallet-sdk-core/src/did-provider';
import {
  ICredentialProvider,
  createCredentialProvider,
} from '@docknetwork/wallet-sdk-core/src/credential-provider';
import {blockchainService} from '@docknetwork/wallet-sdk-wasm/src/services/blockchain';
import {createDataStore} from '@docknetwork/wallet-sdk-data-store-typeorm/src';
import {DataStore} from '@docknetwork/wallet-sdk-data-store/src/types';

let wallet: IWallet;
let didProvider: IDIDProvider;
let credentialProvider: ICredentialProvider;
let messageProvider: IMessageProvider;

export async function createNewWallet({
  dontWaitForNetwork,
  dataStore,
}: {
  dontWaitForNetwork?: boolean;
  dataStore?: DataStore;
} = {}): Promise<IWallet> {
  if (!dataStore) {
    dataStore = await createDataStore({
      databasePath: ':memory:',
      dbType: 'sqlite',
      defaultNetwork: 'testnet',
    });
  }

  wallet = await createWallet({
    dataStore,
  });

  didProvider = createDIDProvider({wallet});
  credentialProvider = createCredentialProvider({wallet});
  messageProvider = createMessageProvider({wallet, didProvider}) as any;

  console.log('Waiting for network connection');

  if (!dontWaitForNetwork) {
    await wallet.waitForEvent(WalletEvents.networkConnected);
  }
  console.log('Network connected');

  return wallet;
}

export async function getWallet(): Promise<IWallet> {
  if (!wallet) {
    await createNewWallet();
  }

  return wallet;
}

export function getMessageProvider(): IMessageProvider {
  return messageProvider;
}

export function getDIDProvider(): IDIDProvider {
  return didProvider;
}

export function getCredentialProvider(): ICredentialProvider {
  return credentialProvider;
}

export async function addCredentialIfNotExists(credential: any) {
  try {
    return await credentialProvider.addCredential(credential);
  } catch (err) {
    if (!err.message?.includes('already exists')) throw err;
  }
}

export async function setNetwork(networkId) {
  return Promise.resolve(wallet.setNetwork(networkId));
}

/**
 * Simulate loading a wallet from a snapshot
 * Used to test data migration for already existing wallets
 */
export async function createWalletFromSnapshot() {
  global.localStorage.setItem('wallet', JSON.stringify(DataStoreSnapshotV1));

  setV1LocalStorage(global.localStorage as any);

  return createNewWallet();
}

export async function createWalletFromBackup() {
  wallet = await createNewWallet();
  await wallet.importUniversalWalletJSON(
    WalletBackupJSON,
    WalletBackupPasssword,
  );

  await wallet.ensureNetwork();

  return wallet;
}

export async function getAllDocuments() {
  return wallet.query({} as any);
}

export async function getDocumentsByType(type) {
  return wallet.getDocumentsByType(type);
}

export async function closeWallet(walletToClose?: IWallet) {
  if (!walletToClose) {
    walletToClose = await getWallet();
  }

  if (messageProvider) {
    messageProvider.stop();
  }

  if (walletToClose.networkCheckInterval) {
    clearInterval(walletToClose.networkCheckInterval);
    walletToClose.networkCheckInterval = undefined;
  }

  return new Promise(res => {
    setTimeout(async () => {
      try {
        walletToClose.dataStore.db.destroy();
        await blockchainService.disconnect();
      } catch (err) {
        console.error(err);
      }
      res(null);
    }, 2000);
  });
}
