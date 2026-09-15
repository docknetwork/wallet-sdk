import { createDataStore } from '@docknetwork/wallet-sdk-data-store-typeorm/src';
import {IDIDProvider, createDIDProvider} from './did-provider';
import {IMessageProvider, createMessageProvider} from './message-provider';
import {IWallet, createWallet} from './wallet';

describe('MessageProvider', () => {
  let messageProvider: IMessageProvider;
  let wallet: IWallet;
  let didProvider: IDIDProvider;
  let relayService: any;
  let didCommMessages = [
    {
      _id: '651e965410fc3fcfffdd17f1',
      to: 'did:key:z6MkoQzWru66w91EH7U9Xsv5eYXQabw9U3ZJd5GkatMWkmZT',
      from: 'did:key:z6MkoQzWru66w91EH7U9Xsv5eYXQabw9U3ZJd5GkatMWkmZT',
      msg: '<encrypted-message>',
    },
    {
      _id: '951e965410fc3fcfffdd17f1',
      to: 'did:key:z6MkoQzWru66w91EH7U9Xsv5eYXQabw9U3ZJd5GkatMWkmZT',
      from: 'did:key:z6MkoQzWru66w91EH7U9Xsv5eYXQabw9U3ZJd5GkatMWkmZT',
      msg: '<encrypted-message>',
    },
  ];

  beforeEach(async () => {
    relayService = {
      sendMessage: jest.fn(),
      ackMessages: jest.fn().mockResolvedValue(undefined),
      getMessages: jest.fn().mockResolvedValue(didCommMessages),
      resolveDidcommMessage: jest.fn().mockImplementation(({ message }) => message),
    };

    wallet = await createWallet({
      dataStore: await createDataStore({
        databasePath: ':memory:',
      })
    });
    didProvider = createDIDProvider({
      wallet,
    });
    didProvider.getDIDKeyPairs = jest.fn().mockResolvedValue([{controller: "did:key:z6MkoQzWru66w91EH7U9Xsv5eYXQabw9U3ZJd5GkatMWkmZT"}])
    messageProvider = createMessageProvider({
      wallet,
      didProvider,
      relayService,
    });
  });

  it('should fetch messages and store encrypted data in the wallet', async () => {
    const messages = await messageProvider.fetchMessages();
    expect(messages).toEqual(didCommMessages);

    for(let message of didCommMessages) {
      const walletMessage = await wallet.getDocumentById(message._id);
      expect(walletMessage.encryptedMessage).toEqual(message);
    }

    expect(relayService.ackMessages).toBeCalledWith({did: 'did:key:z6MkoQzWru66w91EH7U9Xsv5eYXQabw9U3ZJd5GkatMWkmZT', messageIds: didCommMessages.map(m => m._id)});
  });

  it('should decrypt encrypted messages in the wallet', async () => {
    jest.spyOn(wallet.eventManager, 'emit').mockReset();

    await messageProvider.fetchMessages()
    await messageProvider.processDIDCommMessages();

    expect(wallet.eventManager.emit).toHaveBeenCalledWith('didcomm-messages-received', didCommMessages);
    expect(wallet.eventManager.emit).toHaveBeenCalledWith('didcomm-message-decrypted', {"decryptedMessage": didCommMessages[0], "messageId": didCommMessages[0]._id});
  });


  it('should handle errors when fetching messages', async () => {
    relayService.getMessages.mockRejectedValue(new Error('Fetching failed'));
    
    await expect(messageProvider.fetchMessages()).rejects.toThrow('Failed to fetch messages: Fetching failed');
  });

  it('should handle errors when sending messages', async () => {
    relayService.sendMessage.mockRejectedValue(new Error('Sending failed'));
    
    await expect(
      messageProvider.sendMessage({
        did: 'did:key:z6MkoQzWru66w91EH7U9Xsv5eYXQabw9U3ZJd5GkatMWkmZT',
        message: 'someMessage',
        recipientDid: 'recipientDid',
      })
    ).rejects.toThrow('Failed to send message: Sending failed');
  });

  // it('should handle errors when processing DIDComm messages', async () => {
  //   relayService.resolveDidcommMessage.mockRejectedValue(new Error('Decryption failed'));
    
  //   await expect(messageProvider.processDIDCommMessages()).rejects.toThrow('Failed to process DIDComm messages: Decryption failed');
  // });

  it('should skip did that fail lookup when processing DIDComm messages', async () => {
    jest.spyOn(wallet.eventManager, 'emit').mockReset();
    const messageProvider2 = createMessageProvider({
      wallet,
      didProvider,
      relayService: {
        ...relayService,
        resolveDidcommMessage: jest.fn().mockRejectedValueOnce(new Error('A DID document lookup was successful, but the DID in question does not exist. This is different from a network error.')).mockImplementation(({ message }) => message),
      },
    });

    await messageProvider2.fetchMessages()
    await messageProvider2.processDIDCommMessages();

    expect(wallet.eventManager.emit).toHaveBeenCalledWith('didcomm-messages-received', didCommMessages);
    expect(wallet.eventManager.emit).toHaveBeenCalledWith('didcomm-message-decrypted', {"decryptedMessage": didCommMessages[1], "messageId": didCommMessages[1]._id});
  });

  it('should handle errors when marking messages as read', async () => {
    await messageProvider.fetchMessages();
    wallet.removeDocument = jest.fn().mockRejectedValue(new Error('Removal failed'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // markMessageAsRead swallows errors (it's a best-effort cleanup step) instead of
    // throwing, logging them via captureException/console.error instead.
    await expect(
      messageProvider.markMessageAsRead('651e965410fc3fcfffdd17f1'),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to mark message as read: Removal failed',
    );

    consoleSpy.mockRestore();
  });
});
