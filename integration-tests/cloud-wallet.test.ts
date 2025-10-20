import {IWallet} from '@docknetwork/wallet-sdk-core/lib/types';
import {closeWallet, createNewWallet} from './helpers/wallet-helpers';
import {DataStore, DataStoreEvents} from '@docknetwork/wallet-sdk-data-store/src/types';
import {
  SYNC_MARKER_TYPE,
  initializeCloudWallet,
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
} from '@docknetwork/wallet-sdk-core/src/cloud-wallet';
import {createDataStore} from '@docknetwork/wallet-sdk-data-store-typeorm/src';
import {edvService} from '@docknetwork/wallet-sdk-wasm/src/services/edv';

const EDV_URL = process.env.EDV_URL;
const EDV_AUTH_KEY = process.env.EDV_AUTH_KEY;

describe('Cloud wallet', () => {
  let dataStore: DataStore;
  let waitForEdvIdle: any;
  let pushSyncMarker: any;
  let findDocumentByContentId: any;
  let updateDocumentByContentId: any;
  let pullDocuments: any;
  let getSyncMarkerDiff: any;
  let clearEdvDocuments: any;
  let unsubscribeEventListeners: any;
  let wallet: IWallet;

  beforeAll(async () => {
    if (!EDV_URL || !EDV_AUTH_KEY) {
      throw new Error("Missing required environment variables: EDV_URL and EDV_AUTH_KEY");
    }

    const { masterKey } = await generateCloudWalletMasterKey();

    dataStore = await createDataStore({
      databasePath: ':memory:',
      dbType: 'sqlite',
      defaultNetwork: 'testnet',
    });

    ({
      waitForEdvIdle,
      pushSyncMarker,
      findDocumentByContentId,
      updateDocumentByContentId,
      pullDocuments,
      getSyncMarkerDiff,
      clearEdvDocuments,
      unsubscribeEventListeners,
    } = await initializeCloudWallet({
      dataStore,
      edvUrl: EDV_URL,
      masterKey,
      authKey: EDV_AUTH_KEY,
    }));

    wallet = await createNewWallet({
      dontWaitForNetwork: true,
      dataStore,
    });
  });

  afterAll(async () => {
    await clearEdvDocuments();
  });

  it('should generate a valid master key with mnemonic', async () => {
    const { mnemonic, masterKey } = await generateCloudWalletMasterKey();

    expect(mnemonic).toBeDefined();
    expect(typeof mnemonic).toBe('string');
    expect(mnemonic.split(' ').length).toBe(12);

    expect(masterKey).toBeDefined();
    expect(masterKey).toBeInstanceOf(Uint8Array);
  });

  it('should recover the same master key from a mnemonic', async () => {
    const { mnemonic, masterKey } = await generateCloudWalletMasterKey();
    const recoveredKey = await recoverCloudWalletMasterKey(mnemonic);

    expect(recoveredKey).toStrictEqual(masterKey);
  });

  it('should see a document added directly to the EDV appear in the wallet after pulling', async () => {
    const newDocId = `${Date.now()}`;
    const newDoc = {
      id: newDocId,
      type: 'test',
      data: 'test',
    };

    await edvService.insert({
      document: {
        content: newDoc,
      },
    });

    await pullDocuments();

    const sdkDocument = await dataStore.documents.getDocumentById(newDocId);

    expect(sdkDocument).toEqual(newDoc);
  });

  it('should sync a document added to the wallet to the EDV', async () => {
    const doc = {
      type: 'test',
      data: 'test',
    };
    const {id: addedDocId} = await wallet.addDocument(doc);

    await waitForEdvIdle();

    const edvDocument = await findDocumentByContentId(addedDocId);
    expect(edvDocument.content.id).toBe(addedDocId);
  });

  it('should update a document in the wallet and see it updated in the EDV', async () => {
    const doc = {
      type: 'test',
      data: 'test',
    };
    const {id: addedDocId} = await wallet.addDocument(doc);

    await waitForEdvIdle();

    await wallet.updateDocument({
      id: addedDocId,
      ...doc,
      data: 'updated',
    });

    await waitForEdvIdle();

    const updatedEdvDocument = await findDocumentByContentId(addedDocId);
    expect(updatedEdvDocument.content.data).toBe('updated');
  });

  it('should handle concurrent updates to the same document sequentially', async () => {
    const doc = {
      type: 'test',
      data: 'initial',
    };
    const {id: addedDocId} = await wallet.addDocument(doc);
    await waitForEdvIdle();

    await wallet.updateDocument({
      id: addedDocId,
      ...doc,
      data: 'updated-1',
    });

    await wallet.updateDocument({
      id: addedDocId,
      ...doc,
      data: 'updated-2',
    });

    await waitForEdvIdle();

    const updatedEdvDocument = await findDocumentByContentId(addedDocId);
    expect(updatedEdvDocument.content.data).toBe('updated-2');
  });

  it('should handle updating and deleting a document', async () => {
    const doc = {
      type: 'test',
      data: 'initial',
    };
    const {id: addedDocId} = await wallet.addDocument(doc);
    await waitForEdvIdle();

    await wallet.updateDocument({
      id: addedDocId,
      ...doc,
      data: 'updated',
    });

    await wallet.removeDocument(addedDocId);

    await waitForEdvIdle();

    const removedEdvDocument = await findDocumentByContentId(addedDocId);
    expect(removedEdvDocument).toBeUndefined();
  });

  it('should remove a document from the wallet and see it removed from the EDV', async () => {
    const doc = {
      type: 'test',
      data: 'test',
    };
    const {id: addedDocId} = await wallet.addDocument(doc);

    await waitForEdvIdle();

    await wallet.removeDocument(addedDocId);

    await waitForEdvIdle();

    const removedEdvDocument = await findDocumentByContentId(addedDocId);
    expect(removedEdvDocument).toBeUndefined();
  });

  it('should have zero sync marker diff after pushing sync marker', async () => {
    await pushSyncMarker();
    await waitForEdvIdle();

    const syncMarkerDiff = await getSyncMarkerDiff();
    expect(syncMarkerDiff).toBe(0);
  });

  it('should detect sync marker diff after updating sync marker directly in EDV', async () => {
    await updateDocumentByContentId({
      id: SYNC_MARKER_TYPE,
      type: SYNC_MARKER_TYPE,
      updatedAt: Date.now() + 1000,
    });

    const syncMarkerDiff = await getSyncMarkerDiff();
    expect(syncMarkerDiff > 0).toBeTruthy();
  });

  // This test should be run last as it unsubscribes from all event listeners
  it('should unsubscribe from all events listeners', async () => {
    expect(dataStore.events.listeners(DataStoreEvents.DocumentCreated)).toHaveLength(1);
    expect(dataStore.events.listeners(DataStoreEvents.DocumentDeleted)).toHaveLength(1);
    expect(dataStore.events.listeners(DataStoreEvents.DocumentUpdated)).toHaveLength(1);

    unsubscribeEventListeners();

    expect(dataStore.events.listeners(DataStoreEvents.DocumentCreated)).toHaveLength(0);
    expect(dataStore.events.listeners(DataStoreEvents.DocumentDeleted)).toHaveLength(0);
    expect(dataStore.events.listeners(DataStoreEvents.DocumentUpdated)).toHaveLength(0);
  });

  afterAll(() => closeWallet());
});
