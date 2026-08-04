import {delegationPolicyTravelAgent} from './delegation-fixtures';
import {
  DELEGATION_PROPOSAL_HANDLER,
  rejectDelegationRequest,
  rulesetMatches,
} from './delegation-request';
import {getAllDIDs} from '../did-provider';

jest.mock('../did-provider', () => ({
  getAllDIDs: jest.fn(),
}));

function clone(value: any): any {
  return JSON.parse(JSON.stringify(value));
}

// Recursively reverse object key order (arrays keep their order).
function reverseKeys(value: any): any {
  if (Array.isArray(value)) {
    return value.map(reverseKeys);
  }
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const key of Object.keys(value).reverse()) {
      out[key] = reverseKeys(value[key]);
    }
    return out;
  }
  return value;
}

describe('rulesetMatches', () => {
  it('matches identical rulesets from policies with different envelope fields', () => {
    const policyA = clone(delegationPolicyTravelAgent);
    const policyB = clone(delegationPolicyTravelAgent);
    policyB.id = 'urn:uuid:00000000-0000-0000-0000-000000000000';
    policyB.name = 'A different name';
    policyB.createdAt = '2030-01-01T00:00:00.000Z';

    expect(rulesetMatches(policyA.ruleset, policyB.ruleset)).toBe(true);
  });

  it('matches the same ruleset with different key ordering', () => {
    const a = clone(delegationPolicyTravelAgent.ruleset);
    const b = reverseKeys(clone(delegationPolicyTravelAgent.ruleset));

    expect(rulesetMatches(a, b)).toBe(true);
  });

  it('matches the same ruleset with roles reordered', () => {
    const a = clone(delegationPolicyTravelAgent.ruleset);
    const b = clone(delegationPolicyTravelAgent.ruleset);
    b.roles.reverse();

    expect(rulesetMatches(a, b)).toBe(true);
  });

  it('matches the same ruleset with capabilityGrants reordered', () => {
    const a = clone(delegationPolicyTravelAgent.ruleset);
    const b = clone(delegationPolicyTravelAgent.ruleset);
    b.roles.forEach(role => role.capabilityGrants.reverse());

    expect(rulesetMatches(a, b)).toBe(true);
  });

  it('does not match when a capability schema changed', () => {
    const a = clone(delegationPolicyTravelAgent.ruleset);
    const b = clone(delegationPolicyTravelAgent.ruleset);
    const purchaseGrant = b.roles[0].capabilityGrants.find(
      g => g.capability === 'Purchase',
    );
    purchaseGrant.schema.maximum = 50;

    expect(rulesetMatches(a, b)).toBe(false);
  });

  it('does not match when a role changed', () => {
    const a = clone(delegationPolicyTravelAgent.ruleset);
    const b = clone(delegationPolicyTravelAgent.ruleset);
    b.roles[1].roleId = 'a-different-role-id';

    expect(rulesetMatches(a, b)).toBe(false);
  });
});

describe('DELEGATION_PROPOSAL_HANDLER', () => {
  const DELEGATOR_DID = 'did:test:delegator';
  const REQUESTER_DID = 'did:test:requester';

  function makeWallet(existing: any = null) {
    return {
      getDocumentById: jest.fn().mockResolvedValue(existing),
      addDocument: jest.fn().mockResolvedValue(undefined),
      updateDocument: jest.fn().mockResolvedValue(undefined),
      getDocumentsByType: jest.fn().mockResolvedValue([]),
      eventManager: {emit: jest.fn()},
    };
  }

  function makeMessage(requestOverrides: any = {}) {
    return {
      type: 'https://didcomm.org/issue-credential/3.0/propose-credential',
      from: REQUESTER_DID,
      body: {
        goal_code: 'dock.request-delegation',
        delegation_request: {
          id: 'req-1',
          requesterDID: REQUESTER_DID,
          delegatorDID: DELEGATOR_DID,
          delegationPolicy: clone(delegationPolicyTravelAgent),
          delegationRole: 'some-role',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          status: 'pending',
          ...requestOverrides,
        },
      },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (getAllDIDs as jest.Mock).mockResolvedValue([
      {didDocument: {id: DELEGATOR_DID}},
    ]);
  });

  it('ignores requests whose delegatorDID is not owned by this wallet', async () => {
    (getAllDIDs as jest.Mock).mockResolvedValue([
      {didDocument: {id: 'did:test:someone-else'}},
    ]);
    const wallet = makeWallet();

    await DELEGATION_PROPOSAL_HANDLER.handle(makeMessage(), {
      wallet,
      messageProvider: {},
    });

    expect(wallet.addDocument).not.toHaveBeenCalled();
    expect(wallet.eventManager.emit).not.toHaveBeenCalled();
  });

  it('clamps a far-future expiresAt to the delegator-side maximum', async () => {
    const wallet = makeWallet();
    const farFuture = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    await DELEGATION_PROPOSAL_HANDLER.handle(
      makeMessage({expiresAt: farFuture}),
      {wallet, messageProvider: {}},
    );

    const stored = wallet.addDocument.mock.calls[0][0];
    const cap = Date.now() + 24 * 60 * 60 * 1000;
    expect(new Date(stored.expiresAt).getTime()).toBeLessThanOrEqual(cap);
    expect(new Date(stored.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('sets expiresAt to the maximum when missing', async () => {
    const wallet = makeWallet();

    await DELEGATION_PROPOSAL_HANDLER.handle(
      makeMessage({expiresAt: undefined}),
      {wallet, messageProvider: {}},
    );

    const stored = wallet.addDocument.mock.calls[0][0];
    expect(stored.expiresAt).toBeDefined();
    expect(new Date(stored.expiresAt).getTime()).toBeLessThanOrEqual(
      Date.now() + 24 * 60 * 60 * 1000,
    );
  });

  it('persists the current sender on a re-sent pending proposal', async () => {
    const existing = {
      id: 'req-1',
      type: 'DelegationRequest',
      requesterDID: 'did:test:original-sender',
      delegatorDID: DELEGATOR_DID,
      status: 'pending',
    };
    const wallet = makeWallet(existing);

    await DELEGATION_PROPOSAL_HANDLER.handle(makeMessage(), {
      wallet,
      messageProvider: {},
    });

    expect(wallet.addDocument).not.toHaveBeenCalled();
    expect(wallet.updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'req-1',
        requesterDID: REQUESTER_DID,
        status: 'pending',
        updatedAt: expect.any(String),
      }),
    );
  });
});

describe('rejectDelegationRequest', () => {
  it('sets the stored request to rejected and sends nothing', async () => {
    const storedRequest = {id: 'request-1', status: 'pending'};
    const wallet = {
      getDocumentById: jest.fn().mockResolvedValue(storedRequest),
      updateDocument: jest.fn().mockResolvedValue(undefined),
    };

    await rejectDelegationRequest({
      delegationRequest: storedRequest as any,
      wallet,
    });

    expect(wallet.updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-1',
        status: 'rejected',
        updatedAt: expect.any(String),
      }),
    );
  });

  it('throws when the stored request does not exist', async () => {
    const wallet = {
      getDocumentById: jest.fn().mockResolvedValue(null),
      updateDocument: jest.fn(),
    };

    await expect(
      rejectDelegationRequest({
        delegationRequest: {id: 'missing'} as any,
        wallet,
      }),
    ).rejects.toThrow('DelegationRequest missing not found');
    expect(wallet.updateDocument).not.toHaveBeenCalled();
  });
});
