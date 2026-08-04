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
import {
  ISSUE_CREDENTIAL,
  OFFER_GOAL_CODE,
  PROPOSE_CREDENTIAL,
  REQUEST_GOAL_CODE,
} from './delegation-constants';

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
 * Delegatee side: validate and persist a DelegationRequest document.
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

  // issuerDID = delegatorDID so the ISSUE_CREDENTIAL_HANDLER sender check passes
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
    // Ruleset arrays are sets — sort so order doesn't affect comparison
    return value.map(sortKeysDeep).sort((a, b) => {
      const sa = JSON.stringify(a);
      const sb = JSON.stringify(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
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
 * Canonical deep-equality of two rulesets — key and array ordering don't
 * affect the match.
 */
export function rulesetMatches(a: any, b: any): boolean {
  return JSON.stringify(sortKeysDeep(a)) === JSON.stringify(sortKeysDeep(b));
}

/**
 * Matcher checks for one credential against a request. Returns delegation
 * details on match, throws with the reason otherwise.
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
 * Delegator side: re-validate, issue the delegated credential and send it to
 * the requester.
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

    // The UI may pass any credentialId — re-run the matcher checks
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

    const delegationChain = await getDelegationChain(credential, wallet);

    // Send before committing 'accepted' so a delivery failure ends 'failed'.
    // delegationOfferId = request.id routes into the existing offer handlers.
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
 * Delegator side: silent rejection — no message sent.
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
 * Delegator side: handles incoming delegation request messages and emits
 * 'delegationRequestReceived' with matching credentials.
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
    if (!request || typeof request.id !== 'string') {
      logger.debug(
        'DELEGATION_PROPOSAL_HANDLER: missing or invalid delegation_request in message body',
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
    // request.id is requester-controlled — never let another sender overwrite
    // an existing request
    if (existing && existing.requesterDID !== message.from) {
      logger.warn(
        `DELEGATION_PROPOSAL_HANDLER: ignoring request ${request.id} — sender does not match stored requesterDID`,
      );
      return;
    }

    // expiresAt is requester-controlled — clamp it on the delegator side
    const maxExpiresAt = new Date(Date.now() + DEFAULT_REQUEST_EXPIRATION_MS);
    const requestedExpiresAt = new Date(request.expiresAt);
    if (
      isNaN(requestedExpiresAt.getTime()) ||
      requestedExpiresAt > maxExpiresAt
    ) {
      request.expiresAt = maxExpiresAt.toISOString();
    }

    if (new Date(request.expiresAt) < new Date()) {
      logger.debug(
        `DELEGATION_PROPOSAL_HANDLER: ignoring expired request ${request.id}`,
      );
      return;
    }

    // Trust the transport sender over the self-reported requesterDID
    request.requesterDID = message.from;

    // Only accept requests addressed to a DID this wallet owns
    const dids = await getAllDIDs({wallet});
    if (!dids.some(d => d.didDocument.id === request.delegatorDID)) {
      logger.debug(
        `DELEGATION_PROPOSAL_HANDLER: ignoring request ${request.id} — delegatorDID ${request.delegatorDID} is not owned by this wallet`,
      );
      return;
    }

    const delegationRequest: DelegationRequest = {
      ...request,
      status: 'pending',
    };

    if (!existing) {
      await wallet.addDocument({
        type: 'DelegationRequest',
        ...delegationRequest,
      });
    } else {
      // Same-sender re-send: refresh the stored fields
      await wallet.updateDocument({
        ...existing,
        ...delegationRequest,
        updatedAt: new Date().toISOString(),
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
