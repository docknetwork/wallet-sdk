// @ts-nocheck

/**
 * @module blockchain-service
 * @description Blockchain connectivity and DID resolution service for the Wallet SDK.
 * This module provides functionality for connecting to Cheqd blockchain, resolving DIDs,
 * and managing accumulator-related operations.
 */

import {DirectSecp256k1HdWallet} from '@cosmjs/proto-signing';
import {CheqdAPI} from '@docknetwork/cheqd-blockchain-api';
import {CheqdCoreModules} from '@docknetwork/cheqd-blockchain-modules';
import {MultiApiCoreModules} from '@docknetwork/credential-sdk/modules';
import {
  CoreResolver,
  DIDKeyResolver,
  ResolverRouter,
  UniversalResolver,
  WILDCARD,
} from '@docknetwork/credential-sdk/resolver';
import {initializeWasm} from '@docknetwork/crypto-wasm-ts/lib/index';
import {EventEmitter} from 'events';
import {Logger} from '../../core/logger';
import {once} from '../../modules/event-manager';
import {utilCryptoService} from '../util-crypto';
import {InitParams} from './configs';

/**
 * Universal resolver URL for DID resolution fallback
 * @constant {string}
 */
export const universalResolverUrl = 'https://uniresolver.truvera.io';

import {
  AccumulatorCommon,
  AccumulatorId,
  AccumulatorPublicKey,
} from '@docknetwork/credential-sdk/types';
import { CachedDIDResolver } from './cached-did-resolver';

/**
 * Resolver that accepts any DID method using wildcard matching
 * @class
 * @extends ResolverRouter
 * @private
 */
class AnyDIDResolver extends ResolverRouter {
  method = WILDCARD;
}

/**
 * Main blockchain service class for managing blockchain connections and DID resolution
 * @class
 * @description Provides methods for connecting to Cheqd blockchain, resolving DIDs,
 * and managing blockchain-related operations
 */
export class BlockchainService {
  dock;
  modules;
  cheqdApi;
  cheqdApiUrl;
  isBlockchainReady = false;
  private _resolver: any;

  get resolver(): any {
    return this._resolver;
  }
  /**
   * Event names emitted by the blockchain service
   * @static
   * @readonly
   * @property {string} BLOCKCHAIN_READY - Emitted when blockchain connection is established
   */
  static Events = {
    BLOCKCHAIN_READY: 'blockchain-ready',
  };

  rpcMethods = [
    BlockchainService.prototype.disconnect,
    BlockchainService.prototype.ensureBlockchainReady,
    BlockchainService.prototype.init,
    BlockchainService.prototype.isApiConnected,
    BlockchainService.prototype.getAddress,
    BlockchainService.prototype.resolveDID,
    BlockchainService.prototype.getCachedDIDs,
    BlockchainService.prototype.clearCache,
    BlockchainService.prototype.getCacheEntry,
  ];

  /**
   * Creates a new BlockchainService instance
   * @constructor
   */
  constructor() {
    this.name = 'blockchain';
    this.cheqdApi = new CheqdAPI();
    this.cheqdModules = new CheqdCoreModules(this.cheqdApi);
    this.modules = new MultiApiCoreModules([this.cheqdModules]);
    this.emitter = new EventEmitter();
    // Blockchain is not ready yet, but we can use fallback resolvers
    this._resolver = this.createDIDResolver();
  }

  /**
   * Gets the types and modules needed for DID or accumulator operations
   * @param {string} didOrRegistryId - DID or registry identifier
   * @returns {Object} Object containing accumulator-related types and modules
   * @returns {typeof AccumulatorPublicKey} returns.PublicKey - Accumulator public key type
   * @returns {typeof AccumulatorId} returns.AccumulatorId - Accumulator ID type
   * @returns {typeof AccumulatorCommon} returns.AccumulatorCommon - Common accumulator type
   * @returns {Object} returns.AccumulatorModule - Accumulator module instance
   */
  getTypesForDIDOrAccumulator(didOrRegistryId) {
    return {
        PublicKey: AccumulatorPublicKey,
        AccumulatorId,
        AccumulatorCommon,
        AccumulatorModule: this.modules.accumulator,
    }
  }

  /**
   * Ensures the blockchain connection is ready before proceeding
   * @returns {Promise<void>} Resolves when blockchain is ready
   * @example
   * await blockchainService.ensureBlockchainReady();
   * // Blockchain is now connected and ready
   */
  async ensureBlockchainReady() {
    if (await this.isApiConnected()) {
      return;
    }

    return once(this.emitter, BlockchainService.Events.BLOCKCHAIN_READY);
  }

  
  /**
   * Gets the cached DIDs
   * @returns {Promise<string[]>} Cached DIDs
   */
  getCachedDIDs() {
    return this.resolver.getCachedDIDs();
  }

  /**
   * Gets the cached DID resolution data
   * @param {string} did - The DID to get the cache entry for
   * @returns {Promise<any>} Cached DID resolution data
   */
  getCacheEntry(did) {
    return this.resolver.getCacheEntry(did);
  }

  /**
   * Clears cached data for a specific DID
   * @param {string} did - The DID to clear from cache
   * @returns {void}
   */
  clearCache(did) {
    return this.resolver.clearCache(did);
  }

  /**
   * Creates a DID resolver with caching support
   * @private
   * @returns {CachedDIDResolver} Cached DID resolver instance
   */
  createDIDResolver(isBlockchainReady: boolean) {
    let resolvers = [
      new UniversalResolver(universalResolverUrl),
      new DIDKeyResolver(),
    ]

    // Add blockchain resolvers if the blockchain is ready
    if (isBlockchainReady) {
      resolvers = [
        new CoreResolver(this.modules),
        ...resolvers
      ]
    }

    const router = new AnyDIDResolver(resolvers);

    return new CachedDIDResolver(router);
  }
  /**
   * Initializes the blockchain service with connection parameters
   * @param {InitParams} params - Initialization parameters
   * @param {string} params.cheqdApiUrl - URL of the Cheqd API endpoint
   * @param {string} [params.networkId] - Cheqd network identifier
   * @param {string} [params.cheqdMnemonic] - Mnemonic for Cheqd wallet (auto-generated if not provided)
   * @returns {Promise<boolean>} True if initialization successful
   * @throws {Error} If cheqdApiUrl is not provided
   * @example
   * await blockchainService.init({
   *   cheqdApiUrl: 'https://api.cheqd.network',
   *   networkId: 'mainnet'
   * });
   */
  async init(params: InitParams) {
    if (!params?.cheqdApiUrl) {
      throw new Error('cheqdApiUrl is required');
    }

    if (this.cheqdApi && this.cheqdApi.isInitialized()) {
      Logger.info('Disconnecting from cheqd');
      await this.cheqdApi.disconnect();
    }

    this.modules = new MultiApiCoreModules([this.cheqdModules]);

    const checkdApiUrl = params?.cheqdApiUrl;
    const cheqdNetworkId = params?.networkId;
    const cheqdMnemonic =
      params?.cheqdMnemonic || (await utilCryptoService.mnemonicGenerate(12));

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(cheqdMnemonic, {
      prefix: 'cheqd',
    });

    const walletAccounts = await wallet.getAccounts();
    const [{address}] = walletAccounts;
    console.log('Using cheqd account:', address);

    Logger.info(
      `Attempt to initialized cheqd at: ${checkdApiUrl} with networkId: ${cheqdNetworkId}`,
    );
    Logger.info(`Using cheqd account: ${address}`);

    try {
      await this.cheqdApi.init({
        wallet,
        urls: Array.isArray(checkdApiUrl) ? checkdApiUrl : [checkdApiUrl],
        network: cheqdNetworkId,
      });
      Logger.info(`Cheqd initialized at: ${checkdApiUrl}`);
    } catch (err) {
      debugger
      Logger.error(`Failed to initialize cheqd at: ${checkdApiUrl}`, err);
    }


    // Re-create the resolver with the new blockchain connection
    this._resolver = this.createDIDResolver(true);

    if (
      process.env.NODE_ENV !== 'test' ||
      process.env.API_MOCK_DISABLED === 'true'
    ) {
      await initializeWasm();
    }

    this._setBlockchainReady(true);

    return true;
  }

  /**
   * Disconnects from the blockchain
   * @returns {Promise<void>} Resolves when disconnection is complete
   * @example
   * await blockchainService.disconnect();
   */
  async disconnect() {
    let result;

    if (this.cheqdApi && this.cheqdApi.isInitialized()) {
      result = await this.cheqdApi.disconnect();
    }

    this._setBlockchainReady(false);

    return result;
  }

  /**
   * Waits for the blockchain to be ready
   * @returns {Promise<void>} Resolves when blockchain is ready
   * @private
   */
  async waitBlockchainReady() {
    return new Promise(resolve => {
      if (this.isBlockchainReady) {
        resolve();
      } else {
        this.emitter.once(BlockchainService.Events.BLOCKCHAIN_READY, resolve);
      }
    });
  }

  /**
   * Resolves a DID to its document
   * @param {string} did - The DID to resolve
   * @returns {Promise<Object>} The resolved DID document
   * @example
   * const didDoc = await blockchainService.resolveDID('did:key:z6Mk...');
   */
  async resolveDID(did: string) {
    return this.resolver.resolve(did);
  }
  /**
   * Checks if the blockchain API is connected
   * @returns {Promise<boolean>} True if connected, false otherwise
   * @example
   * const isConnected = await blockchainService.isApiConnected();
   */
  async isApiConnected() {
    return this.cheqdApi.isInitialized();
  }

  /**
   * Gets the current Cheqd API URL
   * @returns {Promise<string>} The Cheqd API URL
   * @example
   * const apiUrl = await blockchainService.getAddress();
   */
  async getAddress(): Promise<string | string[]> {
    return this.cheqdApiUrl;
  }

  /**
   * Sets the blockchain ready state and emits events
   * @private
   * @param {boolean} isBlockchainReady - Whether blockchain is ready
   */
  _setBlockchainReady(isBlockchainReady) {
    this.isBlockchainReady = isBlockchainReady;

    if (isBlockchainReady) {
      this.emitter.emit(BlockchainService.Events.BLOCKCHAIN_READY);
    }
  }
}

/**
 * Singleton instance of the blockchain service
 * @type {BlockchainService}
 * @example
 * import { blockchainService } from '@docknetwork/wallet-sdk-wasm/services/blockchain';
 *
 * // Initialize the service
 * await blockchainService.init({
 *   cheqdApiUrl: 'https://api.cheqd.network'
 * });
 *
 * // Resolve a DID
 * const didDoc = await blockchainService.resolveDID('did:key:z6Mk...');
 */
export const blockchainService: BlockchainService = new BlockchainService();
