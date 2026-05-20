/**
 * @module credential-provider
 * @description Verifiable credential management functionality for the Truvera Wallet SDK.
 * This module provides functions for importing, verifying, storing, and managing verifiable credentials.
 */

import {credentialServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/credential';
import {IWallet, ICredentialProvider} from './types';
export type {ICredentialProvider};
import assert from 'assert';
import {blockchainService} from '@docknetwork/wallet-sdk-wasm/src/services/blockchain';
import {acquireOpenIDCredentialFromURI} from './credentials/oidvc';
import {IDIDProvider} from './did-provider';

export type Credential = any;

/**
 * Internal function to check if a credential uses BBS+ signature
 * @private
 */
export function isBBSPlusCredential(credential) {
  return (
    (typeof credential?.proof?.type === 'string' &&
      credential.proof.type.includes('BBS+SignatureDock')) ||
    (Array.isArray(credential['@context']) &&
      credential['@context'].find(
        context => context.bs && context.bs.indexOf('bbs') > -1,
      ))
  );
}

type importCredentialFromUriParams = {
  uri: string;
  didProvider: IDIDProvider;
  getAuthCode?: (authorizationURL: string) => Promise<string>;
};

/**
 * Internal function to import credential from URI
 * @private
 */
export async function importCredentialFromURI({
  uri,
  wallet,
  didProvider,
  getAuthCode,
}: importCredentialFromUriParams & {
  wallet: IWallet;
}) {
  // TODO: unify the impl with the existing import credential flow
  // if the URI is an OpenID credential offer, use the OpenID flow
  // if the URI is a dock credential, then get user password and import that
  // we can add support for other types of credentials later
  const credential = await acquireOpenIDCredentialFromURI({
    didProvider,
    uri,
    getAuthCode,
  });

  await addCredential({wallet, credential});
}

/**
 * Internal function to check if credential is expired
 * @private
 */
export function isCredentialExpired(credential) {
  return (
    !!credential.expirationDate &&
    new Date(credential.expirationDate) < new Date()
  );
}

/**
 * Uses Dock SDK to verify a credential
 * @param credential
 * @returns {Promise<Object>} Verification result with status and optional error/warning messages
 */
export async function isValid({
  credential,
  wallet,
}: {
  credential: Credential;
  wallet: IWallet;
}): Promise<{
  status: string;
  error?: string;
  warning?: string;
}> {
  assert(!!credential, 'credential is required');

  try {
    if (isCredentialExpired(credential)) {
      return {
        status: CredentialStatus.Expired,
      };
    }

    const membershipWitness =
      credential[ACUMM_WITNESS_PROP_KEY] ||
      (await getMembershipWitness({
        credentialId: credential.id,
        wallet,
      }));

    delete credential[ACUMM_WITNESS_PROP_KEY];

    const verificationResult = await credentialServiceRPC.verifyCredential({
      credential,
      membershipWitness,
    });

    const {verified, error} = verificationResult;

    if (error) {
      const sdkNotInitialized = error?.errors?.find(err => err?.message === 'SDK is not initialized');
      if (sdkNotInitialized) {
        throw new Error(
          'SDK is not initialized. Please ensure the blockchain is connected.',
        );
      }
    }

    if (!verified) {
      if (
        typeof error === 'string' &&
        error.toLowerCase().includes('revocation')
      ) {
        return {
          status: CredentialStatus.Revoked,
          error,
        };
      }

      return {
        status: CredentialStatus.Invalid,
        error: error,
      };
    }

    return {
      status: CredentialStatus.Verified,
    };
  } catch (err) {
    // Handle unknown error, when we can't determine the status
    // Potential reasons can be network error, blockchain offline, internal SDK error
    console.error(err);

    // in this case we return the cached status if possible
    // It will avoid showing unknown status in case of a network error
    const statusDoc = await wallet.getDocumentById(`${credential.id}#status`);

    if (statusDoc) {
      return {
        ...statusDoc,
        warning: 'unable_to_refresh_status',
      };
    }

    // Return pending status
    // As we can't determine the status, and there is no cached status
    return {
      status: CredentialStatus.Pending,
      error: err.toString(),
    };
  }
}

export const ACUMM_WITNESS_PROP_KEY = '$$accum__witness$$';

/**
 * Internal function to add credential to wallet
 * @private
 */
export async function addCredential({wallet, credential}) {
  if (
    credential &&
    (typeof credential === 'string' || typeof credential === 'object')
  ) {
    try {
      const isSDJWT = await credentialServiceRPC.isSDJWTCredential({
        credential,
      });

      if (isSDJWT) {
        credential = await credentialServiceRPC.credentialToW3C({credential});
      }
    } catch (error) {
      console.error('Error checking/converting SD-JWT credential:', error);
      throw new Error('Failed to process SD-JWT credential: ' + error.message);
    }
  }

  const acummWitness = credential[ACUMM_WITNESS_PROP_KEY];

  if (acummWitness) {
    delete credential[ACUMM_WITNESS_PROP_KEY];
  }

  const response = await wallet.addDocument(credential);

  if (acummWitness) {
    await wallet.addDocument({
      type: 'AccumulatorWitness',
      id: `${credential.id}#witness`,
      value: acummWitness,
      initialWitness: acummWitness,
    });

    // Pre-fetch and cache the witness blockchain data in the background
    credentialServiceRPC.prefetchWitnessCache({
      credential,
      membershipWitness: acummWitness,
    });
  }

  syncCredentialStatus({wallet, credentialIds: [credential.id]});

  return response;
}

/**
 * Internal function to get membership witness for credential
 * @private
 */
async function getMembershipWitness({credentialId, wallet}) {
  const document = await wallet.getDocumentById(`${credentialId}#witness`);
  return document?.value;
}

export const CredentialStatus = {
  Invalid: 'invalid',
  Expired: 'expired',
  Verified: 'verified',
  Revoked: 'revoked',
  Pending: 'pending',
};

type SyncCredentialStatusParams = {
  // Optional credential IDs to sync
  credentialIds?: string[];
  // Skip the cache and re-fetch from the chain
  forceFetch?: boolean;
};

type CredentialStatusDocument = {
  id: string;
  status: string;
  error: string;
  warning?: string;
};

/**
 * Fetch credential status from the chain and update the wallet
 * Store a new document <credentialId>#status in the wallet
 * Returns a list of CredentialStatusDocument
 *
 * @param param0
 * @returns CredentialStatusDocument[]
 */
/**
 * Internal function to sync credential status from blockchain
 * @private
 */
async function syncCredentialStatus({
  wallet,
  credentialIds,
  forceFetch,
}: SyncCredentialStatusParams & {
  wallet: IWallet;
}): Promise<CredentialStatusDocument[]> {
  let credentials;

  if (credentialIds && credentialIds.length) {
    credentials = await wallet.getDocumentsById(credentialIds);
  } else {
    credentials = await wallet.getDocumentsByType('VerifiableCredential');
  }

  let statusDocs = [];

  let isApiConnected;

  for (const credential of credentials) {
    let shouldFetch = !!forceFetch;
    let statusDoc = await wallet.getDocumentById(`${credential.id}#status`);

    if (!statusDoc) {
      shouldFetch = true;
      statusDoc = {
        type: 'CredentialStatus',
        id: `${credential.id}#status`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: null,
      };

      await wallet.addDocument(statusDoc);
    }

    statusDocs.push(statusDoc);

    // Revoked and Expired statuses should be cached
    // The user can fore refresh that from the credentials screen
    if (!statusDoc.status || statusDoc.status === CredentialStatus.Invalid || statusDoc.status === CredentialStatus.Pending) {
      shouldFetch = true;
    }

    if (!shouldFetch) {
      // check if latest fetch was more than 24 hours ago
      const updatedAt = new Date(statusDoc.updatedAt);
      const diff = new Date().getTime() - updatedAt.getTime();
      const hours = Math.floor(diff / 1000 / 60 / 60);
      if (hours > 24) {
        shouldFetch = true;
      }
    }

    if (!shouldFetch) {
      continue;
    }

    if (!statusDoc.status) {
      statusDoc.status = CredentialStatus.Pending;
      statusDoc.updatedAt = new Date().toISOString();
      await wallet.updateDocument(statusDoc);
    }

    if (!isApiConnected) {
      await blockchainService.ensureBlockchainReady();
      isApiConnected = true;
    }

    const result = await isValid({credential, wallet});
    statusDoc.status = result?.status;
    statusDoc.error = result?.error;
    statusDoc.warning = result?.warning;
    statusDoc.updatedAt = new Date().toISOString();

    await wallet.updateDocument(statusDoc);
  }

  return statusDocs;
}

/**
 * Removes a credential and its related documents from the wallet
 * @param param0 
 * @returns {Promise<void>}
 */
/**
 * Internal function to remove credential and related documents
 * @private
 */
export async function removeCredential({
  wallet, 
  credential,
}: {
  wallet: IWallet;
  credential: Credential | string;
}): Promise<void> {
  // Allow passing either a credential object or a credential ID
  const credentialId = typeof credential === 'string' ? credential : credential.id;
  
  assert(!!credentialId, 'credential ID is required');
  
  // Remove the main credential document
  await wallet.removeDocument(credentialId);
  
  if (await wallet.getDocumentById(`${credentialId}#witness`)) {
    await wallet.removeDocument(`${credentialId}#witness`);
  }

  if (await wallet.getDocumentById(`${credentialId}#status`)) {
    await wallet.removeDocument(`${credentialId}#status`);
  }
}

/**
 * Creates a credential provider instance bound to a wallet
 * @param {Object} params - Provider configuration
 * @param {IWallet} params.wallet - The wallet instance to use for credential storage
 * @returns {ICredentialProvider} A credential provider instance with all verifiable credential management methods
 * @see {@link ICredentialProvider} - The interface defining all available credential provider methods
 * @example
 * import { createCredentialProvider } from '@docknetwork/wallet-sdk-core';
 *
 * const credentialProvider = createCredentialProvider({wallet});
 *
 * // Add a credential
 * const addedCredential = await credentialProvider.addCredential(myCredential);
 *
 * // Validate a credential
 * const result = await credentialProvider.isValid(credential);
 * if (result.status === 'verified') {
 *   console.log('Credential is valid');
 * }
 *
 * // Get all credentials
 * const allCredentials = credentialProvider.getCredentials();
 *
 * // Import from URI
 * await credentialProvider.importCredentialFromURI({
 *   uri: 'https://example.com/credential-offer',
 *   didProvider
 * });
 */
export function createCredentialProvider({
  wallet,
}: {
  wallet: IWallet;
}): ICredentialProvider {
  function getCredentials(type: string = 'VerifiableCredential') {
    return wallet.getDocumentsByType(type) as any;
  }

  return {
    /**
     * Imports a credential from a URI (supports OpenID credential offers)
     * @memberof ICredentialProvider
     * @param {Object} params - Import parameters
     * @param {string} params.uri - The URI containing the credential offer
     * @param {any} params.didProvider - DID provider instance for key management
     * @param {Function} [params.getAuthCode] - Optional callback to handle authorization
     * @returns {Promise<any>} The imported credential
     * @throws {Error} If import fails
     * @example
     * const credential = await credentialProvider.importCredentialFromURI({
     *   uri: 'https://issuer.example.com/credential-offer',
     *   didProvider,
     *   getAuthCode: async (url) => getUserAuthCode(url)
     * });
     */
    importCredentialFromURI: async (params: importCredentialFromUriParams) =>
      importCredentialFromURI({
        ...params,
        wallet,
      }),
    /**
     * Retrieves credentials from the wallet, optionally filtered by type
     * @memberof ICredentialProvider
     * @param {string} [type='VerifiableCredential'] - The credential type to filter by
     * @returns {any[]} Array of credentials matching the specified type
     * @example
     * const allCredentials = credentialProvider.getCredentials();
     * const certificates = credentialProvider.getCredentials('Certificate');
     */
    getCredentials,
    /**
     * Gets the membership witness for a credential (used for BBS+ credentials)
     * @memberof ICredentialProvider
     * @param {string} credentialId - The credential ID to get the witness for
     * @returns {Promise<any>} The membership witness data
     * @example
     * const witness = await credentialProvider.getMembershipWitness('credential-123');
     */
    getMembershipWitness: async (credentialId: string) =>
      getMembershipWitness({credentialId, wallet}),
    /**
     * Retrieves a credential by its ID
     * @memberof ICredentialProvider
     * @param {string} id - The unique identifier of the credential
     * @returns {any} The credential document
     * @throws {Error} If credential is not found
     * @example
     * const credential = await credentialProvider.getById('credential-123');
     */
    getById: (id: string) => wallet.getDocumentById(id),
    /**
     * Checks if a credential uses BBS+ signature
     * @memberof ICredentialProvider
     * @param {any} credential - The credential to check
     * @returns {boolean} True if the credential uses BBS+ signature
     * @example
     * const isBBS = credentialProvider.isBBSPlusCredential(credential);
     * if (isBBS) {
     *   console.log('This credential uses BBS+ signatures');
     * }
     */
    isBBSPlusCredential,
    /**
     * Validates a credential by verifying its cryptographic proof and status
     * @memberof ICredentialProvider
     * @param {any} credential - The credential to validate
     * @param {boolean} [forceFetch=false] - Whether to force refresh the credential status
     * @returns {Promise<Object>} Validation result
     * @returns {string} returns.status - Validation status (verified, revoked, expired, invalid, pending)
     * @returns {string} [returns.error] - Error message if validation failed
     * @returns {string} [returns.warning] - Warning message if any
     * @throws {Error} If validation fails
     * @example
     * const result = await credentialProvider.isValid(credential);
     * if (result.status === 'verified') {
     *   console.log('Credential is valid');
     * } else if (result.status === 'revoked') {
     *   console.log('Credential has been revoked');
     * }
     */
    isValid: async credential =>
      isValid({
        credential,
        wallet,
      }) as any,
    /**
     * Gets the current status of a credential (cached, fast operation)
     * @memberof ICredentialProvider
     * @param {any} credential - The credential to check
     * @returns {Promise<Object>} Current credential status
     * @returns {string} returns.status - Current status of the credential
     * @returns {string} [returns.error] - Error message if any
     * @example
     * const status = await credentialProvider.getCredentialStatus(credential);
     * console.log(`Credential status: ${status.status}`);
     */
    getCredentialStatus: async (credential: Credential) => {
      assert(!!credential, 'credential is required');

      if (isCredentialExpired(credential)) {
        return {
          status: CredentialStatus.Expired,
        };
      }

      const statusDoc = await wallet.getDocumentById(`${credential.id}#status`);

      return {
        status: statusDoc?.status || CredentialStatus.Pending,
        error: statusDoc?.error,
      };
    },
    /**
     * Synchronizes credential status from the blockchain
     * @memberof ICredentialProvider
     * @param {Object} params - Sync parameters
     * @param {string[]} [params.credentialIds] - Optional list of credential IDs to sync
     * @param {boolean} [params.forceFetch=false] - Whether to force refresh from blockchain
     * @returns {Promise<any[]>} Array of credential status documents
     * @example
     * // Sync all credentials
     * await credentialProvider.syncCredentialStatus({});
     *
     * // Sync specific credentials
     * await credentialProvider.syncCredentialStatus({
     *   credentialIds: ['cred-1', 'cred-2'],
     *   forceFetch: true
     * });
     */
    syncCredentialStatus: async (props: SyncCredentialStatusParams) => {
      return syncCredentialStatus({wallet, ...props});
    },
    /**
     * Adds a credential to the wallet
     * @memberof ICredentialProvider
     * @param {any} credential - The credential to add
     * @returns {Promise<any>} The added credential document
     * @example
     * const addedCredential = await credentialProvider.addCredential({
     *   '@context': ['https://www.w3.org/2018/credentials/v1'],
     *   type: ['VerifiableCredential'],
     *   issuer: 'did:dock:issuer123',
     *   credentialSubject: { name: 'Alice' }
     * });
     */
    addCredential: credential => addCredential({wallet, credential}),
    /**
     * Removes a credential and all its related documents from the wallet
     * @memberof ICredentialProvider
     * @param {any} credential - The credential to remove
     * @returns {Promise<void>}
     * @throws {Error} If credential is not found
     * @example
     * await credentialProvider.removeCredential(credential);
     * // Or by ID
     * await credentialProvider.removeCredential('credential-123');
     */
    removeCredential: credential => removeCredential({wallet, credential}),
    // TODO: move import credential from json or URL to this provider
  };
}
