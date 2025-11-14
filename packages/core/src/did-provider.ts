/**
 * @module did-provider
 * @description DID (Decentralized Identifier) management functionality for the Truvera Wallet SDK.
 * This module provides functions for creating, importing, exporting, and managing DIDs.
 */

import {IWallet, IDIDProvider} from './types';
export type {IDIDProvider};
import {didServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/dids/index';
import assert from 'assert';

/**
 * Internal function to import a DID from an encrypted wallet JSON
 * @private
 */
export async function importDID({
  wallet,
  encryptedJSONWallet,
  password,
}: {
  wallet: IWallet;
  encryptedJSONWallet: any;
  password: string;
}) {
  try {
    const rawDocs = await wallet.getDocumentsFromEncryptedWallet(
      encryptedJSONWallet,
      password,
    );

    // TODO: Will implement a network check for did:dock here, there is a jira for it already

    const docs = rawDocs.map(rawDoc => {
      if (Array.isArray(rawDoc.type) && rawDoc.type.length > 0) {
        return {
          ...rawDoc,
          type: rawDoc.type[0],
        };
      }
      return rawDoc;
    });

    for (const doc of docs) {
      const existingDoc = await wallet.getDocumentById(doc.id);

      if (!existingDoc) {
        await wallet.addDocument(doc);
      } else if (
        existingDoc.type === 'DIDResolutionResponse'
      ) {
        throw new Error('DID already exists in wallet');
      }
    }
    return docs;
  } catch (e) {
    switch (e.message) {
      case 'No matching recipient found for key agreement key.':
        throw new Error('Incorrect password');
      default:
        throw e;
    }
  }
}

/**
 * Internal function to edit a DID document's name
 * @private
 */
async function editDID({wallet, id, name}){
  if (typeof id === 'string' && id.length > 0) {
    const doc = await wallet.getDocumentById(id);
    if (doc) {
      await wallet.updateDocument({
        ...doc,
        name,
      });
    }
  } else {
    throw new Error('Document ID is not set');
  }
};

/**
 * Internal function to delete a DID from the wallet
 * @private
 */
async function deleteDID({wallet, id}){
  if (typeof id === 'string' && id.length > 0) {
    return await wallet.removeDocument(id);
  } else {
    throw Error('Document ID is not set');
  }
}

/**
 * Internal function to export a DID and its correlated documents
 * @private
 */
async function exportDID({wallet, id, password }){
  const existingDoc = await wallet.getDocumentById(id);
  if (existingDoc) {
    const allCorrelationDocuments = (
      await wallet.getDocumentCorrelations(id)
    ).filter(doc => doc && doc?.id !== existingDoc.id);
    const documentsToExport = [existingDoc, ...allCorrelationDocuments];

    if (allCorrelationDocuments.length >= 1) {
      return wallet.exportDocuments({
        documents: documentsToExport,
        password,
      });
    }
    throw new Error('DID KeyPair not found');
  }

  throw new Error('DID Document not found');
}

/**
 * Internal function to create a DID document from a keypair document
 * @private
 */
export const createDIDKeyDocument = async (
  keypairDoc: any,
  didDocParams: any = {},
) => {
  const keypairDocCorrelations = Array.isArray(keypairDoc.correlation)
    ? keypairDoc.correlation
    : [];

  const {didDocument} = await didServiceRPC.keypairToDIDKeyDocument({
    keypairDoc: keypairDoc,
  });

  const didDocumentResolution = await didServiceRPC.getDIDResolution({
    didDocumentCustomProp: didDocParams,
    didDocument,
  } as any);

  didDocumentResolution.correlation.push(keypairDoc.id);

  keypairDocCorrelations.push(didDocumentResolution.id);

  return {
    didDocumentResolution,
    keypairDoc,
  };
};

/**
 * Internal function to create a new DID:key with an associated keypair
 * @private
 */
export async function createDIDKey({wallet, name, derivePath=undefined, type=undefined}) {
  assert(!!wallet, 'wallet is required');
  assert(!!name, 'name is required');

  const keyDoc = await didServiceRPC.generateKeyDoc({derivePath, type});

  const {didDocumentResolution} = await createDIDKeyDocument(keyDoc, {
    name,
  });

  await wallet.addDocument(keyDoc);
  await wallet.addDocument(didDocumentResolution);

  return {
    keyDoc,
    didDocumentResolution,
  };
}

/**
 * Internal function to retrieve all DIDs stored in the wallet
 * @private
 */
export async function getAll({wallet}) {
  assert(!!wallet, 'wallet is required');
  const dids = await wallet.getDocumentsByType('DIDResolutionResponse');
  return dids;
}

/**
 * Internal function to get the default DID from the wallet
 * @private
 */
export async function getDefaultDID({wallet}) {
  assert(!!wallet, 'wallet is required');
  const allDids = await getAll({ wallet });
  return allDids[0]?.didDocument.id;
}

/**
 * Internal function to retrieve all keypairs associated with DIDs
 * @private
 */
export async function getDIDKeyPairs({wallet}) {
  assert(!!wallet, 'wallet is required');
  const didDocs = await getAll({wallet});
  const keyPairs = [];
  for (const didDoc of didDocs) {
    const keyPair = await wallet.getDocumentById(didDoc.correlation[0]);
    keyPairs.push(keyPair);
  }
  return keyPairs;
}


export async function ensureDID({wallet}) {
  assert(!!wallet, 'wallet is required');
  const dids = await getAll({wallet});
  if (dids.length === 0) {
    return createDIDKey({wallet, name: 'Default DID'});
  }
}


/**
 * Creates a DID provider instance bound to a wallet
 * @param {Object} params - Provider configuration
 * @param {IWallet} params.wallet - The wallet instance to bind the provider to
 * @returns {IDIDProvider} A DID provider instance with all DID management methods
 * @see {@link IDIDProvider} - The interface defining all available DID provider methods
 * @example
 * import { createDIDProvider } from '@docknetwork/wallet-sdk-core';
 *
 * const didProvider = createDIDProvider({wallet});
 *
 * // Create a new DID
 * const {keyDoc, didDocumentResolution} = await didProvider.createDIDKey({
 *   name: 'My DID'
 * });
 *
 * // Get all DIDs
 * const allDIDs = await didProvider.getAll();
 *
 * // Export a DID
 * const exportedDID = await didProvider.exportDID({
 *   id: didDocumentResolution.id,
 *   password: 'mypassword'
 * });
 */
export function createDIDProvider({wallet}): IDIDProvider {
  const provider = {
    /**
     * Imports a DID from an encrypted wallet JSON
     * @memberof IDIDProvider
     * @param {Object} params - Import parameters
     * @param {any} params.encryptedJSONWallet - The encrypted wallet JSON containing the DID
     * @param {string} params.password - Password to decrypt the wallet
     * @returns {Promise<any[]>} Array of imported documents
     * @throws {Error} If password is incorrect or DID already exists in wallet
     * @example
     * const importedDocs = await didProvider.importDID({
     *   encryptedJSONWallet: encryptedBackup,
     *   password: 'mypassword'
     * });
     */
    async importDID({encryptedJSONWallet, password}) {
      return importDID({wallet, encryptedJSONWallet, password});
    },
    /**
     * Creates a new DID:key with an associated keypair
     * @memberof IDIDProvider
     * @param {Object} params - Creation parameters
     * @param {string} params.name - The name for the new DID
     * @param {string} [params.derivePath] - Optional derivation path for the keypair
     * @param {string} [params.type] - Optional key type specification
     * @returns {Promise<{keyDoc: any, didDocumentResolution: any}>} The created keypair and DID document
     * @throws {Error} If name is not provided
     * @example
     * const {keyDoc, didDocumentResolution} = await didProvider.createDIDKey({
     *   name: 'My Identity DID',
     *   derivePath: "m/44'/60'/0'/0/0"
     * });
     */
    async createDIDKey({name, derivePath, type}) {
      return createDIDKey({wallet, name, derivePath, type});
    },
    /**
     * Edits a DID document's name
     * @memberof IDIDProvider
     * @param {Object} params - Edit parameters
     * @param {string} params.id - The ID of the DID document to edit
     * @param {string} params.name - The new name for the DID
     * @returns {Promise<void>}
     * @throws {Error} If document ID is not set or document not found
     * @example
     * await didProvider.editDID({
     *   id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
     *   name: 'Updated DID Name'
     * });
     */
    async editDID(params) {
      return editDID({wallet, ...params});
    },
    /**
     * Deletes a DID from the wallet
     * @memberof IDIDProvider
     * @param {Object} params - Delete parameters
     * @param {string} params.id - The ID of the DID document to delete
     * @returns {Promise<void>}
     * @throws {Error} If document ID is not set
     * @example
     * await didProvider.deleteDID({
     *   id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
     * });
     */
    async deleteDID(params) {
      return deleteDID({wallet, ...params});
    },
    /**
     * Exports a DID and its correlated documents as an encrypted JSON
     * @memberof IDIDProvider
     * @param {Object} params - Export parameters
     * @param {string} params.id - The ID of the DID document to export
     * @param {string} params.password - Password for encryption
     * @returns {Promise<any>} Encrypted wallet JSON containing the DID and correlations
     * @throws {Error} If DID document or keypair not found
     * @example
     * const exportedDID = await didProvider.exportDID({
     *   id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
     *   password: 'mypassword'
     * });
     */
    async exportDID(params) {
      return exportDID({wallet, ...params});
    },
    /**
     * Retrieves all DIDs stored in the wallet
     * @memberof IDIDProvider
     * @returns {Promise<any[]>} Array of DID resolution response documents
     * @example
     * const allDIDs = await didProvider.getAll();
     * console.log(`Found ${allDIDs.length} DIDs in wallet`);
     */
    async getAll() {
      return getAll({wallet});
    },
    /**
     * Retrieves all keypairs associated with DIDs in the wallet
     * @memberof IDIDProvider
     * @returns {Promise<any[]>} Array of keypair documents
     * @example
     * const keyPairs = await didProvider.getDIDKeyPairs();
     * console.log(`Found ${keyPairs.length} DID keypairs`);
     */
    async getDIDKeyPairs() {
      return getDIDKeyPairs({wallet});
    },
    /**
     * Ensures at least one DID exists in the wallet, creating a default if none exist
     * @memberof IDIDProvider
     * @returns {Promise<{keyDoc: any, didDocumentResolution: any}|void>} The created DID if one was created, undefined otherwise
     * @example
     * // Ensure wallet has at least one DID
     * await didProvider.ensureDID();
     */
    async ensureDID() {
      return ensureDID({wallet});
    },
    /**
     * Gets the default DID from the wallet (first DID if exists)
     * @memberof IDIDProvider
     * @returns {Promise<string|undefined>} The default DID identifier or undefined if no DIDs exist
     * @example
     * const defaultDID = await didProvider.getDefaultDID();
     * if (defaultDID) {
     *   console.log(`Default DID: ${defaultDID}`);
     * }
     */
    async getDefaultDID() {
      return getDefaultDID({wallet});
    }
  };


  return provider;
}
