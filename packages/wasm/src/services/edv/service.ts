// @ts-nocheck

/**
 * @module edv-service
 * @description Encrypted Data Vault (EDV) service for the Wallet SDK.
 * This module provides secure, encrypted storage functionality using EDV protocol,
 * enabling privacy-preserving data storage with client-side encryption.
 */

import {InitializeEDVParams, serviceName} from './configs';
import EDVHTTPStorageInterface from '@docknetwork/universal-wallet/storage/edv-http-storage';
import HMAC from './hmac';
import {Ed25519VerificationKey2018} from '@digitalbazaar/ed25519-verification-key-2018';
import {Ed25519VerificationKey2020} from '@digitalbazaar/ed25519-verification-key-2020';
import {X25519KeyAgreementKey2020} from '@digitalbazaar/x25519-key-agreement-key-2020';
import {getKeypairFromDoc} from '@docknetwork/universal-wallet/methods/keypairs';
import {logger} from '@docknetwork/wallet-sdk-data-store/src/logger';
import {didService} from '@docknetwork/wallet-sdk-wasm/src/services/dids/service';
import {Ed25519Keypair} from '@docknetwork/credential-sdk/keypairs';
import hkdf from 'futoin-hkdf';
import crypto from '@docknetwork/universal-wallet/crypto';
import {utilCryptoService} from '@docknetwork/wallet-sdk-wasm/src/services/util-crypto/service';

export const HKDF_LENGTH = 32;
export const HKDF_HASH = 'SHA-256';

/**
 * Service class for managing Encrypted Data Vaults
 * @class
 * @description Provides methods for creating, managing, and interacting with
 * encrypted data vaults for secure storage of sensitive wallet data
 */
export class EDVService {
  storageInterface: EDVHTTPStorageInterface;

  private insertQueue: Promise<any> = Promise.resolve();
  public controller: string;

  rpcMethods = [
    EDVService.prototype.generateKeys,
    EDVService.prototype.deriveKeys,
    EDVService.prototype.getController,
    EDVService.prototype.initialize,
    EDVService.prototype.initializeFromMnemonic,
    EDVService.prototype.initializeFromMasterKey,
    EDVService.prototype.find,
    EDVService.prototype.update,
    EDVService.prototype.insert,
    EDVService.prototype.delete,
    EDVService.prototype.deriveBiometricKey,
    EDVService.prototype.deriveBiometricEncryptionKey,
    EDVService.prototype.encryptMasterKey,
    EDVService.prototype.decryptMasterKey,
  ];

  /**
   * Creates a new EDVService instance
   * @constructor
   */
  constructor() {
    this.name = serviceName;
  }

  /**
   * Initializes the EDV service with encryption keys and connection parameters
   * @param {InitializeEDVParams} params - Initialization parameters
   * @param {Object} params.hmacKey - HMAC key for document indexing
   * @param {Object} params.agreementKey - Key agreement key for encryption
   * @param {Object} params.verificationKey - Verification key for authentication
   * @param {string} params.edvUrl - URL of the EDV server
   * @param {string} params.authKey - Authentication key for the EDV server
   * @returns {Promise<void>}
   * @throws {Error} If unable to create or connect to EDV
   * @example
   * await edvService.initialize({
   *   hmacKey: hmacKeyData,
   *   agreementKey: agreementKeyData,
   *   verificationKey: verificationKeyData,
   *   edvUrl: 'https://edv.example.com',
   *   authKey: 'auth-token-123'
   * });
   */
  async initialize({
    hmacKey,
    agreementKey,
    verificationKey,
    edvUrl,
    authKey,
  }: InitializeEDVParams) {
    const hmac = await HMAC.create({
      key: hmacKey,
    });
    const keyAgreementKey = await X25519KeyAgreementKey2020.from(agreementKey);
    const keys = {
      keyAgreementKey,
      hmac,
    };

    const {controller} = verificationKey;
    this.controller = controller;
    const invocationSigner = getKeypairFromDoc(verificationKey);
    invocationSigner.sign = invocationSigner.signer().sign;

    this.storageInterface = new EDVHTTPStorageInterface({
      url: edvUrl,
      keys,
      invocationSigner,
      defaultHeaders: {
        DockAuth: authKey,
      },
    });

    let edvId;
    try {
      console.log('Creating EDV with controller:', controller);
      edvId = await this.storageInterface.createEdv({
        sequence: 0,
        controller,
      });
    } catch (e) {
      const existingConfig = await this.storageInterface.findConfigFor(
        controller,
      );
      edvId = existingConfig && existingConfig.id;
      if (!edvId) {
        logger.error('Unable to create or find primary EDV:');
        throw e;
      }
    }

    logger.log(`EDV found/created: ${edvId} - connecting to it`);
    this.storageInterface.connectTo(edvId);

    await this.storageInterface.client.ensureIndex({
      attribute: 'content.id',
      unique: true,
    });

    await this.storageInterface.client.ensureIndex({
      attribute: 'content.type',
    });
  }

  async initializeFromMnemonic({
    mnemonic,
    edvUrl,
    authKey,
  }: {
    mnemonic: string;
    edvUrl: string;
    authKey: string;
  }) {
    const masterKey = await utilCryptoService.mnemonicToMiniSecret(mnemonic);
    return this.initializeFromMasterKey({ masterKey, edvUrl, authKey });
  }

  async initializeFromMasterKey({
    masterKey,
    edvUrl,
    authKey,
  }: {
    masterKey: Uint8Array;
    edvUrl: string;
    authKey: string;
  }) {
    if (!(masterKey instanceof Uint8Array)) {
      masterKey = new Uint8Array(Object.values(masterKey));
    }

    const { verificationKey, agreementKey, hmacKey } = await this.deriveKeys(masterKey);

    return this.initialize({
      hmacKey,
      agreementKey,
      verificationKey,
      edvUrl,
      authKey,
    });
  }

  /**
   * Generates new cryptographic keys for EDV operations
   * @returns {Promise<Object>} Generated keys
   * @returns {Object} returns.verificationKey - Ed25519 verification key for authentication
   * @returns {Object} returns.agreementKey - X25519 key agreement key for encryption
   * @returns {Object} returns.hmacKey - HMAC key for indexing
   * @example
   * const keys = await edvService.generateKeys();
   * // Use keys for EDV initialization
   * await edvService.initialize({
   *   ...keys,
   *   edvUrl: 'https://edv.example.com',
   *   authKey: 'auth-token'
   * });
   */
  async generateKeys() {
    const keyPair = await didService.generateKeyDoc({});

    const verificationKey = await Ed25519VerificationKey2018.generate({
      controller: keyPair.controller,
      id: keyPair.id,
    });

    const agreementKey = await X25519KeyAgreementKey2020.generate({
      controller: keyPair.controller,
    });
    const hmacKey = await HMAC.exportKey(await HMAC.generateKey());

    return {verificationKey, agreementKey, hmacKey};
  }

  /**
   * Derives cryptographic keys from a master key
   * @param {Uint8Array} masterKey - Master key for derivation
   * @returns {Promise<Object>} Derived keys
   * @returns {Object} returns.verificationKey - Derived Ed25519 verification key
   * @returns {Object} returns.agreementKey - Derived X25519 key agreement key
   * @returns {Object} returns.hmacKey - Derived HMAC key
   * @example
   * const masterKey = new Uint8Array(32); // Your master key
   * const keys = await edvService.deriveKeys(masterKey);
   */
  async deriveKeys(masterKey: Uint8Array) {
    // Ensure masterKey is a proper Uint8Array (JSON-RPC serialization converts it to a plain object)
    if (!(masterKey instanceof Uint8Array)) {
      masterKey = new Uint8Array(Object.values(masterKey));
    }
    const {keyPair: pair} = new Ed25519Keypair(masterKey, 'seed');

    const keyPair = await didService.deriveKeyDoc({ pair });

    const verificationKey = await Ed25519VerificationKey2018.from(keyPair);

    const verificationKey2020 = await Ed25519VerificationKey2020.fromEd25519VerificationKey2018({ keyPair });
    const agreementKey = await X25519KeyAgreementKey2020.fromEd25519VerificationKey2020({ keyPair: verificationKey2020 });

    const hmacKey = await HMAC.exportKey(await HMAC.deriveKey(masterKey));

    return { verificationKey, agreementKey, hmacKey };
  }

  /**
   * Gets the controller identifier for the current EDV
   * @returns {Promise<string>} The controller DID or identifier
   * @example
   * const controller = await edvService.getController();
   * console.log('EDV Controller:', controller);
   */
  async getController() {
    return this.controller;
  }

  /**
   * Finds documents in the EDV based on query parameters.
   *
   * If the vault has not been indexed yet (e.g. a freshly created cloud wallet
   * with no documents), the EDV server responds with a "Vault indices do not
   * exist" error. This method catches that specific error and returns an empty
   * result set instead of throwing, so callers can treat an uninitialised vault
   * the same as an empty one. All other errors are re-thrown.
   *
   * @param {Object} params - Query parameters forwarded to the EDV storage interface
   * @param {Object} [params.equals] - Equality-based query conditions (e.g. `{ 'content.type': 'VerifiableCredential' }`)
   * @param {boolean} [params.has] - Existence-based query conditions
   * @param {number} [params.limit] - Maximum number of results to return
   * @returns {Promise<{ documents: Array }>} Object containing an array of matching documents
   * @throws {Error} If the EDV query fails for reasons other than missing vault indices
   * @example
   * // Query all documents
   * const result = await edvService.find({});
   * console.log(result.documents);
   *
   * @example
   * // Query with filters
   * const result = await edvService.find({
   *   equals: { 'content.type': 'VerifiableCredential' },
   *   limit: 10
   * });
   */
  async find(params: any) {
    try {
      return await this.storageInterface.find(params);
    } catch (error) {
      if (error.message.includes('Vault indices do not exist')) {
        return {
          documents: [],
        };
      }

      throw error;
    }
  }

  /**
   * Updates a document in the EDV
   * @param {Object} params - Update parameters
   * @param {string} params.id - Document ID to update
   * @param {Object} params.content - New document content
   * @returns {Promise<Object>} Updated document
   * @example
   * const updated = await edvService.update({
   *   id: 'doc-123',
   *   content: { ...existingContent, updated: true }
   * });
   */
  update(params: any) {
    return this.storageInterface.update(params);
  }

  /**
   * Inserts a new document into the EDV
   * @param {Object} params - Insert parameters
   * @param {string} params.id - Document ID
   * @param {Object} params.content - Document content to store
   * @returns {Promise<Object>} The inserted document
   * @throws {Error} If insertion fails
   * @example
   * const document = await edvService.insert({
   *   id: 'doc-456',
   *   content: {
   *     type: 'VerifiableCredential',
   *     data: credentialData
   *   }
   * });
   */
  insert(params: any) {
    this.insertQueue = this.insertQueue.then(() => {
      return this.storageInterface.insert(params).catch(error => {
        logger.error('Insert failed:', error);
        throw error;
      });
    });
    return this.insertQueue;
  }

  /**
   * Deletes a document from the EDV
   * @param {Object} params - Deletion parameters
   * @param {string} params.id - Document ID to delete
   * @returns {Promise<boolean>} True if deletion successful
   * @example
   * const deleted = await edvService.delete({
   *   id: 'doc-123'
   * });
   */
  delete(params: any) {
    return this.storageInterface.delete(params);
  }

  /**
   * Derives a key from biometric data using HKDF
   * @param {Buffer} biometricData - Biometric data from provider
   * @param {string} identifier - User's identifier as salt (email, phone number, etc.)
   * @returns {Buffer} Derived key
   * @example
   * const key = edvService.deriveBiometricKey(biometricData, 'user@example.com');
   */
  deriveBiometricKey(biometricData: Buffer, identifier: string): Buffer {
    const salt = identifier;
    return hkdf(biometricData, HKDF_LENGTH, { salt, hash: HKDF_HASH });
  }

  /**
   * Generates a key for encrypting/decrypting the master key
   * @param {Buffer} biometricData - Biometric data from provider
   * @param {string} identifier - User's identifier as salt (email, phone number, etc.)
   * @returns {Promise<Object>} Encryption key and IV for AES encryption
   * @returns {Buffer} returns.key - Encryption key
   * @returns {Buffer} returns.iv - Initialization vector
   * @example
   * const { key, iv } = await edvService.deriveBiometricEncryptionKey(biometricData, 'user@example.com');
   */
  async deriveBiometricEncryptionKey(
    biometricData: Buffer,
    identifier: string
  ): Promise<{ key: Buffer; iv: Buffer }> {
    const key = this.deriveBiometricKey(biometricData, identifier);
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const iv = Buffer.from(randomBytes);

    return {
      key,
      iv
    };
  }

  /**
   * Encrypts the master key using a key derived from biometric data
   * @param {Uint8Array} masterKey - The CloudWalletVault master key to encrypt
   * @param {Buffer} encryptionKey - Key derived from biometric data
   * @param {Buffer} iv - Initialization vector
   * @returns {Promise<Uint8Array>} Encrypted master key
   * @example
   * const encrypted = await edvService.encryptMasterKey(masterKey, encryptionKey, iv);
   */
  async encryptMasterKey(
    masterKey: Uint8Array,
    encryptionKey: Buffer,
    iv: Buffer
  ): Promise<Uint8Array> {
    // Ensure typed arrays survive JSON-RPC serialization
    if (!(masterKey instanceof Uint8Array)) {
      masterKey = new Uint8Array(Object.values(masterKey));
    }
    const keyData = new Uint8Array(Object.values(encryptionKey));
    const ivData = new Uint8Array(Object.values(iv));

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivData },
      key,
      masterKey
    );

    return new Uint8Array(encryptedBuffer);
  }

  /**
   * Decrypts the master key using biometric-derived key
   * @param {Uint8Array} encryptedKey - The encrypted master key
   * @param {Buffer} decryptionKey - Key derived from biometric data
   * @param {Buffer} iv - Initialization vector
   * @returns {Promise<Uint8Array>} The decrypted master key
   * @throws {Error} If decryption fails
   * @example
   * const masterKey = await edvService.decryptMasterKey(encryptedKey, decryptionKey, iv);
   */
  async decryptMasterKey(
    encryptedKey: Uint8Array | Record<string, number>,
    decryptionKey: Buffer | Uint8Array | Record<string, number>,
    iv: Buffer | Uint8Array | Record<string, number>,
  ): Promise<Uint8Array> {
    try {
      // Ensure typed arrays survive JSON-RPC serialization
      if (!(encryptedKey instanceof Uint8Array)) {
        encryptedKey = new Uint8Array(Object.values(encryptedKey));
      }
      if (!(decryptionKey instanceof Uint8Array)) {
        decryptionKey = new Uint8Array(Object.values(decryptionKey));
      }
      if (!(iv instanceof Uint8Array)) {
        iv = new Uint8Array(Object.values(iv));
      }
      const keyData = new Uint8Array(decryptionKey);
      const ivData = new Uint8Array(iv);

      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivData },
        key,
        encryptedKey
      );

      return new Uint8Array(decryptedBuffer);
    } catch (error) {
      throw new Error('Decryption failed: Invalid key or corrupted data');
    }
  }
}

/**
 * Singleton instance of the EDV service
 * @type {EDVService}
 * @example
 * import { edvService } from '@docknetwork/wallet-sdk-wasm/services/edv';
 *
 * // Generate keys and initialize
 * const keys = await edvService.generateKeys();
 * await edvService.initialize({
 *   ...keys,
 *   edvUrl: 'https://edv.example.com',
 *   authKey: 'auth-token'
 * });
 *
 * // Store encrypted data
 * await edvService.insert({
 *   id: 'credential-1',
 *   content: {
 *     type: 'VerifiableCredential',
 *     data: credentialData
 *   }
 * });
 *
 * // Query encrypted data
 * const credentials = await edvService.find({
 *   equals: { 'content.type': 'VerifiableCredential' }
 * });
 *
 * // Update encrypted data
 * await edvService.update({
 *   id: 'credential-1',
 *   content: updatedData
 * });
 */
export const edvService: EDVService = new EDVService();
