import assert from 'assert';
import {DelegationPolicy, RoleNode, Role} from './delegation-types';

/**
 * Build a tree structure representing the roles in a delegation policy, based on their parent-child relationships
 * @param policy - The delegation policy containing the roles and their relationships
 * @returns A tree structure representing the roles in the delegation policy, where each node contains the role name, roleId, level in the hierarchy, and its children roles (if any)
 */
export function buildDelegationRoleTree(policy: DelegationPolicy): RoleNode {
  const root = policy.ruleset.roles.find(r => r.parentRoleId === null);
  assert(root, 'Delegation policy has no root role');

  const childrenByParent = new Map<string, Role[]>();
  for (const role of policy.ruleset.roles) {
    if (role.parentRoleId === null) continue;
    const siblings = childrenByParent.get(role.parentRoleId) ?? [];
    siblings.push(role);
    childrenByParent.set(role.parentRoleId, siblings);
  }

  const toNode = (role: Role, level: number): RoleNode => {
    const children = childrenByParent.get(role.roleId);
    const node: RoleNode = {level, ...role};
    if (children?.length) {
      node.children = children.map(c => toNode(c, level + 1));
    }
    return node;
  };

  return toNode(root, 1);
}

export function getRoleNodeById(
  roleId: string,
  node: RoleNode,
): RoleNode | null {
  if (node.roleId === roleId) return node;
  if (!node.children) return null;

  for (const child of node.children) {
    const result = getRoleNodeById(roleId, child);
    if (result) return result;
  }

  return null;
}

/**
 * Compute how many more times the holder of `roleId` may further delegate,
 * based on the policy's maxDelegationDepth and the holder's depth in the tree.
 * @param policy - The delegation policy
 * @param roleId - The roleId of the holder
 * @returns The remaining delegation depth, or null if the role is not in the policy
 */
export function getRemainingDelegationDepth(
  roleNode: RoleNode,
  policy: DelegationPolicy,
): number | null {
  return policy.ruleset.overallConstraints.maxDelegationDepth - roleNode.level;
}
