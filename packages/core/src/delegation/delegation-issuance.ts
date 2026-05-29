import assert from 'assert';
import {DelegationPolicy} from './delegation-types';
import {isDelegatableCredential} from './delegation-utils';
import {buildDelegationPolicyAttributes} from './delegation-policy';
import {delegationService} from '@docknetwork/wallet-sdk-wasm/src/services/delegation';
import {v4 as uuidv4} from 'uuid';
import { getAllDIDs, getDefaultDID, getDIDKeyPair } from '../did-provider';

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

export async function delegateCredential({
  credential,
  wallet,
  delegationPolicy,
  roleId,
}) {
  assert(isDelegatableCredential(credential), 'Credential is not delegatable');

  const [issuerDID] = await getAllDIDs({wallet});
  const keyPair = await getDIDKeyPair(wallet, issuerDID);

  // get credential data from the original credential, excluding delegation metadata
  const credentialData = {
    ...(await buildDelegationPolicyAttributes(delegationPolicy)),
    '@context': credential['@context'],
    id: `urn:uuid:${uuidv4()}`,
    roleId: roleId,
    rootCredentialId: credential.rootCredentialId || credential.id,
    type: credential.type,
    issuer: {
      id: issuerDID.didDocument.id,
      name: issuerDID.name,
    },
    issuanceDate: new Date().toISOString(),
    credentialSubject: credential.credentialSubject,
  };

  const delegationCredential = await issueCredential(
    credentialData,
    keyPair,
    delegationPolicy,
    roleId,
    credential.rootCredentialId || credential.id,
  );

  console.log('[delegateCredential] delegating credential with data:', credentialData);
  
  return delegationCredential;
  // define issuer
}