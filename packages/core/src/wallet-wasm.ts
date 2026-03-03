import { blockchainService } from '@docknetwork/wallet-sdk-wasm/src/services/blockchain';
import { utilCryptoService } from '@docknetwork/wallet-sdk-wasm/src/services/util-crypto';
import { Network } from '@docknetwork/wallet-sdk-data-store/src/types';
import { captureException } from './helpers';
import { IWallet, WalletEvents } from './types';

function isBlockchainNetwork(network: Network) {
  return !!(network.configs.cheqdApiUrl);
}

/**
 * Update existing blockchain network connection
 * Compare connected blockchain connection with the current walle network
 * Disconnect and Establish a new connection if the network is different
 */
export async function handleBlockchainNetworkChange(
  wallet: IWallet,
): Promise<void> {
  const currentAddress = await blockchainService.getAddress();
  const networkId = wallet.dataStore.networks.find(
    network => network.configs.cheqdApiUrl === currentAddress,
  )?.id;
  const currentNetworkId = wallet.dataStore.network?.id;

  if (networkId === currentNetworkId) {
    return;
  }

  await blockchainService.disconnect();
  await setBlockchainNetwork(wallet);
}

export async function setBlockchainNetwork(wallet: IWallet) {
  const network = wallet.dataStore.network;
  const networkConfigs = network.configs;


  let cheqdMnemonicDoc = await wallet.getDocumentById('cheqd-mnemonic');

  if (!cheqdMnemonicDoc) {
    cheqdMnemonicDoc = {
      id: 'cheqd-mnemonic',
      type: 'Mnemonic',
      value: await utilCryptoService.mnemonicGenerate(12),
    }

    await wallet.addDocument(cheqdMnemonicDoc);
  }

  let connectionInProgress = false;

  const initializeBlockchain = () => {
    clearInterval(wallet.networkCheckInterval);
  
    if (connectionInProgress) {
      return;
    }
  
    connectionInProgress = true;
  
    blockchainService
      .init({
        cheqdApiUrl: networkConfigs.cheqdApiUrl,
        networkId: network.id,
        cheqdMnemonic: cheqdMnemonicDoc.value,
      })
      .then(() => {
        wallet.eventManager.emit(WalletEvents.networkConnected);
      })
      .catch(err => {
        const errorMessage = new Error('Unable to connect to blockchain');
        captureException(errorMessage);
        captureException(err);
        console.error(err);
        wallet.eventManager.emit(WalletEvents.networkError, err);
      })
      .finally(() => {
        connectionInProgress = false;
  
        wallet.networkCheckInterval = setInterval(async () => {
          try {
            if (!await blockchainService.isApiConnected()) {
              wallet.eventManager.emit(WalletEvents.networkError, new Error('Network not connected'));
              initializeBlockchain();
            }
          } catch (err) {
            console.error('Error during connectivity check:', err);
          }
        }, 10000);
      });
  };
  
  initializeBlockchain();
}

export async function initWalletWasm(wallet: IWallet) {
  const network = wallet.dataStore.network;

  if (isBlockchainNetwork(network)) {
    await setBlockchainNetwork(wallet);

    wallet.eventManager.on(WalletEvents.networkUpdated, async () => {
      handleBlockchainNetworkChange(wallet).catch(err => console.error(err));
    });
  }

  wallet.ensureNetwork = async () => {
    try {
      const isConnected = await blockchainService.isApiConnected();

      if (!isConnected) {
        await setBlockchainNetwork(wallet);
        wallet.eventManager.emit(WalletEvents.networkConnected);
      }
    } catch (err) {
      console.error('Error checking network connection:', err);
      wallet.eventManager.emit(WalletEvents.networkError, err);
    }
  }

  wallet.setStatus('ready');

  wallet.eventManager.emit(WalletEvents.ready);
}
