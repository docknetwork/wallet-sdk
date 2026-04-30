import assert from 'assert';
import {DelegationPolicy} from './delegation-types';
import {delegationService} from '@docknetwork/wallet-sdk-wasm/src/services/delegation/service';

/**
 * Fetch the delegation policy for a given credential
 * @param credential - The credential containing the delegation policy ID
 * @returns A promise that resolves to the delegation policy for the given schema ID
 */
export async function fetchDelegationPolicyJson(
  credential,
): Promise<DelegationPolicy[]> {
  return delegationService.fetchDelegationPolicyJson(
    credential.delegationPolicyId,
  );
}

/**
 * Build delegation policy attributes
 * This is needed when issuing a delegatable credential, so that we can include the delegation policy ID and digest in the credential attributes
 * @param delegationPolicy
 * @returns An object containing the delegation policy ID and digest to be included in the credential attributes
 */
export async function buildDelegationPolicyAttributes(
  delegationPolicy: DelegationPolicy | DelegationPolicy[],
) {
  return {
    delegationPolicyId: `data:application/json,${encodeURIComponent(
      JSON.stringify(delegationPolicy),
    )}`,
    delegationPolicyDigest: await delegationService.computePolicyDigestHex(
      delegationPolicy,
    ),
  };
}

type RoleNode = {
  name: string;
  level: number;
  children?: RoleNode[];
};

/**
 * Build a tree structure representing the roles in a delegation policy, based on their parent-child relationships
 * @param policy - The delegation policy containing the roles and their relationships
 * @returns A tree structure representing the roles in the delegation policy, where each node contains the role name, level in the hierarchy, and its children roles (if any)
 */
export function buildDelegationRoleTree(policy: DelegationPolicy): RoleNode {
  const root = policy.ruleset.roles.find(r => r.parentRoleId === null);
  assert(root, 'Delegation policy has no root role');

  const childrenByParent = new Map<string, any[]>();
  for (const role of policy.ruleset.roles) {
    if (role.parentRoleId === null) continue;
    const siblings = childrenByParent.get(role.parentRoleId) ?? [];
    siblings.push(role);
    childrenByParent.set(role.parentRoleId, siblings);
  }

  const toNode = (role, level: number): RoleNode => {
    const children = childrenByParent.get(role.roleId);
    const node: RoleNode = {name: role.label, level};
    if (children?.length) {
      node.children = children.map(c => toNode(c, level + 1));
    }
    return node;
  };

  return toNode(root, 1);
}
