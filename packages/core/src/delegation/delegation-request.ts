import assert from 'assert';
import {v4 as uuid} from 'uuid';
import {logger} from '@docknetwork/wallet-sdk-data-store/src/logger';
import {getAllDIDs} from '../did-provider';
import {delegateCredential} from './delegation-issuance';
import {getDelegationChain} from './delegation-chain';
import {getDelegationDetails} from './delegation-policy';
import {isDelegatableCredential} from './delegation-utils';
import {
  assertPolicyConformsToParent,
  validateDelegationPolicy,
} from './delegation-policy-validation';
import {DelegationPolicy} from './delegation-types';

export const REQUEST_GOAL_CODE = 'dock.request-delegation';
export const PROPOSE_CREDENTIAL =
  'https://didcomm.org/issue-credential/3.0/propose-credential';
// The issuance leg reuses the offer flow's goal code so the existing
// delegatee-side handlers (ISSUE_CREDENTIAL_HANDLER / DELEGATION_ACK_HANDLER)
// pick it up. Defined locally to avoid a circular import with delegation-offer.
const OFFER_GOAL_CODE = 'dock.offer-delegation';
const ISSUE_CREDENTIAL =
  'https://didcomm.org/issue-credential/3.0/issue-credential';

const DEFAULT_REQUEST_EXPIRATION_MS = 24 * 60 * 60 * 1000;

export type DelegationRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'failed'
  | 'expired';

export type DelegationRequest = {
  id: string;
  requesterDID: string;
  requesterName?: string;
  delegatorDID: string;
  delegationPolicy: DelegationPolicy;
  delegationRole: string;
  message?: string;
  createdAt: string;
  expiresAt?: string;
  updatedAt?: string | null;
  status: DelegationRequestStatus;
};

/**
 * Delegatee side: validate the requested policy/role and persist a
 * DelegationRequest document. Stored with issuerDID = delegatorDID so the
 * existing ISSUE_CREDENTIAL_HANDLER sender check applies when the delegated
 * credential arrives.
 */
export async function createDelegationRequest({
  wallet,
  requesterDID,
  delegatorDID,
  delegationPolicy,
  delegationRole,
  message,
  expiresInMs = DEFAULT_REQUEST_EXPIRATION_MS,
}: {
  wallet: any;
  requesterDID: string;
  delegatorDID: string;
  delegationPolicy: DelegationPolicy;
  delegationRole: string;
  message?: string;
  expiresInMs?: number;
}): Promise<DelegationRequest> {
  validateDelegationPolicy(delegationPolicy);
  assert(
    delegationPolicy.ruleset.roles.some(r => r.roleId === delegationRole),
    `delegationRole "${delegationRole}" not found in delegationPolicy.ruleset.roles`,
  );

  const dids = await getAllDIDs({wallet});
  const requesterName = dids.find(d => d.didDocument.id === requesterDID)?.name;

  const createdAt = new Date();
  const delegationRequest: DelegationRequest = {
    id: uuid(),
    requesterDID,
    requesterName,
    delegatorDID,
    delegationPolicy,
    delegationRole,
    message,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + expiresInMs).toISOString(),
    updatedAt: null,
    status: 'pending',
  };

  // issuerDID = delegatorDID so the existing ISSUE_CREDENTIAL_HANDLER sender
  // check (message.from === storedDoc.issuerDID) passes when the delegated
  // credential arrives.
  await wallet.addDocument({
    type: 'DelegationRequest',
    issuerDID: delegatorDID,
    ...delegationRequest,
  });

  return delegationRequest;
}

/**
 * Delegatee side: send the propose-credential DIDComm message to the delegator.
 */
export async function sendDelegationRequest({
  delegationRequest,
  messageProvider,
}: {
  delegationRequest: DelegationRequest;
  wallet: any;
  messageProvider: any;
}): Promise<void> {
  await messageProvider.sendMessage({
    type: PROPOSE_CREDENTIAL,
    from: delegationRequest.requesterDID,
    to: delegationRequest.delegatorDID,
    body: {
      goal_code: REQUEST_GOAL_CODE,
      delegation_request: delegationRequest,
    },
  });
}

function sortKeysDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {} as any);
  }
  return value;
}

/**
 * Canonical deep-equality of two ruleset objects: JSON.stringify with
 * recursively sorted object keys. Envelope fields (id, createdAt, name) are
 * ignored by construction — they are not part of the ruleset.
 * Exported for unit tests.
 */
export function rulesetMatches(a: any, b: any): boolean {
  return JSON.stringify(sortKeysDeep(a)) === JSON.stringify(sortKeysDeep(b));
}

/**
 * Run the matcher checks for a single credential against a request. Returns
 * the resolved delegation details when the credential can fulfill the
 * request; throws with the reason otherwise. Shared by
 * findCredentialsForDelegationRequest (skip on throw) and
 * approveDelegationRequest (fail on throw).
 */
async function resolveMatchingDelegationDetails(
  credential: any,
  delegationRequest: DelegationRequest,
  wallet: any,
): Promise<any> {
  assert(
    isDelegatableCredential(credential),
    `Credential ${credential.id} is not delegatable`,
  );

  const requestedRole = delegationRequest.delegationRole;
  const details = await getDelegationDetails(credential, wallet);

  if (
    !rulesetMatches(
      details.delegationPolicy?.ruleset,
      delegationRequest.delegationPolicy.ruleset,
    )
  ) {
    throw new Error('ruleset does not match');
  }

  const roleReachable =
    details.role?.roleId === requestedRole ||
    details.delegationOptions?.some(r => r.roleId === requestedRole);
  if (!roleReachable) {
    throw new Error(
      `requested role ${requestedRole} not reachable from credential role ${details.role?.roleId}`,
    );
  }

  assertPolicyConformsToParent(
    delegationRequest.delegationPolicy,
    details.delegationPolicy,
    {
      delegationRole: requestedRole,
      remainingDepth: details.remainingDelegationDepth,
      parentRoleId: details.role?.roleId,
    },
  );

  return details;
}

/**
 * Delegator side: return wallet credentials that can fulfill the request.
 * Content-based match: ruleset deep-equality (policy ids never match across
 * wallets — they are data: URIs embedding the whole policy), requested role
 * reachable from the credential's role, and policy conformance checks.
 */
export async function findCredentialsForDelegationRequest(
  delegationRequest: DelegationRequest,
  wallet: any,
): Promise<any[]> {
  const credentials = await wallet.getDocumentsByType('VerifiableCredential');
  const matches = [];

  for (const credential of credentials) {
    if (!isDelegatableCredential(credential)) {
      continue;
    }

    try {
      await resolveMatchingDelegationDetails(
        credential,
        delegationRequest,
        wallet,
      );
      matches.push(credential);
    } catch (err: any) {
      logger.debug(
        `findCredentialsForDelegationRequest: skipping ${credential.id} — ${err.message}`,
      );
    }
  }

  return matches;
}

/**
 * Delegator side: re-validate, issue the delegated credential from
 * credentialId and send it to the requester. Converges with the offer flow's
 * issuance leg (delegationOfferId = request.id).
 */
export async function approveDelegationRequest({
  delegationRequest,
  credentialId,
  wallet,
  messageProvider,
}: {
  delegationRequest: DelegationRequest;
  credentialId: string;
  wallet: any;
  messageProvider: any;
}): Promise<void> {
  const storedRequest = await wallet.getDocumentById(delegationRequest.id);
  assert(
    !!storedRequest,
    `DelegationRequest ${delegationRequest.id} not found`,
  );
  assert(
    storedRequest.status === 'pending',
    `DelegationRequest ${delegationRequest.id} is ${storedRequest.status}, expected pending`,
  );
  assert(
    !storedRequest.expiresAt || new Date(storedRequest.expiresAt) >= new Date(),
    `DelegationRequest ${delegationRequest.id} is expired`,
  );

  try {
    const credential = await wallet.getDocumentById(credentialId);
    assert(!!credential, `Credential ${credentialId} not found`);

    // Defense in depth: the UI may pass any credentialId — re-run the matcher
    // checks against this specific credential. Uses the DELEGATOR's resolved
    // policy from the credential, not the request's self-reported copy.
    const details = await resolveMatchingDelegationDetails(
      credential,
      storedRequest,
      wallet,
    );

    const delegatorDID = storedRequest.delegatorDID;

    const delegatedCredential = await delegateCredential({
      credential,
      wallet,
      delegationPolicy: details.delegationPolicy,
      delegationRoleId: storedRequest.delegationRole,
      delegatorDID,
      revocationContext: {
        wallet,
        truveraApiConfigs: wallet.dataStore.configs?.truveraApi,
        issuerDID: delegatorDID,
      },
    });

    await wallet.updateDocument({
      ...storedRequest,
      status: 'accepted',
      holderDID: storedRequest.requesterDID,
      revocationData: {
        credentialStatus: delegatedCredential.credentialStatus,
        credentialId: delegatedCredential.id,
      },
      updatedAt: new Date().toISOString(),
    });

    const delegationChain = await getDelegationChain(credential, wallet);

    // delegationOfferId = request.id routes the issuance into the existing
    // delegatee-side offer handlers with zero new code.
    await messageProvider.sendMessage({
      type: ISSUE_CREDENTIAL,
      from: delegatorDID,
      to: storedRequest.requesterDID,
      message: {
        goal_code: OFFER_GOAL_CODE,
        delegationOfferId: storedRequest.id,
        credentials: [delegatedCredential],
        delegationChain,
      },
    });
  } catch (error: any) {
    logger.warn(
      `approveDelegationRequest: failed to approve request ${delegationRequest.id}: ${error.message}`,
    );
    await wallet.updateDocument({
      ...storedRequest,
      status: 'failed',
      updatedAt: new Date().toISOString(),
    });
    wallet.eventManager.emit('delegationRequestFailed', {
      delegationRequestId: delegationRequest.id,
      error,
    });
    throw error;
  }
}

/**
 * Delegator side: silent rejection — local status update only, no message.
 */
export async function rejectDelegationRequest({
  delegationRequest,
  wallet,
}: {
  delegationRequest: DelegationRequest;
  wallet: any;
}): Promise<void> {
  const storedRequest = await wallet.getDocumentById(delegationRequest.id);
  assert(
    !!storedRequest,
    `DelegationRequest ${delegationRequest.id} not found`,
  );
  await wallet.updateDocument({
    ...storedRequest,
    status: 'rejected',
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delegator side: handles incoming delegation request messages. Stores the
 * DelegationRequest document, finds matching credentials and emits
 * 'delegationRequestReceived' with {delegationRequest, matchingCredentials}.
 * Emits 'delegationRequestFailed' with {delegationRequestId, error} on errors.
 */
export const DELEGATION_PROPOSAL_HANDLER = {
  check: function (message) {
    return (
      message.type === PROPOSE_CREDENTIAL &&
      message.body?.goal_code === REQUEST_GOAL_CODE
    );
  },
  handle: async function (
    message,
    {wallet}: {wallet: any; messageProvider: any},
  ) {
    const request = message.body?.delegation_request;
    if (!request) {
      logger.debug(
        'DELEGATION_PROPOSAL_HANDLER: missing delegation_request in message body',
      );
      return;
    }

    const existing = await wallet.getDocumentById(request.id);
    if (existing && existing.status !== 'pending') {
      logger.warn(
        `DELEGATION_PROPOSAL_HANDLER: ignoring request ${request.id} — already ${existing.status}`,
      );
      return;
    }

    if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
      logger.debug(
        `DELEGATION_PROPOSAL_HANDLER: ignoring expired request ${request.id}`,
      );
      return;
    }

    // SECURITY: trust the transport sender over the self-reported requesterDID.
    request.requesterDID = message.from;

    const delegationRequest: DelegationRequest = {
      ...request,
      status: 'pending',
    };

    if (!existing) {
      await wallet.addDocument({
        type: 'DelegationRequest',
        ...delegationRequest,
      });
    }

    let matchingCredentials;
    try {
      matchingCredentials = await findCredentialsForDelegationRequest(
        delegationRequest,
        wallet,
      );
    } catch (error: any) {
      logger.warn(
        `DELEGATION_PROPOSAL_HANDLER: failed to find matching credentials for request ${request.id}: ${error.message}`,
      );
      wallet.eventManager.emit('delegationRequestFailed', {
        delegationRequestId: request.id,
        error,
      });
      return;
    }

    wallet.eventManager.emit('delegationRequestReceived', {
      delegationRequest,
      matchingCredentials,
    });
  },
};
