import {delegationPolicyTravelAgent} from './delegation-fixtures';
import {rejectDelegationRequest, rulesetMatches} from './delegation-request';

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
