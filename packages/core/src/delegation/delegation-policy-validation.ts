import assert from 'assert';
import {
  CapabilityGrant,
  DelegationPolicy,
  Role,
} from './delegation-types';

export const MAX_DELEGATION_DEPTH = 9;
export const ALLOWED_LIFETIME_UNITS = ['days', 'months', 'years'] as const;
export const ALLOWED_GRANT_TYPES = ['boolean', 'array', 'integer'] as const;
export const ALLOWED_DELEGATION_TARGETS = ['single-credential'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function lifetimeToDays(lifetime: {value: number; unit: string}): number {
  const numeric = Number(lifetime?.value);
  if (!Number.isFinite(numeric)) return 0;
  if (lifetime.unit === 'months') return numeric * 30;
  if (lifetime.unit === 'years') return numeric * 365;
  return numeric;
}

function getGrantsByCapability(role: Role): Record<string, CapabilityGrant> {
  const out: Record<string, CapabilityGrant> = {};
  for (const grant of role.capabilityGrants || []) {
    out[grant.capability] = grant;
  }
  return out;
}

function getAncestorChain(role: Role, rolesById: Record<string, Role>): Role[] {
  const chain: Role[] = [];
  let cursor = role.parentRoleId ? rolesById[role.parentRoleId] : null;
  const visited = new Set<string>();
  while (cursor && !visited.has(cursor.roleId)) {
    visited.add(cursor.roleId);
    chain.push(cursor);
    cursor = cursor.parentRoleId ? rolesById[cursor.parentRoleId] : null;
  }
  return chain;
}

function isSubset<T>(child: T[], parent: T[]): boolean {
  const set = new Set(parent);
  return child.every(v => set.has(v));
}

function getEnum(schema: any): string[] | null {
  if (schema?.type === 'array' && Array.isArray(schema?.items?.enum)) {
    return schema.items.enum;
  }
  return null;
}

function isWildcardAttrs(attrs: string[]): boolean {
  return attrs.length === 1 && attrs[0] === '*';
}

function assertGrantNarrows(
  childSchema: any,
  parentSchema: any,
  describe: (suffix: string) => string,
) {
  if (childSchema.type === 'integer' && parentSchema.maximum !== undefined) {
    assert(
      childSchema.maximum !== undefined && childSchema.maximum <= parentSchema.maximum,
      describe(`maximum exceeds parent ${parentSchema.maximum}`),
    );
  }

  if (childSchema.type === 'array') {
    const parentEnum = getEnum(parentSchema);
    if (parentEnum) {
      const childEnum = getEnum(childSchema);
      assert(
        childEnum && isSubset(childEnum, parentEnum),
        describe('items.enum is not a subset of parent'),
      );
    }
  }
}

/**
 * Validate the structural integrity of a delegation policy.
 *
 * Throws on the first failure. Only checks invariants that downstream code
 * relies on or that have security implications — fields like display labels
 * and metadata strings are left to the type contract.
 */
export function validateDelegationPolicy(policy: any): asserts policy is DelegationPolicy {
  assert(isPlainObject(policy), 'delegationPolicy must be an object');
  assert(
    policy.type === 'DelegationPolicy',
    `delegationPolicy.type must be 'DelegationPolicy'`,
  );
  assert(
    policy.name === undefined || typeof policy.name === 'string',
    'delegationPolicy.name must be a string when present',
  );
  assert(isPlainObject(policy.ruleset), 'delegationPolicy.ruleset must be an object');

  const ruleset = policy.ruleset;
  assert(
    Array.isArray(ruleset.roles) && ruleset.roles.length > 0,
    'delegationPolicy.ruleset.roles must be a non-empty array',
  );
  assert(
    Array.isArray(ruleset.capabilities),
    'delegationPolicy.ruleset.capabilities must be an array',
  );
  assert(
    (ALLOWED_DELEGATION_TARGETS as readonly string[]).includes(ruleset.delegationTarget as string),
    `delegationPolicy.ruleset.delegationTarget must be one of: ${ALLOWED_DELEGATION_TARGETS.join(', ')}`,
  );

  assert(isPlainObject(ruleset.overallConstraints), 'overallConstraints must be an object');
  const constraints: any = ruleset.overallConstraints;
  assert(
    Number.isInteger(constraints.maxDelegationDepth) &&
      constraints.maxDelegationDepth >= 0 &&
      constraints.maxDelegationDepth <= MAX_DELEGATION_DEPTH,
    `maxDelegationDepth must be an integer in [0, ${MAX_DELEGATION_DEPTH}]`,
  );
  assert(
    isPlainObject(constraints.delegatedCredentialLifetime),
    'delegatedCredentialLifetime must be an object',
  );
  const lifetime: any = constraints.delegatedCredentialLifetime;
  assert(
    Number.isInteger(lifetime.value) && lifetime.value > 0,
    'delegatedCredentialLifetime.value must be a positive integer',
  );
  assert(
    (ALLOWED_LIFETIME_UNITS as readonly string[]).includes(lifetime.unit),
    `delegatedCredentialLifetime.unit must be one of: ${ALLOWED_LIFETIME_UNITS.join(', ')}`,
  );

  const capabilitiesByName: Record<string, any> = {};
  for (const cap of ruleset.capabilities) {
    assert(
      !capabilitiesByName[cap.name],
      `duplicate capability name: ${cap.name}`,
    );
    assert(
      (ALLOWED_GRANT_TYPES as readonly string[]).includes(cap.schema?.type),
      `capability "${cap.name}" schema.type must be one of: ${ALLOWED_GRANT_TYPES.join(', ')}`,
    );
    capabilitiesByName[cap.name] = cap;
  }

  const rolesById: Record<string, Role> = {};
  let rootCount = 0;
  for (const role of ruleset.roles) {
    assert(!rolesById[role.roleId], `duplicate roleId: ${role.roleId}`);
    rolesById[role.roleId] = role;
    if (role.parentRoleId === null) rootCount++;
  }
  assert(rootCount === 1, `ruleset must have exactly one root role, found ${rootCount}`);

  for (const role of ruleset.roles) {
    if (role.parentRoleId !== null) {
      assert(
        rolesById[role.parentRoleId],
        `role ${role.roleId} references unknown parentRoleId ${role.parentRoleId}`,
      );
    }
  }

  for (const role of ruleset.roles) {
    for (const grant of role.capabilityGrants) {
      const cap = capabilitiesByName[grant.capability];
      assert(
        cap,
        `role ${role.roleId} grants unknown capability "${grant.capability}"`,
      );
      assert(
        (grant.schema as any)?.type === cap.schema.type,
        `role ${role.roleId} grant "${grant.capability}" schema.type must be "${cap.schema.type}"`,
      );
    }
  }

  for (const role of ruleset.roles) {
    const ancestors = getAncestorChain(role, rolesById);
    if (ancestors.length === 0) continue;

    const childGrants = getGrantsByCapability(role);

    for (const ancestor of ancestors) {
      const ancestorGrants = getGrantsByCapability(ancestor);

      for (const capName of Object.keys(childGrants)) {
        assert(
          ancestorGrants[capName],
          `role ${role.roleId} grants "${capName}" but ancestor ${ancestor.roleId} does not`,
        );
        assertGrantNarrows(
          childGrants[capName].schema,
          ancestorGrants[capName].schema,
          suffix => `role ${role.roleId} grant "${capName}" ${suffix}`,
        );
      }

      if (!isWildcardAttrs(ancestor.attributes) && !isWildcardAttrs(role.attributes)) {
        assert(
          isSubset(role.attributes, ancestor.attributes),
          `role ${role.roleId} attributes are not a subset of ancestor ${ancestor.roleId} attributes`,
        );
      }
    }
  }
}

/**
 * Assert that a delegation policy is a valid narrowing of a parent policy.
 *
 * Run after `validateDelegationPolicy(policy)` succeeds. The parent policy is
 * trusted to already be valid (it came from a credential we issued or accepted).
 */
export function assertPolicyConformsToParent(
  policy: DelegationPolicy,
  parentPolicy: DelegationPolicy,
  {
    delegationRole,
    remainingDepth,
  }: {delegationRole: string; remainingDepth: number},
) {
  assert(remainingDepth > 0, 'parent credential has no remaining delegation depth');

  const childConstraints = policy.ruleset.overallConstraints;
  const parentConstraints = parentPolicy.ruleset.overallConstraints;

  assert(
    childConstraints.maxDelegationDepth <= parentConstraints.maxDelegationDepth,
    `maxDelegationDepth ${childConstraints.maxDelegationDepth} exceeds parent ${parentConstraints.maxDelegationDepth}`,
  );

  const parentDays = lifetimeToDays(parentConstraints.delegatedCredentialLifetime);
  const childDays = lifetimeToDays(childConstraints.delegatedCredentialLifetime);
  if (parentDays > 0) {
    assert(
      childDays <= parentDays,
      `delegatedCredentialLifetime exceeds parent (${parentConstraints.delegatedCredentialLifetime.value} ${parentConstraints.delegatedCredentialLifetime.unit})`,
    );
  }

  const childRole = policy.ruleset.roles.find(r => r.roleId === delegationRole);
  assert(
    childRole,
    `delegationRole "${delegationRole}" not found in delegationPolicy.ruleset.roles`,
  );

  const parentRole = parentPolicy.ruleset.roles.find(r => r.roleId === delegationRole);
  assert(
    parentRole,
    `delegationRole "${delegationRole}" not found in parent credential's policy`,
  );

  if (!isWildcardAttrs(parentRole.attributes) && !isWildcardAttrs(childRole.attributes)) {
    assert(
      isSubset(childRole.attributes, parentRole.attributes),
      `delegationRole "${delegationRole}" attributes are not a subset of parent's attributes`,
    );
  }

  const parentGrants = getGrantsByCapability(parentRole);
  for (const grant of childRole.capabilityGrants) {
    const parentGrant = parentGrants[grant.capability];
    assert(
      parentGrant,
      `delegationRole "${delegationRole}" grants "${grant.capability}" which the parent does not`,
    );
    assertGrantNarrows(
      grant.schema,
      parentGrant.schema,
      suffix => `delegationRole "${delegationRole}" grant "${grant.capability}" ${suffix}`,
    );
  }
}
