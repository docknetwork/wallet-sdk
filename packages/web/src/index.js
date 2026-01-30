/**
 * @fileoverview Dock Wallet SDK for Web
 *
 * This module provides a simplified interface for initializing and working with
 * the Dock Wallet SDK in web environments. It includes functions for managing
 * DIDs, credentials, presentations, and cloud wallet synchronization.
 *
 * @module @docknetwork/wallet-sdk-web
 */

import {createDataStore} from '@docknetwork/wallet-sdk-data-store-web/src/index';
import {
  initializeCloudWallet,
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
} from '@docknetwork/wallet-sdk-core/src/cloud-wallet';
import {createWallet} from '@docknetwork/wallet-sdk-core/src/wallet';
import {createCredentialProvider} from '@docknetwork/wallet-sdk-core/src/credential-provider';
import {createDIDProvider} from '@docknetwork/wallet-sdk-core/src/did-provider';
import {createMessageProvider} from '@docknetwork/wallet-sdk-core/src/message-provider';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';

/**
 * Initializes the Dock Wallet SDK with the provided configuration.
 *
 * This function sets up all necessary wallet providers and establishes a connection
 * to the cloud wallet for synchronization. It requires either a master key or mnemonic
 * for wallet recovery, but not both.
 *
 * @async
 * @param {Object} config - Configuration object for wallet initialization
 * @param {string} config.edvUrl - The Encrypted Data Vault (EDV) URL for cloud storage
 * @param {string} config.edvAuthKey - Authentication key for accessing the EDV
 * @param {string} [config.masterKey] - Master key for wallet access (required if mnemonic is not provided)
 * @param {string} [config.mnemonic] - BIP39 mnemonic for wallet recovery (required if masterKey is not provided)
 * @param {string} config.networkId - Network identifier ('testnet' or 'mainnet')
 * @param {string} [config.databasePath='truvera-web-wallet'] - Optional path for the local database
 *
 * @returns {Promise<Object>} Initialized wallet object with the following properties:
 * @returns {Object} returns.wallet - Core wallet instance
 * @returns {Object} returns.messageProvider - Provider for handling wallet messages
 * @returns {Object} returns.cloudWallet - Cloud wallet instance for synchronization
 * @returns {Object} returns.didProvider - Provider for DID operations
 * @returns {Object} returns.credentialProvider - Provider for credential operations
 * @returns {Function} returns.getCredentials - Function to retrieve all credentials
 * @returns {Function} returns.addCredential - Function to import a credential from an offer URI
 * @returns {Function} returns.getDID - Function to get the default DID
 * @returns {Function} returns.submitPresentation - Function to create and submit a presentation
 *
 * @throws {Error} When neither masterKey nor mnemonic is provided
 * @throws {Error} When both masterKey and mnemonic are provided
 * @throws {Error} When edvUrl is not provided
 * @throws {Error} When edvAuthKey is not provided
 * @throws {Error} When networkId is not provided
 * @throws {Error} When networkId is not 'testnet' or 'mainnet'
 * @throws {Error} When wallet initialization fails
 * @throws {Error} When cloud wallet initialization fails
 *
 * @example
 * // Initialize with mnemonic
 * const wallet = await initialize({
 *   edvUrl: 'https://edv.example.com',
 *   edvAuthKey: 'your-auth-key',
 *   mnemonic: 'your twelve word mnemonic phrase here...',
 *   networkId: 'testnet'
 * });
 *
 * @example
 * // Initialize with master key
 * const wallet = await initialize({
 *   edvUrl: 'https://edv.example.com',
 *   edvAuthKey: 'your-auth-key',
 *   masterKey: 'your-master-key',
 *   networkId: 'mainnet',
 *   databasePath: 'custom-wallet-db'
 * });
 */
async function initialize({
  edvUrl,
  edvAuthKey,
  masterKey,
  mnemonic,
  networkId,
  databasePath,
}) {
  // Validate required parameters
  if (!masterKey && !mnemonic) {
    throw new Error(
      'Initialization failed: Either masterKey or mnemonic must be provided for wallet access',
    );
  }

  if (masterKey && mnemonic) {
    throw new Error(
      'Initialization failed: Cannot provide both masterKey and mnemonic. Please use only one authentication method',
    );
  }

  if (!edvUrl) {
    throw new Error(
      'Initialization failed: edvUrl is required. Please provide a valid Encrypted Data Vault URL',
    );
  }

  if (!edvAuthKey) {
    throw new Error(
      'Initialization failed: edvAuthKey is required for EDV authentication',
    );
  }

  if (networkId !== 'testnet' && networkId !== 'mainnet') {
    throw new Error(
      'Initialization failed: networkId is required. Must be either "testnet" or "mainnet"',
    );
  }

  // Initialize data store
  let dataStore;
  try {
    dataStore = await createDataStore({
      databasePath: databasePath || 'truvera-web-wallet',
      defaultNetwork: networkId,
    });
  } catch (error) {
    throw new Error(`Failed to create data store: ${error.message}`);
  }

  // Initialize wallet
  let wallet;
  try {
    wallet = await createWallet({dataStore});
  } catch (error) {
    throw new Error(`Failed to create wallet: ${error.message}`);
  }

  // Initialize providers
  let didProvider, credentialProvider, messageProvider;
  try {
    didProvider = createDIDProvider({wallet});
    credentialProvider = await createCredentialProvider({wallet});
    messageProvider = createMessageProvider({wallet, didProvider});
  } catch (error) {
    throw new Error(`Failed to initialize wallet providers: ${error.message}`);
  }

  // Recover or set master key
  if (mnemonic) {
    try {
      masterKey = await recoverCloudWalletMasterKey(mnemonic);
    } catch (error) {
      throw new Error(
        `Failed to recover master key from mnemonic: ${error.message}`,
      );
    }
  }

  // Initialize cloud wallet
  let cloudWallet;
  try {
    cloudWallet = await initializeCloudWallet({
      dataStore: dataStore,
      edvUrl: edvUrl,
      masterKey: masterKey,
      authKey: edvAuthKey,
    });
  } catch (error) {
    throw new Error(`Failed to initialize cloud wallet: ${error.message}`);
  }

  // Pull documents from cloud (non-critical operation)
  try {
    await cloudWallet.pullDocuments();
  } catch (error) {
    console.warn(
      'Warning: Failed to pull documents from cloud wallet. You may need to sync manually.',
      error.message,
    );
  }

  return {
    wallet,
    messageProvider,
    cloudWallet,
    didProvider,
    credentialProvider,
    /**
     * Retrieves all credentials stored in the wallet.
     *
     * @async
     * @returns {Promise<Array>} Array of credential objects
     * @throws {Error} When credential retrieval fails
     *
     * @example
     * const credentials = await wallet.getCredentials();
     * console.log(`Found ${credentials.length} credentials`);
     */
    getCredentials: async () => {
      try {
        return await credentialProvider.getCredentials();
      } catch (error) {
        throw new Error(`Failed to retrieve credentials: ${error.message}`);
      }
    },

    /**
     * Imports a credential using an OpenID4VC (OID4VCI) offer URI.
     *
     * @async
     * @param {string} uri - The credential offer URI (e.g., openid-credential-offer://...)
     * @returns {Promise<Object>} The imported credential object
     * @throws {Error} When the URI is invalid or credential import fails
     *
     * @example
     * const credential = await wallet.addCredential('openid-credential-offer://...');
     * console.log('Credential imported:', credential.id);
     */
    addCredential: async uri => {
      if (!uri || typeof uri !== 'string') {
        throw new Error(
          'Invalid credential offer URI: URI must be a non-empty string',
        );
      }

      try {
        return await credentialProvider.importCredentialFromURI({
          uri,
          didProvider,
        });
      } catch (error) {
        throw new Error(
          `Failed to import credential from URI: ${error.message}`,
        );
      }
    },

    /**
     * Retrieves the default DID (Decentralized Identifier) for the wallet.
     *
     * @async
     * @returns {Promise<string>} The default DID string
     * @throws {Error} When DID retrieval fails or no DID exists
     *
     * @example
     * const did = await wallet.getDID();
     * console.log('Default DID:', did);
     */
    getDID: async () => {
      try {
        return await didProvider.getDefaultDID();
      } catch (error) {
        throw new Error(`Failed to retrieve default DID: ${error.message}`);
      }
    },
    /**
     * Creates and submits a verifiable presentation for the given credentials and proof request.
     *
     * This function processes a proof request from a verifier, selects the specified credentials,
     * creates a presentation with the requested attributes, and submits it to the verifier.
     *
     * @async
     * @param {Object} config - Configuration object for presentation submission
     * @param {Array<Object>} config.credentials - Array of credential objects to include in the presentation
     * @param {string} config.credentials[].id - The credential ID
     * @param {Object} config.credentials[].attributesToReveal - Map of attribute names to reveal
     * @param {Array<string>} config.credentials[].attributesToReveal - Array of attribute names to reveal from this credential
     * @param {string} config.proofRequestUrl - URL to the proof request template from the verifier
     *
     * @returns {Promise<Object>} The submission response from the verifier
     * @throws {Error} When credentials array is empty or invalid
     * @throws {Error} When proofRequestUrl is invalid
     * @throws {Error} When verification controller fails to start
     * @throws {Error} When presentation creation fails
     * @throws {Error} When presentation submission fails
     *
     * @example
     * // Submit a presentation with selective disclosure
     * const result = await wallet.submitPresentation({
     *   credentials: [
     *     {
     *       id: 'credential-123',
     *       attributesToReveal: ['name', 'dateOfBirth']
     *     },
     *     {
     *       id: 'credential-456',
     *       attributesToReveal: ['email']
     *     }
     *   ],
     *   proofRequestUrl: 'https://verifier.example.com/proof-request/abc123'
     * });
     */
    submitPresentation: async ({credentials, proofRequestUrl}) => {
      // Validate inputs
      if (
        !credentials ||
        !Array.isArray(credentials) ||
        credentials.length === 0
      ) {
        throw new Error(
          'Invalid credentials: Must provide a non-empty array of credentials',
        );
      }

      if (!proofRequestUrl || typeof proofRequestUrl !== 'string') {
        throw new Error('Invalid proofRequestUrl: Must be a valid URL string');
      }

      // Validate each credential
      for (const credential of credentials) {
        if (!credential.id) {
          throw new Error(
            'Invalid credential: Each credential must have an id property',
          );
        }
        if (!credential.attributesToReveal) {
          throw new Error(
            `Invalid credential ${credential.id}: Missing attributesToReveal property`,
          );
        }
      }

      let verificationController;
      try {
        verificationController = createVerificationController({
          wallet,
          credentialProvider,
          didProvider,
        });
      } catch (error) {
        throw new Error(
          `Failed to create verification controller: ${error.message}`,
        );
      }

      try {
        await verificationController.start({template: proofRequestUrl});
      } catch (error) {
        throw new Error(
          `Failed to start verification with proof request: ${error.message}`,
        );
      }

      // Select credentials and attributes to reveal
      try {
        for (const credential of credentials) {
          verificationController.selectedCredentials.set(credential.id, {
            credential: credential,
            attributesToReveal: credential.attributesToReveal,
          });
        }
      } catch (error) {
        throw new Error(`Failed to select credentials: ${error.message}`);
      }

      let presentation;
      try {
        presentation = await verificationController.createPresentation();
      } catch (error) {
        throw new Error(`Failed to create presentation: ${error.message}`);
      }

      try {
        return await verificationController.submitPresentation(presentation);
      } catch (error) {
        throw new Error(`Failed to submit presentation: ${error.message}`);
      }
    },
  };
}

/**
 * Dock Wallet SDK - Web Module
 *
 * Provides a comprehensive SDK for building decentralized identity wallets in web applications.
 * Includes high-level initialization functions and low-level building blocks for custom implementations.
 *
 * @namespace DockWalletSDK
 *
 * @property {Function} initialize - High-level function to initialize a complete wallet with all providers
 * @property {Function} createDataStore - Create a data store for wallet data persistence
 * @property {Function} createWallet - Create a core wallet instance
 * @property {Function} createCredentialProvider - Create a provider for credential management
 * @property {Function} createDIDProvider - Create a provider for DID operations
 * @property {Function} createMessageProvider - Create a provider for wallet messaging
 * @property {Function} initializeCloudWallet - Initialize cloud wallet synchronization
 * @property {Function} generateCloudWalletMasterKey - Generate a new master key for cloud wallet
 * @property {Function} recoverCloudWalletMasterKey - Recover master key from a BIP39 mnemonic
 * @property {Function} createVerificationController - Create a controller for verification presentations
 *
 * @example
 * // Quick start - use the high-level initialize function
 * import WalletSDK from '@docknetwork/wallet-sdk-web';
 *
 * const wallet = await WalletSDK.initialize({
 *   edvUrl: 'https://edv.dock.io',
 *   edvAuthKey: 'your-auth-key',
 *   mnemonic: 'your mnemonic phrase...',
 *   networkId: 'testnet'
 * });
 *
 * @example
 * // Advanced usage - build custom wallet with individual components
 * import WalletSDK from '@docknetwork/wallet-sdk-web';
 *
 * const dataStore = await WalletSDK.createDataStore({
 *   databasePath: 'my-wallet',
 *   defaultNetwork: 'mainnet'
 * });
 *
 * const wallet = await WalletSDK.createWallet({ dataStore });
 * const didProvider = WalletSDK.createDIDProvider({ wallet });
 * // ... configure additional providers as needed
 */
export default {
  initialize,
  createDataStore,
  createWallet,
  createCredentialProvider,
  createDIDProvider,
  createMessageProvider,
  initializeCloudWallet,
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
  createVerificationController,
};
