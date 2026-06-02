import {DelegationPolicy} from './delegation-types';
import {
  delegationPolicyPharmacy,
  delegationPolicyTravelAgent,
} from './delegation-fixtures';
import {
  assertPolicyConformsToParent,
  validateDelegationPolicy,
} from './delegation-policy-validation';

function clonePolicy(policy: any): DelegationPolicy {
  return JSON.parse(JSON.stringify(policy));
}

describe('validateDelegationPolicy', () => {
  it('accepts the travel-agent fixture', () => {
    expect(() => validateDelegationPolicy(delegationPolicyTravelAgent)).not.toThrow();
  });

  it('accepts the pharmacy fixture', () => {
    expect(() => validateDelegationPolicy(delegationPolicyPharmacy)).not.toThrow();
  });

  it('rejects a non-object', () => {
    expect(() => validateDelegationPolicy(null)).toThrow(/must be an object/);
    expect(() => validateDelegationPolicy('foo')).toThrow(/must be an object/);
  });

  it('rejects a wrong type field', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    (policy as any).type = 'NotAPolicy';
    expect(() => validateDelegationPolicy(policy)).toThrow(/type must be/);
  });

  it('rejects an unsupported delegationTarget', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.delegationTarget = 'multi-credential' as any;
    expect(() => validateDelegationPolicy(policy)).toThrow(/delegationTarget/);
  });

  it('rejects maxDelegationDepth out of range', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.overallConstraints.maxDelegationDepth = 99;
    expect(() => validateDelegationPolicy(policy)).toThrow(/maxDelegationDepth/);
  });

  it('rejects an invalid lifetime unit', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.overallConstraints.delegatedCredentialLifetime.unit = 'weeks';
    expect(() => validateDelegationPolicy(policy)).toThrow(/unit/);
  });

  it('rejects a non-positive lifetime value', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.overallConstraints.delegatedCredentialLifetime.value = 0;
    expect(() => validateDelegationPolicy(policy)).toThrow(/value/);
  });

  it('rejects duplicate capability names', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.capabilities.push({...policy.ruleset.capabilities[0]});
    expect(() => validateDelegationPolicy(policy)).toThrow(/duplicate capability/);
  });

  it('rejects an unsupported capability schema type', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    (policy.ruleset.capabilities[0].schema as any).type = 'object';
    expect(() => validateDelegationPolicy(policy)).toThrow(/schema\.type/);
  });

  it('rejects duplicate roleIds', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.roles[1].roleId = policy.ruleset.roles[0].roleId;
    expect(() => validateDelegationPolicy(policy)).toThrow(/duplicate roleId/);
  });

  it('rejects an orphan parentRoleId', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.roles[1].parentRoleId = 'does-not-exist';
    expect(() => validateDelegationPolicy(policy)).toThrow(/unknown parentRoleId/);
  });

  it('rejects more than one root role', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.roles[1].parentRoleId = null;
    expect(() => validateDelegationPolicy(policy)).toThrow(/exactly one root role/);
  });

  it('rejects a grant referencing an unknown capability', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.roles[0].capabilityGrants[0].capability = 'Phantom';
    expect(() => validateDelegationPolicy(policy)).toThrow(/unknown capability/);
  });

  it('rejects a grant whose schema.type does not match the capability', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    (policy.ruleset.roles[0].capabilityGrants[0].schema as any).type = 'integer';
    expect(() => validateDelegationPolicy(policy)).toThrow(/schema\.type/);
  });

  it('rejects a child role granting a capability the ancestor does not', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.roles[0].capabilityGrants = policy.ruleset.roles[0].capabilityGrants.filter(
      g => g.capability !== 'Reserve Hotels',
    );
    expect(() => validateDelegationPolicy(policy)).toThrow(
      /grants "Reserve Hotels" but ancestor/,
    );
  });

  it('rejects a child integer maximum exceeding the ancestor maximum', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    const hotel = policy.ruleset.roles.find(r => r.label === 'Hotel Sub-agent')!;
    const purchase = hotel.capabilityGrants.find(g => g.capability === 'Purchase')!;
    (purchase.schema as any).maximum = 200;
    expect(() => validateDelegationPolicy(policy)).toThrow(/maximum exceeds parent/);
  });

  it('rejects a child array enum that is not a subset of the ancestor enum', () => {
    const policy = clonePolicy(delegationPolicyPharmacy);
    const pharmacy = policy.ruleset.roles.find(r => r.label === 'Pharmacy')!;
    const claims = pharmacy.capabilityGrants.find(g => g.capability === 'Allowed Claims')!;
    (claims.schema as any).items.enum = ['Refund'];
    expect(() => validateDelegationPolicy(policy)).toThrow(/items\.enum is not a subset/);
  });

  it('rejects child explicit attributes when not a subset of an ancestor explicit list', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.roles[0].attributes = ['subject.firstName'];
    const child = policy.ruleset.roles.find(r => r.label === 'Corporate Account Manager')!;
    child.attributes = ['subject.lastName'];
    expect(() => validateDelegationPolicy(policy)).toThrow(/attributes are not a subset/);
  });

  it('allows a child wildcard under a narrowed ancestor', () => {
    const policy = clonePolicy(delegationPolicyTravelAgent);
    policy.ruleset.roles[0].attributes = ['subject.firstName'];
    expect(() => validateDelegationPolicy(policy)).not.toThrow();
  });
});

describe('assertPolicyConformsToParent', () => {
  const PARENT_ROLE = 'e79c0d16-8739-4e54-94d7-53d9f1c97c71';
  const baseOpts = {delegationRole: PARENT_ROLE, remainingDepth: 3};

  it('accepts a policy identical to the parent', () => {
    expect(() =>
      assertPolicyConformsToParent(
        clonePolicy(delegationPolicyTravelAgent),
        delegationPolicyTravelAgent,
        baseOpts,
      ),
    ).not.toThrow();
  });

  it('rejects when remaining delegation depth is zero', () => {
    expect(() =>
      assertPolicyConformsToParent(
        clonePolicy(delegationPolicyTravelAgent),
        delegationPolicyTravelAgent,
        {delegationRole: PARENT_ROLE, remainingDepth: 0},
      ),
    ).toThrow(/no remaining delegation depth/);
  });

  it('rejects when child maxDelegationDepth exceeds parent', () => {
    const child = clonePolicy(delegationPolicyTravelAgent);
    child.ruleset.overallConstraints.maxDelegationDepth = 9;
    const parent = clonePolicy(delegationPolicyTravelAgent);
    parent.ruleset.overallConstraints.maxDelegationDepth = 2;
    expect(() => assertPolicyConformsToParent(child, parent, baseOpts)).toThrow(
      /maxDelegationDepth/,
    );
  });

  it('rejects when child lifetime exceeds parent lifetime (cross-unit)', () => {
    const child = clonePolicy(delegationPolicyTravelAgent);
    child.ruleset.overallConstraints.delegatedCredentialLifetime = {value: 400, unit: 'days'};
    const parent = clonePolicy(delegationPolicyTravelAgent);
    parent.ruleset.overallConstraints.delegatedCredentialLifetime = {value: 1, unit: 'years'};
    expect(() => assertPolicyConformsToParent(child, parent, baseOpts)).toThrow(
      /delegatedCredentialLifetime/,
    );
  });

  it('rejects when the delegationRole is missing from the policy', () => {
    expect(() =>
      assertPolicyConformsToParent(
        clonePolicy(delegationPolicyTravelAgent),
        delegationPolicyTravelAgent,
        {delegationRole: 'missing-role', remainingDepth: 3},
      ),
    ).toThrow(/not found in delegationPolicy/);
  });

  it('rejects when the child grants a capability the parent does not', () => {
    const child = clonePolicy(delegationPolicyTravelAgent);
    const childRoot = child.ruleset.roles.find(r => r.roleId === PARENT_ROLE)!;
    childRoot.capabilityGrants.push({
      capability: 'Phantom',
      schema: {type: 'boolean', const: true},
    } as any);
    expect(() =>
      assertPolicyConformsToParent(child, delegationPolicyTravelAgent, baseOpts),
    ).toThrow(/parent does not/);
  });

  it('rejects when child integer maximum exceeds parent', () => {
    const child = clonePolicy(delegationPolicyTravelAgent);
    const childRoot = child.ruleset.roles.find(r => r.roleId === PARENT_ROLE)!;
    const purchase = childRoot.capabilityGrants.find(g => g.capability === 'Purchase')!;
    (purchase.schema as any).maximum = 999;
    expect(() =>
      assertPolicyConformsToParent(child, delegationPolicyTravelAgent, baseOpts),
    ).toThrow(/maximum exceeds parent/);
  });

  it('rejects when child enum is not a subset of parent enum', () => {
    const PHARMACY_ROOT = '6ed167b3-90be-4f9a-a8d2-542d2f212d79';
    const child = clonePolicy(delegationPolicyPharmacy);
    const childRoot = child.ruleset.roles.find(r => r.roleId === PHARMACY_ROOT)!;
    const claims = childRoot.capabilityGrants.find(g => g.capability === 'Allowed Claims')!;
    (claims.schema as any).items.enum = ['Refund'];
    expect(() =>
      assertPolicyConformsToParent(child, delegationPolicyPharmacy as DelegationPolicy, {
        delegationRole: PHARMACY_ROOT,
        remainingDepth: 3,
      }),
    ).toThrow(/items\.enum is not a subset/);
  });
});
