import {
  DataStore,
  DocumentResolverResult,
  WalletDocument,
} from '@docknetwork/wallet-sdk-data-store/src/types';
import {EventEmitter} from 'events';

/**
 * Legacy V1 wallet interface for backward compatibility
 * @interface IV1Wallet
 * @deprecated This interface is obsolete and should not be used for new implementations. Use IWallet instead.
 */
export interface IV1Wallet {
  /**
   * Gets the current wallet status
   * @returns {string} The current status (e.g., 'ready', 'loading', 'error')
   */
  getStatus: () => string;
  
  /**
   * Sets the wallet status
   * @param {string} status - The new status to set
   */
  setStatus: (status: string) => void;
  
  /**
   * Event emitter for wallet events
   * @type {EventEmitter}
   */
  eventManager: EventEmitter;
  
  /**
   * Waits for a specific event to be emitted
   * @param {string} eventName - The event name to wait for
   * @returns {Promise<any>} Promise that resolves when the event is emitted
   */
  waitForEvent: (eventName: string) => Promise<any>;
  
  /**
   * Resolves correlations for a document ID
   * @param {string} id - The document ID to resolve correlations for
   * @returns {Promise<WalletDocument[]>} Array of correlated documents
   */
  resolveCorrelations: (id: string) => Promise<WalletDocument[]>;
  
  /**
   * Queries documents by ID or type
   * @param {Object} [params] - Query parameters
   * @param {string} [params.id] - Document ID to search for
   * @param {string} [params.type] - Document type to filter by
   * @returns {Promise<WalletDocument[]>} Array of matching documents
   */
  query: ({
    id,
    type,
  }?: {
    id?: string;
    type?: string;
  }) => Promise<WalletDocument[]>;

  /**
   * Ensures network connection is established
   * @returns {Promise<void>}
   */
  ensureNetwork: () => Promise<void>;
  
  /**
   * Synchronizes wallet data
   * @returns {Promise<void>}
   */
  sync: () => Promise<void>;
  
  /**
   * Removes a document (legacy method)
   * @param {string} id - Document ID to remove
   * @returns {Promise<void>}
   * @deprecated Use removeDocument instead
   */
  remove: (id: string) => Promise<void>;
  
  /**
   * Creates a new document (legacy method)
   * @param {any} json - Document data
   * @returns {Promise<WalletDocument>} The created document
   * @deprecated Use addDocument instead
   */
  create: (json: any) => Promise<WalletDocument>;
  
  /**
   * Updates a document (legacy method)
   * @param {any} json - Updated document data
   * @returns {Promise<WalletDocument>} The updated document
   * @deprecated Use updateDocument instead
   */
  update: (json: any) => Promise<WalletDocument>;
  
  /**
   * Creates or updates a document (legacy method)
   * @param {any} json - Document data
   * @returns {Promise<WalletDocument>} The created or updated document
   * @deprecated Use upsertDocument instead
   */
  upsert: (json: any) => Promise<WalletDocument>;
  
  /**
   * Deletes the entire wallet
   * @returns {Promise<void>}
   * @fires WalletEvents.walletDeleted
   */
  deleteWallet: () => Promise<void>;
}

/**
 * Main wallet interface providing methods for document management, import/export, and network operations.
 * @interface IWallet
 * @extends {IV1Wallet}
 */
export interface IWallet extends IV1Wallet{
  /**
   * Retrieves a document by its ID
   * @param {string} id - The unique identifier of the document
   * @returns {Promise<WalletDocument>} The document with the specified ID
   * @throws {Error} If document is not found
   */
  getDocumentById: (id: string) => Promise<WalletDocument>;
  
  /**
   * Retrieves multiple documents by their IDs
   * @param {string[]} idList - Array of document IDs to retrieve
   * @returns {Promise<WalletDocument[]>} Array of documents matching the provided IDs
   */
  getDocumentsById: (idList: string[]) => Promise<WalletDocument[]>;
  
  /**
   * Retrieves all documents of a specific type
   * @param {string} type - The document type to filter by (e.g., 'VerifiableCredential', 'DIDDocument')
   * @returns {Promise<WalletDocument[]>} Array of documents matching the specified type
   */
  getDocumentsByType: (type: string) => Promise<WalletDocument[]>;
  
  /**
   * Retrieves all documents stored in the wallet
   * @returns {Promise<WalletDocument[]>} Array of all documents in the wallet
   */
  getAllDocuments: () => Promise<WalletDocument[]>;
  
  /**
   * Adds a new document to the wallet
   * @param {any} json - The document to add (must have valid JSON-LD structure)
   * @param {any} [options] - Optional parameters for document creation
   * @returns {Promise<WalletDocument>} The created document with generated metadata
   * @fires WalletEvents.documentAdded
   */
  addDocument: (json: any, options?: any) => Promise<WalletDocument>;
  
  /**
   * Creates or updates a document based on its ID
   * @param {any} json - The document to create or update
   * @param {any} [options] - Optional parameters for the operation
   * @returns {Promise<WalletDocument>} The created or updated document
   */
  upsertDocument: (json: any, options?: any) => Promise<WalletDocument>;
  
  /**
   * Updates an existing document
   * @param {any} json - The document with updated data (must include ID)
   * @param {any} [options] - Optional parameters for document update
   * @returns {Promise<WalletDocument>} The updated document
   * @fires WalletEvents.documentUpdated
   * @throws {Error} If document doesn't exist
   */
  updateDocument: (json: any, options?: any) => Promise<WalletDocument>;
  
  /**
   * Gets all documents correlated to a specific document
   * @param {string} documentId - The ID of the document to find correlations for
   * @returns {Promise<WalletDocument[]>} Array of correlated documents
   */
  getDocumentCorrelations: (documentId: string) => Promise<WalletDocument[]>;
  
  /**
   * Retrieves the keypair associated with an account
   * @param {string} accountId - The account ID to get the keypair for
   * @returns {Promise<any>} The keypair associated with the account
   */
  getAccountKeyPair: (accountId: string) => Promise<any>;
  
  /**
   * Removes a document from the wallet
   * @param {string} id - The ID of the document to remove
   * @param {any} [options] - Optional parameters for document removal
   * @returns {Promise<void>}
   * @fires WalletEvents.documentRemoved
   * @throws {Error} If document is not found
   */
  removeDocument: (id: string, options?: any) => Promise<void>;
  
  /**
   * Imports documents from an encrypted Universal Wallet 2020 JSON
   * @param {any} json - The encrypted wallet JSON
   * @param {string} password - Password to decrypt the wallet
   * @returns {Promise<void>}
   * @see {@link https://w3c-ccg.github.io/universal-wallet-interop-spec/}
   */
  importUniversalWalletJSON: (json: any, password: string) => Promise<void>;
  
  /**
   * Decrypts and retrieves documents from an encrypted wallet without importing
   * @param {any} json - The encrypted wallet JSON
   * @param {string} password - Password to decrypt the wallet
   * @returns {Promise<any>} Array of decrypted documents
   * @see {@link https://w3c-ccg.github.io/universal-wallet-interop-spec/}
   */
  getDocumentsFromEncryptedWallet: (
    json: any,
    password: string,
  ) => Promise<any>;
  
  /**
   * Exports specified documents as an encrypted JSON
   * @param {Object} params - Export parameters
   * @param {any[]} params.documents - Documents to export
   * @param {string} params.password - Password for encryption
   * @returns {Promise<any>} Encrypted wallet JSON
   */
  exportDocuments: (params: {documents: any; password: string}) => Promise<any>;
  
  /**
   * Exports the entire wallet as an encrypted Universal Wallet 2020 JSON
   * @param {string} password - Password for encryption
   * @returns {any} Encrypted Universal Wallet JSON representation
   * @see {@link https://w3c-ccg.github.io/universal-wallet-interop-spec/}
   */
  exportUniversalWalletJSON: (password: string) => any;

  /**
   * Sets the active network for the wallet
   * @param {string} networkId - The network identifier to switch to
   * @returns {Promise<void>}
   * @fires WalletEvents.networkUpdated
   */
  setNetwork: (networkId: string) => Promise<void>;
  
  /**
   * Gets the current network ID
   * @returns {string} The current network identifier
   */
  getNetworkId: () => string;
  
  /**
   * Resolves network-specific information for a document
   * @param {any} document - The document to resolve network info for
   * @returns {Promise<DocumentResolverResult>} Network resolution result
   */
  resolveDocumentNetwork: (document: any) => Promise<DocumentResolverResult>;
  
  /**
   * The underlying data store instance
   * @type {DataStore}
   */
  dataStore: DataStore;
  
  /**
   * Network check interval handle (if periodic checks are enabled)
   * @type {NodeJS.Timeout | number | undefined}
   */
  networkCheckInterval?: NodeJS.Timeout | number;
};

export type CrateWalletWithDataStore = {
  
}

export type CreateWalletProps = {
  dataStore: DataStore;
}


/**
 * Possible wallet status values
 * @typedef {'closed' | 'loading' | 'ready' | 'error'} WalletStatus
 */
export type WalletStatus = 'closed' | 'loading' | 'ready' | 'error';

/**
 * Supported keypair types
 * @typedef {'sr25519' | 'ed25519' | 'ecdsa'} KeypairType
 */
export type KeypairType = 'sr25519' | 'ed25519' | 'ecdsa';

export const WalletEvents = {
  ready: 'ready',
  error: 'error',
  migrated: 'migrated',
  statusUpdated: 'status-updated',
  documentAdded: 'document-added',
  documentUpdated: 'document-updated',
  documentRemoved: 'document-removed',
  walletDeleted: 'wallet-deleted',
  walletImported: 'wallet-imported',
  networkUpdated: 'network-updated',
  networkConnected: 'network-connected',
  networkError: 'network-error',
};

/**
 * Interface for DID provider operations
 * @interface IDIDProvider
 * @description Provides a high-level API for DID management operations
 */
export interface IDIDProvider {
  /**
   * Imports a DID from an encrypted wallet JSON
   * @param {Object} params - Import parameters
   * @param {any} params.encryptedJSONWallet - The encrypted wallet JSON containing the DID
   * @param {string} params.password - Password to decrypt the wallet
   * @returns {Promise<any[]>} Array of imported documents
   * @throws {Error} If password is incorrect or DID already exists in wallet
   */
  importDID: (params: {encryptedJSONWallet: any; password: string}) => Promise<any>;

  /**
   * Creates a new DID:key with an associated keypair
   * @param {Object} params - Creation parameters
   * @param {string} params.name - The name for the new DID
   * @param {string} [params.derivePath] - Optional derivation path for the keypair
   * @param {string} [params.type] - Optional key type specification
   * @returns {Promise<{keyDoc: any, didDocumentResolution: any}>} The created keypair and DID document
   * @throws {Error} If name is not provided
   */
  createDIDKey: (params: {name: string; derivePath?: string; type?: string}) => Promise<any>;

  /**
   * Edits a DID document's name
   * @param {Object} params - Edit parameters
   * @param {string} params.id - The ID of the DID document to edit
   * @param {string} params.name - The new name for the DID
   * @returns {Promise<void>}
   * @throws {Error} If document ID is not set or document not found
   */
  editDID: (params: {id: string; name: string}) => Promise<void>;

  /**
   * Deletes a DID from the wallet
   * @param {Object} params - Delete parameters
   * @param {string} params.id - The ID of the DID document to delete
   * @returns {Promise<void>}
   * @throws {Error} If document ID is not set
   */
  deleteDID: (params: {id: string}) => Promise<void>;

  /**
   * Exports a DID and its correlated documents as an encrypted JSON
   * @param {Object} params - Export parameters
   * @param {string} params.id - The ID of the DID document to export
   * @param {string} params.password - Password for encryption
   * @returns {Promise<any>} Encrypted wallet JSON containing the DID and correlations
   * @throws {Error} If DID document or keypair not found
   */
  exportDID: (params: {id: string; password: string}) => Promise<any>;

  /**
   * Retrieves all DIDs stored in the wallet
   * @returns {Promise<any[]>} Array of DID resolution response documents
   */
  getAll: () => Promise<any>;

  /**
   * Retrieves all keypairs associated with DIDs in the wallet
   * @returns {Promise<any[]>} Array of keypair documents
   */
  getDIDKeyPairs: () => Promise<any>;

  /**
   * Ensures at least one DID exists in the wallet, creating a default if none exist
   * @returns {Promise<{keyDoc: any, didDocumentResolution: any}|void>} The created DID if one was created, undefined otherwise
   */
  ensureDID: () => Promise<any>;

  /**
   * Gets the default DID from the wallet (first DID if exists)
   * @returns {Promise<string|undefined>} The default DID identifier or undefined if no DIDs exist
   */
  getDefaultDID: () => Promise<string>;

  /**
   * Creates and stores a P-256 (secp256r1) signing key attached to an
   * existing DID as its controller. Unlike `createDIDKey`, this does not
   * mint a new did:key document — it's a bare keypair document for
   * callers that need a raw ES256-capable signing key (e.g. AP2 mandate
   * `cnf`/holder-binding keys) associated with a DID they already control.
   * @param {Object} params - Creation parameters
   * @param {string} params.controller - The DID this key document is attached to
   * @param {string} [params.name] - Optional label for the stored document
   * @param {string} [params.type] - Key type to generate (default 'secp256r1')
   * @returns {Promise<any>} The stored key document (includes `id`, `publicKeyBase58`, etc.)
   * @throws {Error} If controller is not a valid DID
   */
  createSigningKey: (params: {controller: string; name?: string; type?: string}) => Promise<any>;

  /**
   * Signs arbitrary bytes with a previously-stored signing key (e.g. one
   * created via `createSigningKey`) and returns the raw signature bytes —
   * no JWT/VC framing. Works with any stored key document, not just
   * did:key-method DIDs.
   * @param {Object} params - Signing parameters
   * @param {string} params.keyId - The id of the stored key document to sign with
   * @param {Uint8Array} params.data - The bytes to sign
   * @returns {Promise<Uint8Array>} The raw signature bytes
   * @throws {Error} If no stored document matches keyId
   */
  signWithKeyId: (params: {keyId: string; data: Uint8Array}) => Promise<Uint8Array>;
}

/**
 * Interface for DIDComm message provider operations
 * @interface IMessageProvider
 * @description Provides a high-level API for DIDComm message management operations
 */
export interface IMessageProvider {
  /**
   * Sends a DIDComm message to a recipient
   * @memberof IMessageProvider
   * @param {Object} params - Message parameters
   * @param {string} [params.from] - Sender DID identifier
   * @param {string} [params.to] - Recipient DID identifier
   * @param {any} [params.message] - Message payload to send
   * @param {string} [params.type] - DIDComm message type
   * @param {string} [params.did] - @deprecated Use 'from' instead - Sender DID identifier
   * @param {string} [params.recipientDid] - @deprecated Use 'to' instead - Recipient DID identifier
   * @param {any} [params.body] - @deprecated Use 'message' instead - Message payload to send
   * @returns {Promise<any>} Result of sending the message
   * @throws {Error} If sender DID not found or message sending fails
   * @example
   * await messageProvider.sendMessage({
   *   from: 'did:key:sender123',
   *   to: 'did:key:recipient456',
   *   message: { hello: 'world' },
   *   type: 'basic-message'
   * });
   *
   */
  sendMessage: (params: {
    from?: string;
    to?: string;
    message?: any;
    type?: string;
    /** @deprecated Use 'from' instead */
    did?: string;
    /** @deprecated Use 'to' instead */
    recipientDid?: string;
    /** @deprecated Use 'message' instead */
    body?: any;
  }) => Promise<any>;

  /**
   * Fetches new messages from the relay service
   * @returns {Promise<void>}
   * @throws {Error} If message fetching fails
   */
  fetchMessages: () => Promise<void>;

  /**
   * Processes stored DIDComm messages and decrypts them
   * @returns {Promise<void>}
   * @throws {Error} If message processing fails
   */
  processDIDCommMessages: () => Promise<void>;

  /**
   * Starts automatic message fetching at regular intervals
   * @param {number} [timeout=2000] - Interval in milliseconds between fetch operations
   * @returns {Function} Function to stop the auto-fetch process
   */
  startAutoFetch: (timeout?: number) => () => void;

  /**
   * Adds a listener for when messages are decrypted
   * @param {Function} handler - Callback function to handle decrypted messages
   * @returns {Function} Function to remove the listener
   */
  addMessageListener: (handler: (message: any) => void) => () => void;

  /**
   * Waits for the next incoming message
   * @returns {Promise<any>} Promise that resolves with the next received message
   */
  waitForMessage: () => Promise<any>;

  /**
   * Marks a message as read and removes it from storage
   * @param {string} messageId - The ID of the message to mark as read
   * @returns {Promise<void>}
   * @throws {Error} If message is not found or not a DIDComm message
   */
  markMessageAsRead: (messageId: string) => Promise<void>;

  /**
   * Clears all cached messages from the wallet
   * @returns {Promise<void>}
   */
  clearCache: () => Promise<void>;

  /**
   * Starts the recurrent message processing job
   * @returns {Promise<void>}
   */
  processMessageRecurrentJob: () => Promise<void>;

  /**
   * Stops all message fetching and processing timers
   */
  stop: () => void;
}

/**
 * Interface for verifiable credential provider operations
 * @interface ICredentialProvider
 * @description Provides a high-level API for verifiable credential management operations
 */
export interface ICredentialProvider {
  /**
   * Retrieves credentials from the wallet, optionally filtered by type
   * @param {string} [type='VerifiableCredential'] - The credential type to filter by
   * @returns {any[]} Array of credentials matching the specified type
   * @example
   * const allCredentials = credentialProvider.getCredentials();
   * const certificates = credentialProvider.getCredentials('Certificate');
   */
  getCredentials: (type?: string) => any[];

  /**
   * Retrieves a credential by its ID
   * @param {string} id - The unique identifier of the credential
   * @returns {any} The credential document
   * @throws {Error} If credential is not found
   */
  getById: (id: string) => any;

  /**
   * Gets the membership witness for a credential (used for BBS+ credentials)
   * @param {any} credential - The credential to get the witness for
   * @returns {Promise<any>} The membership witness data
   */
  getMembershipWitness: (credential: any) => Promise<any>;

  /**
   * Checks if a credential uses BBS+ signature
   * @param {any} credential - The credential to check
   * @returns {boolean} True if the credential uses BBS+ signature
   */
  isBBSPlusCredential: (credential: any) => boolean;

  /**
   * Validates a credential by verifying its cryptographic proof and status
   * @param {any} credential - The credential to validate
   * @param {boolean} [forceFetch=false] - Whether to force refresh the credential status
   * @returns {Promise<{status: string, error?: string, warning?: string}>} Validation result
   * @throws {Error} If validation fails
   * @example
   * const result = await credentialProvider.isValid(credential);
   * if (result.status === 'verified') {
   *   console.log('Credential is valid');
   * }
   */
  isValid: (credential: any, forceFetch?: boolean) => Promise<{
    status: string;
    error?: string;
    warning?: string;
  }>;

  /**
   * Adds a credential to the wallet
   * @param {any} credential - The credential to add
   * @returns {Promise<any>} The added credential document
   * @example
   * const addedCredential = await credentialProvider.addCredential(myCredential);
   */
  addCredential: (credential: any) => Promise<any>;

  /**
   * Imports a credential from a URI (supports OpenID credential offers)
   * @param {Object} params - Import parameters
   * @param {string} params.uri - The URI containing the credential offer
   * @param {any} params.didProvider - DID provider instance for key management
   * @param {Function} [params.getAuthCode] - Optional callback to handle authorization
   * @returns {Promise<any>} The imported credential
   * @throws {Error} If import fails
   */
  importCredentialFromURI: (params: {
    uri: string;
    didProvider: any;
    getAuthCode?: (authorizationURL: string) => Promise<string>;
  }) => Promise<any>;

  /**
   * Synchronizes credential status from the blockchain
   * @param {Object} params - Sync parameters
   * @param {string[]} [params.credentialIds] - Optional list of credential IDs to sync
   * @param {boolean} [params.forceFetch=false] - Whether to force refresh from blockchain
   * @returns {Promise<any[]>} Array of credential status documents
   */
  syncCredentialStatus: (params: {
    credentialIds?: string[];
    forceFetch?: boolean;
  }) => Promise<any[]>;

  /**
   * Gets the current status of a credential (cached, fast operation)
   * @param {any} credential - The credential to check
   * @returns {Promise<{status: string, error?: string}>} Current credential status
   */
  getCredentialStatus: (credential: any) => Promise<{status: string; error?: string}>;

  /**
   * Removes a credential and all its related documents from the wallet
   * @param {any} credential - The credential to remove
   * @returns {Promise<void>}
   * @throws {Error} If credential is not found
   */
  removeCredential: (credential: any) => Promise<void>;
}

/**
 * Configuration options for biometric provider operations
 * @typedef {Object} BiometricsProviderConfigs
 * @template E - Type for IDV-specific configurations
 * @property {string} enrollmentCredentialType - The credential type used for biometric enrollment
 * @property {string} biometricMatchCredentialType - The credential type used for biometric matching
 * @property {E} idvConfigs - IDV provider-specific configuration options
 */
export type BiometricsProviderConfigs<E> = {
  enrollmentCredentialType: string;
  biometricMatchCredentialType: string;
  idvConfigs: E;
};

/**
 * Options for IDV (Identity Verification) process callbacks
 * @interface IDVProcessOptions
 * @description Callback functions for handling different stages of the identity verification process
 */
export interface IDVProcessOptions {
  /**
   * Called when a deep link is triggered during IDV process
   */
  onDeepLink?: () => void;

  /**
   * Called when a message is received during IDV process
   */
  onMessage?: () => void;

  /**
   * Called when an error occurs during IDV process
   * @param {Error} error - The error that occurred
   */
  onError?: (error: Error) => void;

  /**
   * Called when the IDV process is cancelled
   */
  onCancel?: () => void;

  /**
   * Called when the IDV process completes successfully
   * @param {any} credential - The credential issued upon completion
   */
  onComplete?: (credential: any) => void;
}

/**
 * Interface for biometric plugin implementations
 * @interface BiometricPlugin
 * @description Defines the contract for biometric enrollment and matching operations
 */
export interface BiometricPlugin {
  /**
   * Performs biometric enrollment for a wallet DID
   * @param {string} walletDID - The DID of the wallet to enroll
   * @returns {Promise<any>} The enrollment result document
   * @throws {Error} If enrollment fails
   */
  onEnroll: (walletDID: string) => Promise<any>;

  /**
   * Performs biometric matching against an enrollment credential
   * @param {string} walletDID - The DID of the wallet performing the match
   * @param {any} enrollmentCredential - The enrollment credential to match against
   * @returns {Promise<any>} The matching result document
   * @throws {Error} If matching fails
   */
  onMatch: (walletDID: string, enrollmentCredential: any) => Promise<any>;
}

/**
 * Interface for IDV (Identity Verification) provider implementations
 * @interface IDVProvider
 * @description Defines the contract for identity verification operations
 */
export interface IDVProvider {
  /**
   * Enrolls a user with biometric data and issues credentials
   * @param {string} walletDID - The DID of the wallet to enroll
   * @param {any} proofRequest - The proof request for enrollment
   * @returns {Promise<{enrollmentCredential: any, matchCredential: any}>} Both enrollment and match credentials
   * @throws {Error} If enrollment fails
   */
  enroll: (
    walletDID: string,
    proofRequest: any,
  ) => Promise<{enrollmentCredential: any; matchCredential: any}>;

  /**
   * Matches biometric data against an enrollment credential
   * @param {string} walletDID - The DID of the wallet performing the match
   * @param {any} enrollmentCredential - The enrollment credential to match against
   * @param {any} proofRequest - The proof request for matching
   * @returns {Promise<{matchCredential: any}>} The match credential
   * @throws {Error} If matching fails
   */
  match: (
    walletDID: string,
    enrollmentCredential: any,
    proofRequest: any,
  ) => Promise<{matchCredential: any}>;
}

/**
 * Factory interface for creating IDV provider instances
 * @interface IDVProviderFactory
 * @description Creates IDV provider instances with proper event handling and wallet integration
 */
export interface IDVProviderFactory {
  /**
   * Creates an IDV provider instance
   * @param {EventEmitter} eventEmitter - Event emitter for IDV process events
   * @param {IWallet} wallet - The wallet instance for credential storage
   * @returns {IDVProvider} A configured IDV provider instance
   */
  create: (eventEmitter: EventEmitter, wallet: IWallet) => IDVProvider;
}

/**
 * Interface for biometric provider operations
 * @interface IBiometricProvider
 * @description Provides a high-level API for biometric identity verification operations
 */
export interface IBiometricProvider {
  /**
   * Starts the identity verification process
   * @param {any} proofRequest - The proof request to fulfill through IDV
   * @returns {Promise<{enrollmentCredential: any, matchCredential: any}>} The enrollment and match credentials
   * @throws {Error} If IDV process fails
   */
  startIDV: (proofRequest: any) => Promise<{
    enrollmentCredential: any;
    matchCredential: any;
  }>;

  /**
   * Event emitter for IDV process events
   * @type {EventEmitter}
   */
  eventEmitter: EventEmitter;
}
