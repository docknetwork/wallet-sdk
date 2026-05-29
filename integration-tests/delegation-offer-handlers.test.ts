import {
  DELEGATION_REQUEST_HANDLER,
  ISSUE_CREDENTIAL_HANDLER,
} from '../packages/core/src/delegation/delegation-offer';

function createStubWallet(offer: any) {
  const documents: Record<string, any> = {};
  if (offer) {
    documents[offer.id] = offer;
  }
  return {
    documents,
    sentMessages: [] as any[],
    emittedEvents: [] as any[],
    getDocumentById: jest.fn(async (id: string) => documents[id]),
    addDocument: jest.fn(async (doc: any) => {
      documents[doc.id] = doc;
      return doc;
    }),
    updateDocument: jest.fn(async (doc: any) => {
      documents[doc.id] = doc;
      return doc;
    }),
    eventManager: {
      emit: jest.fn(),
    },
  };
}

function createStubMessageProvider() {
  return {
    sendMessage: jest.fn(async () => undefined),
  };
}

describe('DELEGATION_REQUEST_HANDLER rejection paths', () => {
  const offerId = 'offer-1';
  const issuerDID = 'did:test:issuer';
  const holderDID = 'did:test:holder';
  const attackerDID = 'did:test:attacker';

  function buildRequest(overrides: any = {}) {
    return {
      type: 'https://didcomm.org/issue-credential/3.0/request-credential',
      from: holderDID,
      to: issuerDID,
      body: {
        goal_code: 'dock.offer-delegation',
        offer_id: offerId,
      },
      ...overrides,
    };
  }

  function buildStoredOffer(overrides: any = {}) {
    return {
      id: offerId,
      type: 'DelegationOffer',
      issuerDID,
      status: 'sent',
      credentialId: 'cred-1',
      delegationPolicy: {},
      delegationRole: 'role-1',
      sentAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ...overrides,
    };
  }

  it('returns silently when no offer is found for the request', async () => {
    const wallet = createStubWallet(null);
    const messageProvider = createStubMessageProvider();

    await DELEGATION_REQUEST_HANDLER.handle(buildRequest(), {
      wallet,
      messageProvider,
    });

    expect(messageProvider.sendMessage).not.toHaveBeenCalled();
    expect(wallet.updateDocument).not.toHaveBeenCalled();
  });

  it('rejects requests for offers not in `sent` state', async () => {
    const wallet = createStubWallet(buildStoredOffer({status: 'accepted'}));
    const messageProvider = createStubMessageProvider();

    await DELEGATION_REQUEST_HANDLER.handle(buildRequest(), {
      wallet,
      messageProvider,
    });

    expect(messageProvider.sendMessage).not.toHaveBeenCalled();
    expect(wallet.updateDocument).not.toHaveBeenCalled();
  });

  it('rejects requests from senders not in offer.to (array form)', async () => {
    const wallet = createStubWallet(
      buildStoredOffer({to: [holderDID]}),
    );
    const messageProvider = createStubMessageProvider();

    await DELEGATION_REQUEST_HANDLER.handle(
      buildRequest({from: attackerDID}),
      {wallet, messageProvider},
    );

    expect(messageProvider.sendMessage).not.toHaveBeenCalled();
    expect(wallet.updateDocument).not.toHaveBeenCalled();
  });

  it('rejects requests from senders not matching offer.to (string form)', async () => {
    const wallet = createStubWallet(buildStoredOffer({to: holderDID}));
    const messageProvider = createStubMessageProvider();

    await DELEGATION_REQUEST_HANDLER.handle(
      buildRequest({from: attackerDID}),
      {wallet, messageProvider},
    );

    expect(messageProvider.sendMessage).not.toHaveBeenCalled();
    expect(wallet.updateDocument).not.toHaveBeenCalled();
  });

  it('rejects expired offers', async () => {
    const wallet = createStubWallet(
      buildStoredOffer({
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    );
    const messageProvider = createStubMessageProvider();

    await DELEGATION_REQUEST_HANDLER.handle(buildRequest(), {
      wallet,
      messageProvider,
    });

    expect(messageProvider.sendMessage).not.toHaveBeenCalled();
    expect(wallet.updateDocument).not.toHaveBeenCalled();
  });
});

describe('ISSUE_CREDENTIAL_HANDLER rejection paths', () => {
  const offerId = 'offer-2';
  const issuerDID = 'did:test:issuer';
  const holderDID = 'did:test:holder';
  const attackerDID = 'did:test:attacker';

  function buildIssueMessage(overrides: any = {}) {
    return {
      id: 'msg-1',
      type: 'https://didcomm.org/issue-credential/3.0/issue-credential',
      from: issuerDID,
      to: [holderDID],
      body: {
        goal_code: 'dock.offer-delegation',
        delegationOfferId: offerId,
        credentials: [{id: 'delegated-cred-1', type: ['DelegationCredential']}],
        delegationChain: [],
      },
      ...overrides,
    };
  }

  function buildStoredOffer(overrides: any = {}) {
    return {
      id: offerId,
      type: 'DelegationOffer',
      issuerDID,
      status: 'requested',
      ...overrides,
    };
  }

  it('returns when delegationOfferId is missing from the message', async () => {
    const wallet = createStubWallet(buildStoredOffer());
    const messageProvider = createStubMessageProvider();

    await ISSUE_CREDENTIAL_HANDLER.handle(
      buildIssueMessage({
        body: {goal_code: 'dock.offer-delegation', credentials: []},
      }),
      {wallet, messageProvider},
    );

    expect(wallet.addDocument).not.toHaveBeenCalled();
    expect(messageProvider.sendMessage).not.toHaveBeenCalled();
  });

  it('returns when no stored offer exists for the delegationOfferId', async () => {
    const wallet = createStubWallet(null);
    const messageProvider = createStubMessageProvider();

    await ISSUE_CREDENTIAL_HANDLER.handle(buildIssueMessage(), {
      wallet,
      messageProvider,
    });

    expect(wallet.addDocument).not.toHaveBeenCalled();
    expect(messageProvider.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects credentials from a DID other than the stored issuerDID', async () => {
    const wallet = createStubWallet(buildStoredOffer());
    const messageProvider = createStubMessageProvider();

    await ISSUE_CREDENTIAL_HANDLER.handle(
      buildIssueMessage({from: attackerDID}),
      {wallet, messageProvider},
    );

    expect(wallet.addDocument).not.toHaveBeenCalled();
    expect(messageProvider.sendMessage).not.toHaveBeenCalled();
    expect(wallet.eventManager.emit).not.toHaveBeenCalled();
  });

  it('returns when the credentials array is empty', async () => {
    const wallet = createStubWallet(buildStoredOffer());
    const messageProvider = createStubMessageProvider();

    await ISSUE_CREDENTIAL_HANDLER.handle(
      buildIssueMessage({
        body: {
          goal_code: 'dock.offer-delegation',
          delegationOfferId: offerId,
          credentials: [],
          delegationChain: [],
        },
      }),
      {wallet, messageProvider},
    );

    expect(wallet.addDocument).not.toHaveBeenCalled();
    expect(messageProvider.sendMessage).not.toHaveBeenCalled();
  });
});
