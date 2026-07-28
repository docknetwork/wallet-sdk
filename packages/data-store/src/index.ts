import {EventEmitter} from 'events';
import {DataStore, DataStoreConfigs} from './types';
import {DEFAULT_CONFIGS} from './configs';
import {logger} from './logger';
import assert from 'assert';

import {DocumentStore, DataSource, WalletStore} from './types';

export let _localStorageImpl = global.localStorage;
export const getLocalStorage = () => _localStorageImpl;
export const setLocalStorage = impl => {
  console.log('Setting local storage impl', impl);
  _localStorageImpl = impl
};

export function parseConfigs(configs: DataStoreConfigs): DataStoreConfigs {
  const options: DataStoreConfigs = {
    ...DEFAULT_CONFIGS,
    ...configs,
  };

  if (!options.defaultNetwork) {
    options.defaultNetwork = options.networks[0].id;
  }

  return options;
}

export async function updateNetwork({
  dataStore,
  networkId,
}: {
  dataStore: DataStore;
  networkId: string;
}): Promise<void> {
  const network = dataStore.networks.find(item => item.id === networkId);

  assert(!!network, `Invalid network id ${networkId}`);

  dataStore.network = network;
  dataStore.networkId = networkId;

  await dataStore.wallet.updateWallet({dataStore});
}

export async function createDataStore({
  configs,
  documentStore,
  walletStore,
  dataSource,
  localStorageImpl,
}: {
  configs: DataStoreConfigs;
  documentStore: DocumentStore;
  walletStore: WalletStore;
  dataSource: DataSource;
  localStorageImpl: any;
}): Promise<DataStore> {
  _localStorageImpl = localStorageImpl;

  const options = parseConfigs(configs);

  const dataStore: DataStore = {
    events: new EventEmitter(),
    db: dataSource,
    configs: configs,
    networkId: options.defaultNetwork,
    network: options.networks.find(item => item.id === options.defaultNetwork),
    testNetworkId: options.testNetworkId,
    mainNetworkId: options.mainNetworkId,
    version: null,
    networks: options.networks,
    resolveDocumentNetwork: options.documentNetworkResolver,
    setNetwork: (networkId: string) => {
      logger.debug(`Setting network to ${networkId}`);
      return updateNetwork({dataStore, networkId});
    },
    wallet: walletStore,
    documents: documentStore,
  };

  logger.debug('Data store initialized');

  return dataStore;
}

/**
 * Close the data store connection with the database
 *
 */
export async function closeDataStore(dataStore: DataStore) {
  await dataStore.db.destroy();
}
