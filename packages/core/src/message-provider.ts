/**
 * @module message-provider
 * @description DIDComm message management functionality for the Truvera Wallet SDK.
 * This module provides functions for sending, receiving, and processing DIDComm messages.
 */

import {logger} from '@docknetwork/wallet-sdk-data-store/src/logger';
import {IDIDProvider} from './did-provider';
import {WalletDocumentTypes, captureException} from './helpers';
import {IWallet, IMessageProvider} from './types';
export type {IMessageProvider};
import {relayService as defaultRelayService} from '@docknetwork/wallet-sdk-wasm/src/services/relay-service';

const FETCH_MESSAGE_LIMIT = 10;

/**
 * Internal function to retrieve key pair documents for a DID
 * @private
 */
async function getKeyPairDocs(didProvider: IDIDProvider, did?: string) {
  try {
    const keyPairDocs = await didProvider.getDIDKeyPairs();
    if (did) {
      return keyPairDocs.find(doc => doc.controller === did);
    }
    return keyPairDocs;
  } catch (error) {
    throw new Error(`Failed to get key pair docs: ${error.message}`);
  }
}

/**
 * Creates a message provider instance bound to a wallet and DID provider
 * @param {Object} params - Provider configuration
 * @param {IWallet} params.wallet - The wallet instance to use for message storage
 * @param {IDIDProvider} params.didProvider - The DID provider instance to use for key management
 * @param {any} [params.relayService] - Optional relay service implementation (defaults to built-in service)
 * @returns {IMessageProvider} A message provider instance with all DIDComm message management methods
 * @see {@link IMessageProvider} - The interface defining all available message provider methods
 * @example
 * import { createMessageProvider } from '@docknetwork/wallet-sdk-core';
 *
 * const messageProvider = createMessageProvider({
 *   wallet,
 *   didProvider
 * });
 *
 * // Send a message
 * await messageProvider.sendMessage({
 *   did: 'did:key:sender123',
 *   recipientDid: 'did:key:recipient456',
 *   message: { hello: 'world' }
 * });
 *
 * // Start auto-fetching messages
 * const stopAutoFetch = messageProvider.startAutoFetch(5000);
 *
 * // Add message listener
 * const removeListener = messageProvider.addMessageListener((message) => {
 *   console.log('Received message:', message);
 * });
 */
export function createMessageProvider({
  wallet,
  didProvider,
  relayService = defaultRelayService,
}: {
  wallet: IWallet;
  didProvider: IDIDProvider;
  relayService?: any;
}): IMessageProvider {
  async function markMessageAsRead(messageId: string) {
    try {
      const message = await wallet.getDocumentById(messageId);

      if (message.type !== WalletDocumentTypes.DIDCommMessage) {
        throw new Error(
          `Document with id ${messageId} is not a DIDCommMessage`,
        );
      }

      await wallet.removeDocument(messageId);
    } catch (error) {
      captureException(error);
      console.error(`Failed to mark message as read: ${error.message}`);
    }
  }

  let processingLock = false;
  async function processDIDCommMessages(limit = 1) {
    if (processingLock) {
      return;
    }

    processingLock = true;
    try {
      const processMessagesStartTime = Date.now();
      const messages = await wallet.getDocumentsByType(
        WalletDocumentTypes.DIDCommMessage,
      );

      if (messages.length === 0) {
        return;
      }

      logger.debug('Processing DIDComm messages');
      

      const keyPairDocs = await getKeyPairDocs(didProvider);
      let count = 0;
      for (const message of messages) {
        if (count >= limit) {
          return;
        }
        try {
          if (!message.encryptedMessage) {
            await wallet.removeDocument(message.id);
            throw new Error(
              `Message with payload ${JSON.stringify(message)} is invalid`,
            );
          }
          const decryptedMessage = await relayService.resolveDidcommMessage({
            keyPairDocs,
            message: message.encryptedMessage,
          });
          wallet.eventManager.emit('didcomm-message-decrypted', {
            decryptedMessage,
            messageId: message.id,
          });
          await markMessageAsRead(message.id);
          count++;
        } catch (err) {
          if (err.message?.includes('the DID in question does not exist')) {
            // the DID lookup failed (a testnet credential was issued to a mainnet did), so we can't
            // decrypt the message remove the message from the wallet
            await wallet.removeDocument(message.id);
          }
          captureException(err);
        }
      }
      logger.performance('Processed messages', processMessagesStartTime);
    } catch (error) {
      captureException(error);
      throw new Error(`Failed to process DIDComm messages: ${error.message}`);
    } finally {
      processingLock = false;
    }
  }

  let recentlyFetchedMessages = [];

  async function fetchMessages() {
    try {
      const fetchMessagesStartTime = Date.now();
      const keyPairDocs = await getKeyPairDocs(didProvider);
      let encryptedMessages = await relayService.getMessages({
        keyPairDocs,
        limit: FETCH_MESSAGE_LIMIT,
        skipMessageResolution: true,
      });
      const messageIdsPerDid = {};

      encryptedMessages = encryptedMessages.filter(
        message => !recentlyFetchedMessages.includes(message._id),
      );

      if (!encryptedMessages.length) {
        return;
      }

      logger.debug(`Fetched ${encryptedMessages.length} messages`);

      for (const message of encryptedMessages) {
        try {
          if (!messageIdsPerDid[message.to]) {
            messageIdsPerDid[message.to] = [];
          }

          messageIdsPerDid[message.to].push(message._id);

          await wallet.addDocument({
            id: message._id,
            type: WalletDocumentTypes.DIDCommMessage,
            encryptedMessage: message,
          });

          recentlyFetchedMessages.push(message._id);
        } catch (err) {
          logger.debug(
            `Failed to store message in wallet: ${JSON.stringify(message)}`,
          );
          // this message will be lost if it fails to be stored in the wallet
          captureException(err);
        }
      }

      for (const [did, messageIds] of Object.entries(messageIdsPerDid)) {
        logger.debug(
          `Acknowledging ${
            (messageIds as string[])?.length
          } messages for ${did}`,
        );
        let startTime = new Date().getTime();
        relayService
          .ackMessages({
            did,
            messageIds,
          })
          .then(() => {
            logger.performance('Acknowledged messages', startTime);
          })
          .catch(err => {
            console.error('Failed to ack messages', err.message);
          });
      }

      if (encryptedMessages.length > 0) {
        wallet.eventManager.emit(
          'didcomm-messages-received',
          encryptedMessages,
        );

        logger.debug(`Received ${encryptedMessages.length} messages`);
        logger.performance('Fetched messages', fetchMessagesStartTime);
      }

      return encryptedMessages;
    } catch (error) {
      logger.error(`Failed to fetch messages: ${error.message}`);
      captureException(error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  function addMessageListener(handler) {
    const listener = async message => {
      await Promise.resolve(handler(message.decryptedMessage));
    };

    wallet.eventManager.addListener('didcomm-message-decrypted', listener);
    return () =>
      wallet.eventManager.removeListener('didcomm-message-decrypted', listener);
  }

  let listenerIntervalId = null;
  let processMessageTimeoutId = null;
  let stopped = false;

  const processMessageInterval = 3000;

  async function processMessageRecurrentJob() {
    try {
      await processDIDCommMessages();
    } finally {
      if (!stopped) {
        processMessageTimeoutId = setTimeout(processMessageRecurrentJob, processMessageInterval);
      }
    }
  }

  function stop() {
    stopped = true;
    if (listenerIntervalId) {
      clearInterval(listenerIntervalId);
      listenerIntervalId = null;
    }
    if (processMessageTimeoutId) {
      clearTimeout(processMessageTimeoutId);
      processMessageTimeoutId = null;
    }
  }

  return {
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
    async sendMessage({
      // Recommended parameters
      from,
      to,
      message,
      type,
      // Deprecated parameters
      did,
      recipientDid,
      body,
    }) {

      try {
        const keyPairDoc = await getKeyPairDocs(didProvider, from || did);
        if (!keyPairDoc) {
          throw new Error(`${did} not found in didDocs`);
        }
        return await relayService.sendMessage({
          keyPairDoc,
          message: message || body,
          recipientDid: to || recipientDid,
          type,
        });
      } catch (error) {
        captureException(error);
        throw new Error(`Failed to send message: ${error.message}`);
      }
    },
    /**
     * Waits for the next incoming message
     * @memberof IMessageProvider
     * @returns {Promise<any>} Promise that resolves with the next received message
     * @example
     * const nextMessage = await messageProvider.waitForMessage();
     * console.log('Received message:', nextMessage);
     */
    waitForMessage() {
      return new Promise((resolve: any) => {
        let removeListener = addMessageListener(async message => {
          removeListener();
          await resolve(message);
        });
      });
    },
    /**
     * Starts automatic message fetching at regular intervals
     * @memberof IMessageProvider
     * @param {number} [timeout=2000] - Interval in milliseconds between fetch operations
     * @returns {Function} Function to stop the auto-fetch process
     * @example
     * const stopAutoFetch = messageProvider.startAutoFetch(5000);
     * // Later, stop auto-fetching
     * stopAutoFetch();
     */
    startAutoFetch(timeout = 2000) {
      clearInterval(listenerIntervalId);
      stopped = false;
      listenerIntervalId = setInterval(async () => {
        try {
          await fetchMessages();
          await processDIDCommMessages();
        } catch (err) {
          logger.debug(`Auto-fetch error: ${err.message}`);
        }
      }, timeout);

      return () => {
        clearInterval(listenerIntervalId);
        listenerIntervalId = null;
      };
    },
    /**
     * Clears all cached messages from the wallet
     * @memberof IMessageProvider
     * @returns {Promise<void>}
     * @example
     * await messageProvider.clearCache();
     * console.log('All messages cleared');
     */
    clearCache: async () => {
      return Promise.all(
        (
          await wallet.getDocumentsByType(WalletDocumentTypes.DIDCommMessage)
        ).map(document => {
          markMessageAsRead(document.id);
          return wallet.removeDocument(document.id);
        }),
      );
    },
    /**
     * Fetches new messages from the relay service
     * @memberof IMessageProvider
     * @returns {Promise<void>}
     * @throws {Error} If message fetching fails
     * @example
     * await messageProvider.fetchMessages();
     * console.log('Messages fetched successfully');
     */
    fetchMessages,
    /**
     * Adds a listener for when messages are decrypted
     * @memberof IMessageProvider
     * @param {Function} handler - Callback function to handle decrypted messages
     * @returns {Function} Function to remove the listener
     * @example
     * const removeListener = messageProvider.addMessageListener((message) => {
     *   console.log('New message received:', message);
     * });
     * // Later, remove the listener
     * removeListener();
     */
    addMessageListener,
    /**
     * Processes stored DIDComm messages and decrypts them
     * @memberof IMessageProvider
     * @returns {Promise<void>}
     * @throws {Error} If message processing fails
     * @example
     * await messageProvider.processDIDCommMessages();
     * console.log('Messages processed successfully');
     */
    processDIDCommMessages,
    /**
     * Starts the recurrent message processing job
     * @memberof IMessageProvider
     * @returns {Promise<void>}
     * @example
     * await messageProvider.processMessageRecurrentJob();
     */
    processMessageRecurrentJob,
    /**
     * Marks a message as read and removes it from storage
     * @memberof IMessageProvider
     * @param {string} messageId - The ID of the message to mark as read
     * @returns {Promise<void>}
     * @throws {Error} If message is not found or not a DIDComm message
     * @example
     * await messageProvider.markMessageAsRead('message-id-123');
     * console.log('Message marked as read');
     */
    markMessageAsRead,
    stop,
  } as any;
}
