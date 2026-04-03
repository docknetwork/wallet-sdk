/**
 * @fileoverview Truvera Wallet SDK for Web
 *
 * This module provides a simplified interface for initializing and working with
 * the Truvera Wallet SDK in web environments. It includes functions for managing
 * DIDs, credentials, presentations, and cloud wallet synchronization.
 *
 * Supports three authentication methods:
 * - **Mnemonic**: BIP39 recovery phrase (12 words)
 * - **Master key**: Pre-derived 32-byte Uint8Array
 * - **Passkey**: WebAuthn passkey with PRF extension — zero-config with `passkey: true`,
 *   or customizable with passkey options (identifier, storageKey, rpName, etc.)
 *
 * @module @docknetwork/wallet-sdk-web
 */

import {createDataStore} from '@docknetwork/wallet-sdk-data-store-web/src/index';
import {
  initializeCloudWallet,
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
  enrollUserWithPasskey,
  authenticateWithPasskey,
  initializeCloudWalletWithPasskey,
} from '@docknetwork/wallet-sdk-core/src/cloud-wallet';
import {createWallet} from '@docknetwork/wallet-sdk-core/src/wallet';
import {createCredentialProvider} from '@docknetwork/wallet-sdk-core/src/credential-provider';
import {createDIDProvider} from '@docknetwork/wallet-sdk-core/src/did-provider';
import {createMessageProvider} from '@docknetwork/wallet-sdk-core/src/message-provider';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';
import {blockchainService} from '@docknetwork/wallet-sdk-wasm/src/services/blockchain';
import {
  checkPasskeySupport,
  registerPasskey,
  getPasskeyPRFKey,
  credentialIdToBase64url,
  base64urlToCredentialId,
} from './passkey';

/**
 * Initializes the Truvera Wallet SDK with the provided configuration.
 *
 * Sets up all wallet providers and establishes a connection to the cloud wallet
 * for synchronization. Supports three authentication methods — provide exactly one:
 *
 * - **Mnemonic**: `mnemonic` — a BIP39 recovery phrase
 * - **Master key**: `masterKey` — a pre-derived Uint8Array key
 * - **Passkey**: `passkey` — WebAuthn passkey with PRF extension (Chrome 116+, Safari 18+)
 *
 * When using passkeys, the SDK handles enrollment and authentication automatically.
 * On first use it registers a passkey, generates a master key, and returns a recovery
 * mnemonic. On subsequent visits it authenticates with the stored passkey silently.
 *
 * @async
 * @param {Object} config - Configuration object for wallet initialization
 * @param {string} config.edvUrl - The Encrypted Data Vault (EDV) URL for cloud storage
 * @param {string} config.edvAuthKey - Authentication key for accessing the EDV
 * @param {string} config.networkId - Network identifier ('testnet' or 'mainnet')
 * @param {string} [config.databasePath='truvera-web-wallet'] - Optional path for the local database
 * @param {Uint8Array} [config.masterKey] - Pre-derived master key for wallet access
 * @param {string} [config.mnemonic] - BIP39 mnemonic for wallet recovery
 * @param {boolean|Object} [config.passkey] - Passkey authentication configuration.
 *   Pass `true` for zero-config (auto-enroll/authenticate using defaults), or an object:
 * @param {string} [config.passkey.identifier] - User identifier for key derivation salt (defaults to hostname)
 * @param {string} [config.passkey.credentialId] - Base64url-encoded credential ID for direct auth (skips localStorage)
 * @param {string} [config.passkey.storageKey='truvera-wallet-passkey'] - Custom localStorage key for enrollment data
 * @param {string} [config.passkey.rpName='Truvera Wallet'] - WebAuthn relying party display name
 * @param {string} [config.passkey.rpId] - WebAuthn relying party ID (defaults to hostname)
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
 * @returns {Function} returns.createPresentation - Function to create a presentation with optional auto-selection
 * @returns {string} [returns.mnemonic] - Recovery mnemonic phrase (only present on first passkey enrollment)
 *
 * @throws {Error} When no authentication method is provided
 * @throws {Error} When multiple authentication methods are combined
 * @throws {Error} When edvUrl or edvAuthKey is missing
 * @throws {Error} When networkId is not 'testnet' or 'mainnet'
 * @throws {Error} When passkey PRF extension is not supported by the browser
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
 * // Initialize with passkey — zero config, auto enroll/authenticate
 * const wallet = await initialize({
 *   edvUrl: 'https://edv.example.com',
 *   edvAuthKey: 'your-auth-key',
 *   networkId: 'testnet',
 *   passkey: true,
 * });
 * if (wallet.mnemonic) {
 *   console.log('Save your recovery phrase:', wallet.mnemonic);
 * }
 *
 * @example
 * // Initialize with passkey — custom options
 * const wallet = await initialize({
 *   edvUrl: 'https://edv.example.com',
 *   edvAuthKey: 'your-auth-key',
 *   networkId: 'testnet',
 *   passkey: {
 *     identifier: 'user@example.com',
 *     storageKey: 'my-app-passkey',
 *     rpName: 'My App',
 *   },
 * });
 *
 * @example
 * // Initialize with passkey — direct auth, no localStorage
 * const wallet = await initialize({
 *   edvUrl: 'https://edv.example.com',
 *   edvAuthKey: 'your-auth-key',
 *   networkId: 'testnet',
 *   passkey: {
 *     credentialId: 'base64url-encoded-credential-id',
 *     identifier: 'user@example.com',
 *   },
 * });
 */
const DEFAULT_PASSKEY_STORAGE_KEY = 'truvera-wallet-passkey';

/**
 * Resolves passkey options from the various input forms.
 * @param {boolean|Object} passkey - true or options object
 * @returns {Object} Resolved options with defaults applied
 */
function resolvePasskeyOptions(passkey) {
  const opts = typeof passkey === 'object' ? passkey : {};
  return {
    identifier: opts.identifier || window.location.hostname,
    rpId: opts.rpId || window.location.hostname,
    rpName: opts.rpName || 'Truvera Wallet',
    storageKey: opts.storageKey || DEFAULT_PASSKEY_STORAGE_KEY,
    credentialId: opts.credentialId || null,
  };
}

/**
 * Checks if a passkey has been enrolled on this device.
 *
 * @param {string} [storageKey] - Custom localStorage key (defaults to 'truvera-wallet-passkey')
 * @returns {boolean} True if a passkey is enrolled
 */
function isPasskeyEnrolled(storageKey) {
  try {
    return localStorage.getItem(storageKey || DEFAULT_PASSKEY_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Enrolls a new passkey and creates a passkey-protected wallet.
 * Handles the full WebAuthn flow: registration, PRF extraction, and master key enrollment.
 * Stores enrollment metadata in localStorage for future authentication.
 *
 * @async
 * @param {Object} config - Configuration object
 * @param {string} config.edvUrl - The Encrypted Data Vault (EDV) URL
 * @param {string} config.edvAuthKey - Authentication key for accessing the EDV
 * @param {string} [config.identifier] - User's identifier (defaults to current hostname)
 * @param {string} [config.rpName='Truvera Wallet'] - Relying party display name
 * @param {string} [config.rpId] - Relying party ID (defaults to current hostname)
 * @param {string} [config.storageKey='truvera-wallet-passkey'] - Custom localStorage key
 * @returns {Promise<{mnemonic: string, credentialId: string}>} Recovery mnemonic and base64url-encoded credential ID
 * @throws {Error} If WebAuthn or PRF is not supported
 */
async function enrollPasskey({edvUrl, edvAuthKey, identifier, rpName, rpId, storageKey}) {
  const resolved = resolvePasskeyOptions({identifier, rpName, rpId, storageKey});

  const support = await checkPasskeySupport();
  if (!support.webauthn) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const {credentialId, prfSupported} = await registerPasskey(resolved.identifier, resolved.rpName, resolved.rpId);

  if (!prfSupported) {
    throw new Error(
      'PRF extension not supported by this authenticator. Requires Chrome 116+ or Safari 18+.'
    );
  }

  const {prfOutput} = await getPasskeyPRFKey(resolved.identifier, {credentialId, rpId: resolved.rpId});

  const {mnemonic} = await enrollUserWithPasskey(edvUrl, edvAuthKey, prfOutput, resolved.identifier);

  const credentialIdBase64url = credentialIdToBase64url(credentialId);

  localStorage.setItem(resolved.storageKey, JSON.stringify({
    credentialId: credentialIdBase64url,
    identifier: resolved.identifier,
  }));

  return {mnemonic, credentialId: credentialIdBase64url};
}

async function initialize({
  edvUrl,
  edvAuthKey,
  masterKey,
  mnemonic,
  networkId,
  databasePath,
  passkey,
}) {
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

  let passkeyMnemonic;

  if (passkey) {
    if (masterKey || mnemonic) {
      throw new Error(
        'Initialization failed: Cannot combine passkey with masterKey or mnemonic',
      );
    }

    const resolved = resolvePasskeyOptions(passkey);
    let {credentialId} = resolved;
    const {identifier, rpId, storageKey} = resolved;

    // No explicit credentialId — check localStorage for stored enrollment
    if (!credentialId) {
      if (!isPasskeyEnrolled(storageKey)) {
        // First time: enroll automatically
        const result = await enrollPasskey({
          edvUrl,
          edvAuthKey,
          identifier,
          rpName: resolved.rpName,
          rpId,
          storageKey,
        });
        passkeyMnemonic = result.mnemonic;
      }

      const stored = JSON.parse(localStorage.getItem(storageKey));
      credentialId = stored.credentialId;
    }

    const prfOptions = credentialId
      ? {credentialId: base64urlToCredentialId(credentialId), rpId}
      : {rpId};

    const {prfOutput} = await getPasskeyPRFKey(identifier, prfOptions);
    masterKey = await authenticateWithPasskey(edvUrl, edvAuthKey, prfOutput, identifier);
  } else if (!masterKey && !mnemonic) {
    throw new Error(
      'Initialization failed: Provide one of masterKey, mnemonic, or passkey for wallet access',
    );
  }

  if (masterKey && mnemonic) {
    throw new Error(
      'Initialization failed: Cannot provide both masterKey and mnemonic. Please use only one authentication method',
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

  // Initialize cloud wallet and pull documents before creating the wallet
  // This ensures existing DIDs are loaded from the cloud before wallet creation,
  // preventing duplicate DID creation
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

  // Initialize wallet after cloud sync so existing DIDs are found in the data store
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

  const result = {
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
     * Removes a credential from the wallet.
     *
     * @async
     * @param {string} credentialId - The ID of the credential to remove
     * @returns {Promise<void>}
     */
    removeCredential: async credentialId => {
      if (!credentialId || typeof credentialId !== 'string') {
        throw new Error('Invalid credentialId: Must be a non-empty string');
      }
      return await credentialProvider.removeCredential(credentialId);
    },

    /**
     * Creates a verifiable presentation for a given proof request.
     *
     * When called without credentials, automatically filters wallet credentials
     * against the proof request template, selects the best matches, and generates
     * a presentation with the required attributes revealed (default presentation).
     *
     * When called with credentials, uses the specified credentials and attributes
     * to generate the presentation (selective disclosure).
     *
     * @async
     * @param {Object} config - Configuration object
     * @param {string|Object} config.proofRequest - Proof request URL string or proof request object
     * @param {Array<Object>} [config.credentials] - Optional array of credentials to include.
     *   When omitted, a default presentation is created by auto-selecting credentials.
     * @param {string} config.credentials[].id - The credential ID
     * @param {Array<string>} config.credentials[].attributesToReveal - Array of attribute names to reveal from this credential
     *
     * @returns {Promise<Object>} Result object containing:
     * @returns {Object} returns.presentation - The generated verifiable presentation
     * @returns {Object} returns.verificationController - The verification controller instance
     * @returns {Function} returns.submit - Convenience function to submit the presentation to the Certs API
     *
     * @throws {Error} When proofRequest is not provided
     * @throws {Error} When no matching credentials are found in the wallet
     * @throws {Error} When presentation creation fails
     *
     * @example
     * // Default presentation with URL (auto-selects credentials)
     * const result = await wallet.createPresentation({
     *   proofRequest: 'https://creds-staging.truvera.io/proof/77ae2c67-678e-4cb6-8c5d-a4dd4a1a19f1'
     * });
     *
     * console.log(result.presentation);
     * const response = await result.submit();
     *
     * @example
     * // Default presentation with proof request object
     * const result = await wallet.createPresentation({
     *   proofRequest: proofRequestObject,
     * });
     *
     * @example
     * // Selective disclosure (specify credentials and attributes)
     * const result = await wallet.createPresentation({
     *   proofRequest: 'https://creds-staging.truvera.io/proof/77ae2c67-678e-4cb6-8c5d-a4dd4a1a19f1',
     *   credentials: [
     *     {
     *       id: 'https://creds-testnet.truvera.io/credential-id',
     *       attributesToReveal: ['credentialSubject.fullName', 'credentialSubject.age']
     *     },
     *   ],
     * });
     *
     * const response = await result.submit();
     */
    createPresentation: async ({credentials, proofRequest}) => {
      await blockchainService.ensureBlockchainReady();

      if (!proofRequest) {
        throw new Error(
          'Invalid input: proofRequest is required (URL string or proof request object)',
        );
      }

      const verificationController = createVerificationController({
        wallet,
        credentialProvider,
        didProvider,
      });

      await verificationController.start({template: proofRequest});

      let presentation;

      if (!credentials) {
        presentation = await verificationController.createDefaultPresentation();
      } else {
        if (!Array.isArray(credentials) || credentials.length === 0) {
          throw new Error(
            'Invalid credentials: Must provide a non-empty array of credentials',
          );
        }

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

        for (const credentialToPresent of credentials) {
          const cred = await credentialProvider.getById(credentialToPresent.id);
          verificationController.selectedCredentials.set(
            credentialToPresent.id,
            {
              credential: cred,
              attributesToReveal: credentialToPresent.attributesToReveal,
            },
          );
        }

        presentation = await verificationController.createPresentation();
      }

      return {
        presentation,
        verificationController,
        submit: async () => {
          return await verificationController.submitPresentation(presentation);
        },
      };
    },
  };

  if (passkeyMnemonic) {
    result.mnemonic = passkeyMnemonic;
  }

  return result;
}

/**
 * Truvera Wallet SDK - Web Module
 *
 * Provides a comprehensive SDK for building decentralized identity wallets in web applications.
 * Supports three authentication methods: mnemonic phrases, master keys, and WebAuthn passkeys.
 *
 * @namespace TruveraWebWallet
 *
 * @property {Function} initialize - Initialize a wallet with mnemonic, masterKey, or passkey authentication
 *
 * @property {Function} enrollPasskey - Explicitly enroll a new passkey (register + PRF + vault storage)
 * @property {Function} isPasskeyEnrolled - Check if a passkey is enrolled in localStorage
 *
 * @property {Function} checkPasskeySupport - Check browser WebAuthn/PRF support
 * @property {Function} registerPasskey - Register a new WebAuthn credential
 * @property {Function} getPasskeyPRFKey - Extract PRF key material from a passkey assertion
 * @property {Function} credentialIdToBase64url - Encode a credential ID for storage
 * @property {Function} base64urlToCredentialId - Decode a stored credential ID
 * @property {Function} enrollUserWithPasskey - Low-level: encrypt and store masterKey with passkey-derived key
 * @property {Function} authenticateWithPasskey - Low-level: decrypt masterKey from vault with passkey-derived key
 * @property {Function} initializeCloudWalletWithPasskey - Low-level: full wallet init from passkey auth
 *
 * @property {Function} createDataStore - Create a data store for wallet data persistence
 * @property {Function} createWallet - Create a core wallet instance
 * @property {Function} createCredentialProvider - Create a provider for credential management
 * @property {Function} createDIDProvider - Create a provider for DID operations
 * @property {Function} createMessageProvider - Create a provider for wallet messaging
 * @property {Function} initializeCloudWallet - Initialize cloud wallet synchronization
 * @property {Function} generateCloudWalletMasterKey - Generate a new master key with BIP39 mnemonic
 * @property {Function} recoverCloudWalletMasterKey - Recover master key from a BIP39 mnemonic
 * @property {Function} createVerificationController - Create a controller for verification presentations
 *
 * @example
 * // Passkey wallet — zero config, auto enroll/authenticate
 * import WalletSDK from '@docknetwork/wallet-sdk-web';
 *
 * const wallet = await WalletSDK.initialize({
 *   edvUrl: 'https://edv.dock.io',
 *   edvAuthKey: 'your-auth-key',
 *   networkId: 'testnet',
 *   passkey: true,
 * });
 * if (wallet.mnemonic) {
 *   console.log('Save your recovery phrase:', wallet.mnemonic);
 * }
 *
 * @example
 * // Mnemonic wallet
 * import WalletSDK from '@docknetwork/wallet-sdk-web';
 *
 * const wallet = await WalletSDK.initialize({
 *   edvUrl: 'https://edv.dock.io',
 *   edvAuthKey: 'your-auth-key',
 *   mnemonic: 'your mnemonic phrase...',
 *   networkId: 'testnet',
 * });
 *
 * @example
 * // Advanced: build custom wallet with individual components
 * import WalletSDK from '@docknetwork/wallet-sdk-web';
 *
 * const dataStore = await WalletSDK.createDataStore({
 *   databasePath: 'my-wallet',
 *   defaultNetwork: 'mainnet',
 * });
 * const wallet = await WalletSDK.createWallet({ dataStore });
 * const didProvider = WalletSDK.createDIDProvider({ wallet });
 */
export {
  initialize,

  enrollPasskey,
  isPasskeyEnrolled,
  createDataStore,
  createWallet,
  createCredentialProvider,
  createDIDProvider,
  createMessageProvider,
  initializeCloudWallet,
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
  createVerificationController,
  checkPasskeySupport,
  registerPasskey,
  getPasskeyPRFKey,
  credentialIdToBase64url,
  base64urlToCredentialId,
  enrollUserWithPasskey,
  authenticateWithPasskey,
  initializeCloudWalletWithPasskey,
};

export default {
  initialize,

  enrollPasskey,
  isPasskeyEnrolled,
  createDataStore,
  createWallet,
  createCredentialProvider,
  createDIDProvider,
  createMessageProvider,
  initializeCloudWallet,
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
  createVerificationController,
  checkPasskeySupport,
  registerPasskey,
  getPasskeyPRFKey,
  credentialIdToBase64url,
  base64urlToCredentialId,
  enrollUserWithPasskey,
  authenticateWithPasskey,
  initializeCloudWalletWithPasskey,
};
