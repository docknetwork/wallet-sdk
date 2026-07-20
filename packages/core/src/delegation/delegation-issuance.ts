import assert from 'assert';
import {DelegationPolicy} from './delegation-types';
import {isDelegatableCredential} from './delegation-utils';
import {buildDelegationPolicyAttributes} from './delegation-policy';
import {delegationService} from '@docknetwork/wallet-sdk-wasm/src/services/delegation';
import {v4 as uuidv4} from 'uuid';
import {getAllDIDs, getDIDKeyPair} from '../did-provider';
import {
  allocateStatusEntry,
  RevocationContext,
  STATUS_LIST_2021_CONTEXT,
} from './delegation-revocation';

/**
 * Issue a delegatable credential
 *
 * @param credentialData
 * @param issuerKey
 * @param delegationPolicy
 * @param delegationRoleId
 * @param rootCredentialId
 * @param revocationContext when provided, a StatusList2021Entry is allocated and
 *   embedded automatically so the credential can be revoked later. The wallet's
 *   revocation registry index counter is advanced and persisted as a side effect.
 */
export async function issueCredential(
  credentialData,
  issuerKey,
  delegationPolicy: DelegationPolicy,
  delegationRoleId,
  rootCredentialId?,
  revocationContext?: RevocationContext,
) {
  assert(
    isDelegatableCredential(credentialData),
    'Credential is not delegatable',
  );

  const recipientRole = delegationPolicy.ruleset.roles.find(
    role => role.roleId === delegationRoleId,
  );

  assert(recipientRole, `Role ${delegationRoleId} not found in ruleset`);

  const credentialStatus = revocationContext
    ? (await allocateStatusEntry(revocationContext)).credentialStatus
    : credentialData.credentialStatus;

  const context =
    credentialStatus &&
    Array.isArray(credentialData['@context']) &&
    !credentialData['@context'].includes(STATUS_LIST_2021_CONTEXT)
      ? [...credentialData['@context'], STATUS_LIST_2021_CONTEXT]
      : credentialData['@context'];

  const credentialId = credentialData.id || `urn:uuid:${uuidv4()}`;
  const credential = await delegationService.issueCredential(issuerKey, {
    ...credentialData,
    ...(await buildDelegationPolicyAttributes(delegationPolicy)),
    ...(credentialStatus ? {credentialStatus, '@context': context} : {}),
    id: credentialId,
    delegationRoleId,
    rootCredentialId: rootCredentialId || credentialId,
  });

  return credential;
}

export async function delegateCredential({
  credential,
  wallet,
  delegationPolicy,
  delegationRoleId,
  delegatorDID,
}: {
  credential: any;
  wallet: any;
  delegationPolicy: DelegationPolicy;
  delegationRoleId: string;
  delegatorDID: string;
}) {
  assert(isDelegatableCredential(credential), 'Credential is not delegatable');
  assert(!!delegatorDID, 'delegatorDID is required');

  const allDIDs = await getAllDIDs({wallet});
  const issuerDID = allDIDs.find(d => d.didDocument.id === delegatorDID);
  assert(!!issuerDID, `delegatorDID ${delegatorDID} not found in wallet`);

  const keyPair = await getDIDKeyPair(wallet, issuerDID);

  const credentialData = {
    ...(await buildDelegationPolicyAttributes(delegationPolicy)),
    '@context': credential['@context'],
    id: `urn:uuid:${uuidv4()}`,
    delegationRoleId,
    rootCredentialId: credential.rootCredentialId || credential.id,
    type: credential.type,
    issuer: {
      id: issuerDID.didDocument.id,
      name: issuerDID.name,
    },
    issuanceDate: new Date().toISOString(),
    credentialSubject: credential.credentialSubject,
  };

  return issueCredential(
    credentialData,
    keyPair,
    delegationPolicy,
    delegationRoleId,
    credential.rootCredentialId || credential.id,
  );
}
