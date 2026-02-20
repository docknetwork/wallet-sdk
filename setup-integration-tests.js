import {NetworkManager} from './packages/wasm/src/modules/network-manager';

import {setV1LocalStorage} from '@docknetwork/wallet-sdk-data-store-typeorm/src/migration/migration1/v1-data-store';

NetworkManager.getInstance().setNetworkId('testnet');

process.env.ENCRYPTION_KEY =
  '776fe87eec8c9ba8417beda00b23cf22f5e134d9644d0a195cd9e0b7373760c1';

jest.retryTimes(2, {logErrorsBeforeRetry: true});

jest.mock('@react-native-async-storage/async-storage', () => 'AsyncStorage');

setV1LocalStorage(global.localStorage);
global.localStorage.setItem('networkId', 'testnet');
