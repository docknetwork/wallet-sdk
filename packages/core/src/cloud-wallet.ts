/**
 * @module cloud-wallet
 * @description Cloud wallet functionality for the Truvera Wallet SDK.
 * This module provides the main cloud wallet creation and management functions.
 */

import {
  DataStore,
  DataStoreEvents,
} from '@docknetwork/wallet-sdk-data-store/src/types';
import { logger } from '@docknetwork/wallet-sdk-data-store/src/logger';
import { edvService } from '@docknetwork/wallet-sdk-wasm/src/services/edv';
import { utilCryptoService } from '@docknetwork/wallet-sdk-wasm/src/services/util-crypto';

export const SYNC_MARKER_TYPE = 'SyncMarkerDocument';
export const MNEMONIC_WORD_COUNT = 12;
export const KEY_MAPPING_TYPE = 'KeyMappingDocument';
export const PASSKEY_KEY_MAPPING_TYPE = 'PasskeyKeyMappingDocument';
const MASTER_KEY_SUFFIX = 'master-key';

/**
 * Derives a key from biometric data using HKDF
 * @param biometricData Biometric data from provider
 * @param identifier User's identifier as salt (email, phone number, etc.)
 * @returns Derived key
 */
export function deriveBiometricKey(
  biometricData: Buffer,
  identifier: string,
): Buffer {
  return edvService.deriveBiometricKey(biometricData, identifier);
}

/**
 * Derives EDV keys from biometric data for the KeyMappingVault
 * @param biometricData Biometric data from the provider
 * @param identifier User's identifier as additional entropy (email, phone number, etc.)
 * @returns Keys for accessing the KeyMappingVault
 */
export async function deriveKeyMappingVaultKeys(
  biometricData: Buffer,
  identifier: string
): Promise<{ hmacKey: string; agreementKey: string; verificationKey: string }> {
  const seedBuffer = deriveBiometricKey(biometricData, identifier);

  return edvService.deriveKeys(new Uint8Array(seedBuffer));
}

/**
 * Generates a key for encrypting/decrypting the master key
 * @param biometricData Biometric data from provider
 * @param identifier User's identifier as salt (email, phone number, etc.)
 * @returns Encryption key and IV for AES encryption
 */
export async function deriveBiometricEncryptionKey(
  biometricData: Buffer,
  identifier: string
): Promise<{ key: Buffer; iv: Buffer }> {
  return edvService.deriveBiometricEncryptionKey(biometricData, identifier);
}

/**
 * Encrypts the master key using a key derived from biometric data
 * @param masterKey The CloudWalletVault master key to encrypt
 * @param encryptionKey Key derived from biometric data
 * @param iv Initialization vector
 * @returns Encrypted master key
 */
export async function encryptMasterKey(
  masterKey: Uint8Array,
  encryptionKey: Buffer,
  iv: Buffer
): Promise<Uint8Array> {
  return edvService.encryptMasterKey(masterKey, encryptionKey, iv);
}

/**
 * Decrypts the master key using biometric-derived key
 * @param encryptedKey The encrypted master key
 * @param decryptionKey Key derived from biometric data
 * @param iv Initialization vector
 * @returns The decrypted master key
 */
export async function decryptMasterKey(
  encryptedKey: Uint8Array,
  decryptionKey: Buffer,
  iv: Buffer
): Promise<Uint8Array> {
  return edvService.decryptMasterKey(encryptedKey, decryptionKey, iv);
}

/**
 * Initializes the KeyMappingVault using biometric data
 * @param edvUrl URL for the edv
 * @param authKey Auth key for the edv
 * @param biometricData User's biometric data
 * @param identifier User's identifier (email, phone number, etc.)
 * @returns Initialized EDV service
 */
export async function initializeKeyMappingVault(
  edvUrl: string,
  authKey: string,
  biometricData: Buffer,
  identifier: string
): Promise<typeof edvService> {
  const {
    hmacKey,
    agreementKey,
    verificationKey
  } = await deriveKeyMappingVaultKeys(biometricData, identifier);

  const keyMappingEdvService = edvService;
  await keyMappingEdvService.initialize({
    hmacKey,
    agreementKey,
    verificationKey,
    edvUrl,
    authKey
  });

  return keyMappingEdvService;
}

/**
 * Enrolls a user by creating necessary vaults and keys
 * @param edvUrl URL for the edv
 * @param authKey Auth key for the edv
 * @param biometricData Biometric data from provider
 * @param identifier User's identifier (email, phone number, etc.)
 * @returns The master key and mnemonic for backup
 */
export async function enrollUserWithBiometrics(
  edvUrl: string,
  authKey: string,
  biometricData: Buffer,
  identifier: string
): Promise<{ masterKey: Uint8Array; mnemonic: string }> {
  const keyMappingEdv = await initializeKeyMappingVault(
    edvUrl,
    authKey,
    biometricData,
    identifier
  );
  const { mnemonic, masterKey } = await generateCloudWalletMasterKey();
  const { key: encryptionKey, iv } = await deriveBiometricEncryptionKey(biometricData, identifier);
  const encryptedMasterKey = await encryptMasterKey(masterKey, encryptionKey, iv);

  const encryptedData = {
    data: Array.from(encryptedMasterKey),
    iv: Array.from(iv)
  };

  const contentId = `${await keyMappingEdv.getController()}#${MASTER_KEY_SUFFIX}`;

  await keyMappingEdv.insert({
    document: {
      content: {
        id: contentId,
        type: KEY_MAPPING_TYPE,
        encryptedKey: encryptedData
      }
    }
  });

  return { masterKey, mnemonic };
}

/**
 * Gets the master key from the key mapping vault using provided decryption keys
 * @param keyMappingEdv Initialized key mapping vault service
 * @param identifier User's identifier (email, phone number, etc.)
 * @param decryptionKey Key for decrypting the master key
 * @param iv Initialization vector for decryption
 * @returns The decrypted master key for CloudWalletVault
 */
export async function getKeyMappingMasterKey(
  keyMappingEdv: typeof edvService,
  identifier: string,
  decryptionKey: Buffer,
): Promise<Uint8Array> {
  const result = await keyMappingEdv.find({
    equals: {
      'content.id': identifier
    }
  }).catch(error => {
    if (error.message && error.message.includes('does not exist')) {
      logger.error('KeyMappingVault does not exist, skipping find');
      return { documents: [] };
    }

    throw error;
  });

  if (!result.documents || result.documents.length === 0) {
    throw new Error('Authentication failed: Invalid identifier');
  }

  // The KeyMappingVault keys are derived from the biometric data so each
  // vault should have a unique key for the user

  const keyMappingDoc = result.documents[0];
  const { data: encryptedKey, iv: storedIv } = keyMappingDoc.content.encryptedKey;
  const encryptedKeyArray = new Uint8Array(encryptedKey);
  const ivBuffer = Buffer.from(storedIv);

  try {
    const masterKey = await decryptMasterKey(encryptedKeyArray, decryptionKey, ivBuffer);

    return masterKey;
  } catch (error) {
    throw new Error('Authentication failed: Invalid decryption key');
  }
}

/**
 * Authenticates a user with biometric data and identifier
 * @param edvUrl URL for the edv
 * @param authKey Auth key for the edv
 * @param biometricData Biometric data from the provider
 * @param identifier User's identifier (email, phone number, etc.)
 * @returns The decrypted master key for CloudWalletVault
 */
export async function authenticateWithBiometrics(
  edvUrl: string,
  authKey: string,
  biometricData: Buffer,
  identifier: string
): Promise<Uint8Array> {
  const keyMappingEdv = await initializeKeyMappingVault(
    edvUrl,
    authKey,
    biometricData,
    identifier
  );
  const { key: decryptionKey } = await deriveBiometricEncryptionKey(biometricData, identifier);

  const contentId = `${await keyMappingEdv.getController()}#${MASTER_KEY_SUFFIX}`;

  return getKeyMappingMasterKey(keyMappingEdv, contentId, decryptionKey);
}

/**
 * Initializes the Cloud Wallet using biometric authentication
 * @param edvUrl Cloud wallet vault URL
 * @param authKey Cloud wallet auth key
 * @param biometricData User's biometric data
 * @param identifier User's identifier (email, phone number, etc.)
 * @param dataStore Optional data store for the wallet
 * @returns Initialized cloud wallet
 */
export async function initializeCloudWalletWithBiometrics(
  edvUrl: string,
  authKey: string,
  biometricData: Buffer,
  identifier: string,
  dataStore?: any
): Promise<any> {
  const masterKey = await authenticateWithBiometrics(
    edvUrl,
    authKey,
    biometricData,
    identifier
  );

  return initializeCloudWallet({
    dataStore,
    edvUrl,
    authKey,
    masterKey
  });
}

/**
 * Derives EDV keys from passkey PRF output for the KeyMappingVault
 * @param prfOutput 32-byte PRF output from WebAuthn assertion
 * @param identifier User's identifier as additional entropy (email, phone number, etc.)
 * @returns Keys for accessing the KeyMappingVault
 */
export async function derivePasskeyVaultKeys(
  prfOutput: Uint8Array,
  identifier: string
): Promise<{ hmacKey: string; agreementKey: string; verificationKey: string }> {
  const seedBuffer = deriveBiometricKey(Buffer.from(prfOutput), identifier);
  return edvService.deriveKeys(new Uint8Array(seedBuffer));
}

/**
 * Generates a key for encrypting/decrypting the master key from passkey PRF output
 * @param prfOutput 32-byte PRF output from WebAuthn assertion
 * @param identifier User's identifier as salt (email, phone number, etc.)
 * @returns Encryption key and IV for AES encryption
 */
export async function derivePasskeyEncryptionKey(
  prfOutput: Uint8Array,
  identifier: string
): Promise<{ key: Buffer; iv: Buffer }> {
  return edvService.deriveBiometricEncryptionKey(Buffer.from(prfOutput), identifier);
}

/**
 * Initializes the KeyMappingVault using passkey PRF output
 * @param edvUrl URL for the edv
 * @param authKey Auth key for the edv
 * @param prfOutput 32-byte PRF output from WebAuthn assertion
 * @param identifier User's identifier (email, phone number, etc.)
 * @returns Initialized EDV service
 */
export async function initializePasskeyKeyMappingVault(
  edvUrl: string,
  authKey: string,
  prfOutput: Uint8Array,
  identifier: string
): Promise<typeof edvService> {
  const {
    hmacKey,
    agreementKey,
    verificationKey
  } = await derivePasskeyVaultKeys(prfOutput, identifier);

  const keyMappingEdvService = edvService;
  await keyMappingEdvService.initialize({
    hmacKey,
    agreementKey,
    verificationKey,
    edvUrl,
    authKey
  });

  return keyMappingEdvService;
}

/**
 * Enrolls a user by creating a passkey-protected master key in the KeyMappingVault
 * @param edvUrl URL for the edv
 * @param authKey Auth key for the edv
 * @param prfOutput 32-byte PRF output from WebAuthn assertion
 * @param identifier User's identifier (email, phone number, etc.)
 * @returns The master key and mnemonic for backup
 */
export async function enrollUserWithPasskey(
  edvUrl: string,
  authKey: string,
  prfOutput: Uint8Array,
  identifier: string
): Promise<{ masterKey: Uint8Array; mnemonic: string }> {
  const keyMappingEdv = await initializePasskeyKeyMappingVault(
    edvUrl,
    authKey,
    prfOutput,
    identifier
  );
  const { mnemonic, masterKey } = await generateCloudWalletMasterKey();
  const { key: encryptionKey, iv } = await derivePasskeyEncryptionKey(prfOutput, identifier);
  const encryptedMasterKey = await encryptMasterKey(masterKey, encryptionKey, iv);

  const encryptedData = {
    data: Array.from(encryptedMasterKey),
    iv: Array.from(iv)
  };

  const contentId = `${await keyMappingEdv.getController()}#${MASTER_KEY_SUFFIX}`;

  await keyMappingEdv.insert({
    document: {
      content: {
        id: contentId,
        type: PASSKEY_KEY_MAPPING_TYPE,
        encryptedKey: encryptedData
      }
    }
  });

  return { masterKey, mnemonic };
}

/**
 * Authenticates a user with passkey PRF output and identifier
 * @param edvUrl URL for the edv
 * @param authKey Auth key for the edv
 * @param prfOutput 32-byte PRF output from WebAuthn assertion
 * @param identifier User's identifier (email, phone number, etc.)
 * @returns The decrypted master key for CloudWalletVault
 */
export async function authenticateWithPasskey(
  edvUrl: string,
  authKey: string,
  prfOutput: Uint8Array,
  identifier: string
): Promise<Uint8Array> {
  const keyMappingEdv = await initializePasskeyKeyMappingVault(
    edvUrl,
    authKey,
    prfOutput,
    identifier
  );
  const { key: decryptionKey } = await derivePasskeyEncryptionKey(prfOutput, identifier);

  const contentId = `${await keyMappingEdv.getController()}#${MASTER_KEY_SUFFIX}`;

  return getKeyMappingMasterKey(keyMappingEdv, contentId, decryptionKey);
}

/**
 * Initializes the Cloud Wallet using passkey authentication
 * @param edvUrl Cloud wallet vault URL
 * @param authKey Cloud wallet auth key
 * @param prfOutput 32-byte PRF output from WebAuthn assertion
 * @param identifier User's identifier (email, phone number, etc.)
 * @param dataStore Optional data store for the wallet
 * @returns Initialized cloud wallet
 */
export async function initializeCloudWalletWithPasskey(
  edvUrl: string,
  authKey: string,
  prfOutput: Uint8Array,
  identifier: string,
  dataStore?: any
): Promise<any> {
  const masterKey = await authenticateWithPasskey(
    edvUrl,
    authKey,
    prfOutput,
    identifier
  );

  return initializeCloudWallet({
    dataStore,
    edvUrl,
    authKey,
    masterKey
  });
}

interface QueuedOperation {
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

interface DocumentQueue {
  operations: QueuedOperation[];
  isProcessing: boolean;
}

export async function generateCloudWalletMasterKey(): Promise<{ mnemonic: string; masterKey: Uint8Array }> {
  const mnemonic = await utilCryptoService.mnemonicGenerate(MNEMONIC_WORD_COUNT);

  const masterKeyResult = await utilCryptoService.mnemonicToMiniSecret(mnemonic);

  // Ensure masterKey is a proper Uint8Array (JSON-RPC serialization converts it to a plain object)
  const masterKey = masterKeyResult instanceof Uint8Array
    ? masterKeyResult
    : new Uint8Array(Object.values(masterKeyResult));

  return {
    mnemonic,
    masterKey,
  };
}

export async function recoverCloudWalletMasterKey(mnemonic: string): Promise<Uint8Array> {
  const masterKeyResult = await utilCryptoService.mnemonicToMiniSecret(mnemonic);

  // Ensure masterKey is a proper Uint8Array (JSON-RPC serialization converts it to a plain object)
  return masterKeyResult instanceof Uint8Array
    ? masterKeyResult
    : new Uint8Array(Object.values(masterKeyResult));
}

/**
 * Initialize the cloud wallet EDV service.
 *
 * Either `masterKey` or `mnemonic` must be provided. When both are supplied,
 * `masterKey` takes precedence since it is the derived key ready for use.
 *
 * @param {Object} params
 * @param {DataStore} [params.dataStore] - Optional data store
 * @param {string} params.edvUrl - EDV service URL
 * @param {string} params.authKey - Authentication key
 * @param {Uint8Array} [params.masterKey] - Pre-derived master key (takes precedence over mnemonic)
 * @param {string} [params.mnemonic] - BIP-39 mnemonic used to derive the master key
 */
export async function initializeCloudWallet({
  dataStore,
  edvUrl,
  authKey,
  masterKey,
  mnemonic,
}: {
  dataStore?: DataStore;
  edvUrl: string;
  authKey: string;
  masterKey?: Uint8Array;
  mnemonic?: string;
}) {
  if (masterKey) {
    await edvService.initializeFromMasterKey({ masterKey, edvUrl, authKey });
  } else if (mnemonic) {
    await edvService.initializeFromMnemonic({ mnemonic, edvUrl, authKey });
  } else {
    throw new Error('Either masterKey or mnemonic is required');
  }

  const documentQueues = new Map<string, DocumentQueue>();
  const activeOperations = new Set<Promise<any>>();

  async function processQueue(docId: string) {
    const queue = documentQueues.get(docId);
    if (!queue || queue.isProcessing) {
      return;
    }

    queue.isProcessing = true;

    while (queue.operations.length > 0) {
      const item = queue.operations.shift();
      if (!item) {
        continue;
      }

      let operationPromise: Promise<any>;
      try {
        operationPromise = item.operation();
        activeOperations.add(operationPromise);

        const result = await operationPromise;
        item.resolve(result);
      } catch (error) {
        item.reject(error);
        logger.error(`Operation failed for document ${docId}: ${error.message}`);
      } finally {
        activeOperations.delete(operationPromise);
      }
    }

    queue.isProcessing = false;
    documentQueues.delete(docId);
  }

  async function enqueueOperation(docId: string, operation: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      let queue = documentQueues.get(docId);
      if (!queue) {
        queue = { operations: [], isProcessing: false };
        documentQueues.set(docId, queue);
      }

      queue.operations.push({ operation, resolve, reject });

      // Ensure processQueue runs (even if it was already running)
      if (!queue.isProcessing) {
        setTimeout(() => processQueue(docId), 0);
      }
    });
  }

  function waitForEdvIdle(): Promise<void> {
    return new Promise((resolve) => {
      const checkIdle = () => {
        const hasActiveOperations = activeOperations.size > 0;
        const hasQueuedOperations = Array.from(documentQueues.values()).some(queue => queue.operations.length > 0);

        if (!hasActiveOperations && !hasQueuedOperations) {
          resolve();
        } else {
          setTimeout(checkIdle, 100); // Re-check until everything is idle
        }
      };

      checkIdle();
    });
  }

  async function findDocumentByContentId(id) {
    const result = await edvService.find({
      equals: {
        'content.id': id,
      },
    });

    return result.documents[0];
  }

  async function updateDocumentByContentId(documentContent) {
    const edvDocument = await findDocumentByContentId(documentContent.id);

    if (!edvDocument) {
      throw new Error('Document not found in EDV');
    }

    logger.debug(`Updating document ${documentContent.id} in EDV`);

    await edvService.update({
      document: {
        id: edvDocument.id,
        content: documentContent,
      },
    });

    logger.debug(`Document ${documentContent.id} updated in EDV`);
  }

  async function addDocumentHandler(content) {
    return enqueueOperation(content.id, async () => {
      try {
        logger.debug(`Adding document to EDV: ${content.id}`);
        await edvService.insert({
          document: {
            content: content,
          },
        });
        logger.debug(`Document added to EDV: ${content.id}`);
      } catch (error) {
        logger.error(`Unable to add document ${content.id}: ${error.message}`);
      }
    });
  }

  async function removeDocumentHandler(documentId) {
    return enqueueOperation(documentId, async () => {
      try {
        logger.debug(`Removing document from EDV: ${documentId}`);
        const edvDocument = await findDocumentByContentId(documentId);
        await edvService.delete({ document: edvDocument });
        // TODO: Remove this once we figure out why the data store is empty after deleting a document
        await pullDocuments();
        logger.debug(`Document removed from EDV: ${documentId}`);
      } catch (error) {
        logger.error(`Unable to remove document ${documentId}: ${error.message}`);
      }
    });
  }

  async function updateDocumentHandler(documentContent) {
    return enqueueOperation(documentContent.id, async () => {
      try {
        await updateDocumentByContentId(documentContent);
      } catch (error) {
        logger.error(`Unable to update document ${documentContent.id}: ${error.message}`);
      }
    });
  }

  dataStore.events.on(DataStoreEvents.DocumentCreated, addDocumentHandler);
  dataStore.events.on(DataStoreEvents.DocumentDeleted, removeDocumentHandler);
  dataStore.events.on(DataStoreEvents.DocumentUpdated, updateDocumentHandler);


  function unsubscribeEventListeners() {
    dataStore.events.off(DataStoreEvents.DocumentCreated, addDocumentHandler);
    dataStore.events.off(DataStoreEvents.DocumentDeleted, removeDocumentHandler);
    dataStore.events.off(DataStoreEvents.DocumentUpdated, updateDocumentHandler);
  }

  async function getSyncMarkerDiff() {
    const edvSyncMaker = await findDocumentByContentId(SYNC_MARKER_TYPE);
    const localSyncMarker = await dataStore.documents.getDocumentById(
      SYNC_MARKER_TYPE,
    );

    return edvSyncMaker?.content?.updatedAt - localSyncMarker?.updatedAt;
  }

  async function pushSyncMarker() {
    const edvSyncMarker = await findDocumentByContentId(SYNC_MARKER_TYPE);
    const syncMarker = {
      id: SYNC_MARKER_TYPE,
      type: SYNC_MARKER_TYPE,
      updatedAt: Date.now(),
    };

    if (edvSyncMarker) {
      await dataStore.documents.updateDocument(syncMarker);
    } else {
      await dataStore.documents.addDocument(syncMarker);
    }
  }

  async function pullDocuments() {
    logger.debug('Pulling documents from EDV');

    try {
      const allDocs = await edvService.find({});

      logger.debug(`Documents found in EDV: ${allDocs.documents.length}`);

      for (const doc of allDocs.documents) {
        const edvDoc = doc.content;
        const walletDoc = await dataStore.documents.getDocumentById(edvDoc.id);

        if (!walletDoc) {
          logger.debug(`Document ${edvDoc.id} not found in data store, adding to data store`);
          await dataStore.documents.addDocument(edvDoc, {
            stopPropagation: true,
          });
        }
      }
      return allDocs;
    } catch (err) {
      logger.error(`Error pulling documents from EDV: ${err.message}`);
    }

    return [];
  }

  async function clearEdvDocuments() {
    const allDocs = await edvService.find({});

    for (const doc of allDocs.documents) {
      await edvService.delete({ document: doc });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    clearEdvDocuments,
    pushSyncMarker,
    getSyncMarkerDiff,
    findDocumentByContentId,
    updateDocumentByContentId,
    waitForEdvIdle,
    pullDocuments,
    unsubscribeEventListeners,
  };
}
