import {
  createTestDataStore,
  createV1EmptyDataStore,
  setupV1MockDataStore,
} from '../../test/test-utils';
import {getV1LocalStorage} from '../migration/migration1/v1-data-store';
import {CURRENT_DATA_STORE_VERSION} from '../migration';
import {DataStore} from '@docknetwork/wallet-sdk-data-store/src/types';
import {WalletEntity, getWallet} from '../entities/wallet.entity';
import {closeDataStore} from '@docknetwork/wallet-sdk-data-store/src/index';

describe('Data store', () => {
  describe('v2-data-store migration', () => {
    let dataStore: DataStore;

    beforeAll(async () => {
      await setupV1MockDataStore();
      dataStore = await createTestDataStore();
    });

    it('should remove wallet json from local storage', async () => {
      const jsonData = await getV1LocalStorage().getItem('wallet');
      expect(jsonData).toBeUndefined();
    });

    it('should create DataStoreConfigs', async () => {
      const configs = await getWallet({dataStore});
      expect(configs).toBeDefined();
      expect(configs.networkId).toBe('mainnet');
      expect(configs.version).toBe(CURRENT_DATA_STORE_VERSION);
    });

    afterAll(() => {
      closeDataStore(dataStore);
    });
  });

  describe('empty wallet migration', () => {
    let dataStore: DataStore;

    beforeAll(async () => {
      await createV1EmptyDataStore();
      dataStore = await createTestDataStore();
    });

    it('should create SDKConfigs', async () => {
      const configs = await getWallet({dataStore});
      expect(configs.networkId).toBe('mainnet');
      expect(configs.version).toBe(CURRENT_DATA_STORE_VERSION);
    });

    afterAll(() => {
      closeDataStore(dataStore);
    });
  });
});
