import assert from 'assert';
import {
  DelegationDetails,
  DelegationPolicy,
  Role,
  RoleNode,
} from './delegation-types';
import {delegationService} from '@docknetwork/wallet-sdk-wasm/src/services/delegation';
import {getDelegationChain} from './delegation-chain';
import {
  buildDelegationRoleTree,
  getRemainingDelegationDepth,
  getRoleNodeById,
} from './delegation-tree';

/**
 * Fetch the delegation policy for a given credential
 * @param credential - The credential containing the delegation policy ID
 * @returns A promise that resolves to the delegation policy for the given schema ID
 */
export async function fetchDelegationPolicyJson(
  credential,
): Promise<DelegationPolicy> {
  assert(
    credential.delegationPolicyId,
    'Credential does not contain a delegation policy ID',
  );
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

export function getRole(
  roleId: string,
  delegationPolicy: DelegationPolicy,
): Role {
  if (!delegationPolicy) return null;

  return delegationPolicy.ruleset.roles.find(r => r.roleId === roleId);
}

export function getDelegationOptions(roleTree: RoleNode): RoleNode[] {
  const roles: RoleNode[] = [];
  const traverse = (node: RoleNode) => {
    roles.push(node);
    node.children?.forEach(traverse);
  };

  roleTree.children?.forEach(traverse);

  return roles;
}

export async function getDelegationDetails(
  credential,
  wallet,
): Promise<DelegationDetails> {
  const delegationChain = await getDelegationChain(credential, wallet);
  const policy = await fetchDelegationPolicyJson(credential);
  const roleTree = buildDelegationRoleTree(policy);
  const role = getRoleNodeById(roleTree.roleId, roleTree);
  const delegationOptions = getDelegationOptions(roleTree);
  const remainingDelegationDepth = getRemainingDelegationDepth(role, policy);

  return {
    delegationPolicy: policy,
    roleTree,
    role,
    remainingDelegationDepth,
    delegatedBy: {
      role:
        delegationChain?.length > 0
          ? getRole(delegationChain[0]?.roleId, policy)
          : null,
      issuerName: credential?.issuer?.name,
      issuerDid: credential?.issuer?.id,
    },
    delegationOptions,
  };
}
