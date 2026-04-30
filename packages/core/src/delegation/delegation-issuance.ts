import assert from 'assert';
import {DelegationPolicy} from './delegation-types';
import {isDelegatableCredential} from './delegation-utils';
import {buildDelegationPolicyAttributes} from './delegation-policy';
import {delegationService} from '@docknetwork/wallet-sdk-wasm/src/services/delegation/service';
import {v4 as uuidv4} from 'uuid';

/**
 * Issue a delegatable credential
 *
 * @param credentialData
 * @param issuerKey
 * @param delegationPolicy
 * @param roleId
 * @param rootCredentialId
 */
export async function issueCredential(
  credentialData,
  issuerKey,
  delegationPolicy: DelegationPolicy,
  roleId,
  rootCredentialId?,
) {
  assert(
    isDelegatableCredential(credentialData),
    'Credential is not delegatable',
  );

  const recipientRole = delegationPolicy.ruleset.roles.find(
    role => role.roleId === roleId,
  );

  assert(recipientRole, `Role ${roleId} not found in ruleset`);

  const credentialId = credentialData.id || `urn:uuid:${uuidv4()}`;
  const credential = await delegationService.issueCredential(issuerKey, {
    ...credentialData,
    ...(await buildDelegationPolicyAttributes(delegationPolicy)),
    id: credentialId,
    roleId,
    rootCredentialId: rootCredentialId || credentialId,
  });

  return credential;
}
