import assert from 'assert';
import {v4 as uuid} from 'uuid';
import {logger} from '@docknetwork/wallet-sdk-data-store/src/logger';
import {getAllDIDs, getDefaultDID} from '../did-provider';
import {delegateCredential} from './delegation-issuance';
import {addDelegationChain, getDelegationChain} from './delegation-chain';
import {getDelegationDetails, getRole} from './delegation-policy';
import {isDelegatableCredential} from './delegation-utils';
import {
  assertPolicyConformsToParent,
  validateDelegationPolicy,
} from './delegation-policy-validation';

const GOAL_CODE = 'dock.offer-delegation';
const OOB_INVITATION = 'https://didcomm.org/out-of-band/2.0/invitation';
const REQUEST_CREDENTIAL =
  'https://didcomm.org/issue-credential/3.0/request-credential';
const ISSUE_CREDENTIAL =
  'https://didcomm.org/issue-credential/3.0/issue-credential';
const ACK = 'https://didcomm.org/issue-credential/3.0/ack';

function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

function pickDID(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

type DelegationOffer = {
  id: string;
  messageId?: string;
  issuerDID?: string;
  status: 'sent' | 'requested' | 'accepted' | 'rejected';
  expiresAt?: string;
  [key: string]: any;
};

export type DelegationOfferPreview = {
  id: string;
  issuerDID: string;
  issuerName?: string;
  role: string;
  roleLabel?: string;
  createdAt: string;
  expiresAt?: string;
};

const DEFAULT_OFFER_EXPIRATION_MS = 24 * 60 * 60 * 1000;

export async function createDelegationOffer({
  wallet,
  issuerDID,
  delegationPolicy,
  delegationRole,
  credentialId,
  expiresInMs = DEFAULT_OFFER_EXPIRATION_MS,
}: {
  wallet: any;
  issuerDID: string;
  delegationPolicy: any;
  delegationRole: string;
  credentialId?: string;
  expiresInMs?: number;
}) {
  validateDelegationPolicy(delegationPolicy);
  assert(
    delegationPolicy.ruleset.roles.some(r => r.roleId === delegationRole),
    `delegationRole "${delegationRole}" not found in delegationPolicy.ruleset.roles`,
  );

  if (credentialId) {
    const parentCredential = await wallet.getDocumentById(credentialId);
    if (parentCredential) {
      assert(
        isDelegatableCredential(parentCredential),
        `Credential ${credentialId} is not delegatable`,
      );
      const parentDetails = await getDelegationDetails(
        parentCredential,
        wallet,
      );
      if (parentDetails.delegationPolicy) {
        assertPolicyConformsToParent(
          delegationPolicy,
          parentDetails.delegationPolicy,
          {
            delegationRole,
            remainingDepth: parentDetails.remainingDelegationDepth,
            parentRoleId: parentDetails.role?.roleId,
          },
        );
      }
    }
  }

  const dids = await getAllDIDs({wallet});
  const issuer = dids.find(d => d.didDocument.id === issuerDID);
  const issuerName = issuer?.name;

  const offerId = uuid();
  const sentAt = new Date();
  const delegationOffer = {
    id: offerId,
    credentialId: credentialId,
    issuerDID,
    issuerName,
    issuer: {
      did: issuerDID,
    },
    to: undefined,
    delegationPolicy,
    delegationRole,
    capabilities: [],
    attributes: [],
    delegationConstraints: {},
    sentAt: sentAt.toISOString(),
    expiresAt: new Date(sentAt.getTime() + expiresInMs).toISOString(),
    updatedAt: null,
    status: 'sent',
  };

  // Persist on the issuer side so DELEGATION_REQUEST_HANDLER can look it up
  // when the holder replies with a credential request.
  await wallet.addDocument({
    type: 'DelegationOffer',
    ...delegationOffer,
  });

  return delegationOffer;
}

// OOB invitation (issuer → holder via QR/link)
export function createOOBInvitation(
  issuerDID,
  delegationOffer,
  {goal, issuerName}: {goal: string; issuerName?: string},
) {
  assert(!!goal, 'goal is required');

  const finalIssuerName = issuerName ?? delegationOffer.issuerName;

  const preview: DelegationOfferPreview = {
    id: delegationOffer.id,
    issuerDID: issuerDID,
    issuerName: finalIssuerName,
    role: delegationOffer.delegationRole,
    roleLabel: getRole(
      delegationOffer.delegationRole,
      delegationOffer.delegationPolicy,
    )?.label,
    createdAt: delegationOffer.sentAt,
    expiresAt: delegationOffer.expiresAt,
  };

  const delegationOfferMessage = {
    type: OOB_INVITATION,
    id: delegationOffer.id,
    from: issuerDID,
    body: {
      goal_code: GOAL_CODE,
      goal,
      offer_id: delegationOffer.id,
    },
    attachments: [
      {
        id: delegationOffer.id,
        media_type: 'application/json',
        data: {json: preview},
      },
    ],
  };

  const offerUrl =
    'didcomm://?_oob=' +
    base64urlEncode(JSON.stringify(delegationOfferMessage));

  return offerUrl;
}

// Decode an OOB invitation URL into a DIDComm message object.
// Returns the input unchanged if it's already an object.
export function decodeMessage(message) {
  if (typeof message !== 'string') {
    return message;
  }

  const oobPrefix = 'didcomm://?_oob=';
  if (!message.startsWith(oobPrefix)) {
    logger.debug('decodeMessage: unrecognized URL scheme, skipping');
    return null;
  }

  const encoded = message.slice(oobPrefix.length);
  try {
    return JSON.parse(base64urlDecode(encoded));
  } catch (err) {
    logger.error(`decodeMessage: failed to decode OOB payload: ${err}`);
    return null;
  }
}

export async function acceptDelegationOffer({
  delegationOffer,
  wallet,
  messageProvider,
}: {
  delegationOffer: DelegationOffer;
  wallet: any;
  messageProvider: any;
}) {
  const issuerDID = delegationOffer.issuerDID;
  const holderDID = await getDefaultDID({wallet});
  const dids = await getAllDIDs({wallet});
  const holderName = dids.find(d => d.didDocument.id === holderDID)?.name;

  const requestCredentialMessage = {
    type: REQUEST_CREDENTIAL,
    pthid: delegationOffer.messageId, // parent thread = the OOB invitation
    from: holderDID,
    to: issuerDID,
    body: {
      goal_code: GOAL_CODE,
      sender_profile: {name: holderName},
      offer_id: delegationOffer.id,
    },
  };

  await messageProvider.sendMessage(requestCredentialMessage);

  // Mirror issuer-side bookkeeping: mark the holder's stored offer as accepted.
  const storedOffer = await wallet.getDocumentById(delegationOffer.id);
  if (storedOffer) {
    await wallet.updateDocument({
      ...storedOffer,
      status: 'requested',
      updatedAt: new Date().toISOString(),
    });
  }
}

// Delegation message handlers
export const INVITATION_HANDLER = {
  check: function (message) {
    return (
      message.type === OOB_INVITATION && message.body?.goal_code === GOAL_CODE
    );
  },
  handle: async function (message, {wallet}) {
    const offerAttachment = message.attachments?.[0]?.data?.json ?? {};
    const delegationOffer: DelegationOffer = {
      ...offerAttachment,
      id: message.body.offer_id,
      messageId: message.id,
      issuerDID: message.from,
      status: 'sent',
    };

    await wallet.addDocument({
      type: 'DelegationOffer',
      ...delegationOffer,
    });

    logger.debug(
      `INVITATION_HANDLER: emitting delegationOfferReceived for offer ${delegationOffer.id}`,
    );
    wallet.eventManager.emit('delegationOfferReceived', delegationOffer);
  },
};

export const DELEGATION_REQUEST_HANDLER = {
  check: function (message) {
    return (
      message.type === REQUEST_CREDENTIAL &&
      message.body?.goal_code === GOAL_CODE
    );
  },
  handle: async function (message, {wallet, messageProvider}) {
    const offerId = message.body.offer_id;
    const delegationOffer = await wallet.getDocumentById(offerId);
    if (!delegationOffer) {
      logger.debug(
        `DELEGATION_REQUEST_HANDLER: no matching delegation offer found for request ${offerId}`,
      );
      return;
    }

    // Authorization checks: only the targeted holder (if any) may accept,
    // and the offer must still be in the 'sent' state to prevent replay.
    if (delegationOffer.status !== 'sent') {
      logger.warn(
        `DELEGATION_REQUEST_HANDLER: rejecting request for offer ${offerId} — already ${delegationOffer.status}`,
      );
      return;
    }

    if (delegationOffer.to) {
      const targets = Array.isArray(delegationOffer.to)
        ? delegationOffer.to
        : [delegationOffer.to];
      if (!targets.includes(message.from)) {
        logger.warn(
          `DELEGATION_REQUEST_HANDLER: rejecting request for offer ${offerId} — sender does not match offer.to`,
        );
        return;
      }
    }

    if (
      delegationOffer.expiresAt &&
      new Date(delegationOffer.expiresAt) < new Date()
    ) {
      logger.debug(
        `DELEGATION_REQUEST_HANDLER: rejecting expired offer ${offerId}`,
      );
      return;
    }

    const parentCredential = await wallet.getDocumentById(
      delegationOffer.credentialId,
    );

    try {
      validateDelegationPolicy(delegationOffer.delegationPolicy);
      if (parentCredential && isDelegatableCredential(parentCredential)) {
        const parentDetails = await getDelegationDetails(
          parentCredential,
          wallet,
        );
        if (parentDetails.delegationPolicy) {
          assertPolicyConformsToParent(
            delegationOffer.delegationPolicy,
            parentDetails.delegationPolicy,
            {
              delegationRole: delegationOffer.delegationRole,
              remainingDepth: parentDetails.remainingDelegationDepth,
              parentRoleId: parentDetails.role?.roleId,
            },
          );
        }
      }
    } catch (err: any) {
      logger.warn(
        `DELEGATION_REQUEST_HANDLER: rejecting offer ${offerId} — policy validation failed: ${err.message}`,
      );
      return;
    }

    const holderDID = message.from;

    delegationOffer.status = 'accepted';
    delegationOffer.holderDID = holderDID;
    delegationOffer.updatedAt = new Date().toISOString();

    const issuerDID = pickDID(message.to);

    const delegatedCredential = await delegateCredential({
      credential: parentCredential,
      wallet,
      delegationPolicy: delegationOffer.delegationPolicy,
      delegationRoleId: delegationOffer.delegationRole,
      delegatorDID: delegationOffer.issuerDID || issuerDID,
      revocationContext: {
        wallet,
        truveraApiConfigs: wallet.dataStore.configs?.truveraApi,
        issuerDID: delegationOffer.issuerDID || issuerDID,
      },
    });

    delegationOffer.credentialStatus = delegatedCredential.credentialStatus;
    delegationOffer.credentialId = delegatedCredential.id;

    await wallet.updateDocument(delegationOffer);

    const delegationChain = await getDelegationChain(parentCredential, wallet);

    await messageProvider.sendMessage({
      type: ISSUE_CREDENTIAL,
      from: issuerDID,
      to: holderDID,
      message: {
        goal_code: GOAL_CODE,
        delegationOfferId: delegationOffer.id,
        credentials: [delegatedCredential],
        delegationChain,
      },
    });
  },
};

export const ISSUE_CREDENTIAL_HANDLER = {
  check: function (message) {
    return (
      message.type === ISSUE_CREDENTIAL && message.body?.goal_code === GOAL_CODE
    );
  },
  handle: async function (message, {wallet, messageProvider}) {
    const offerId = message.body.delegationOfferId;

    if (!offerId) {
      logger.debug(
        'ISSUE_CREDENTIAL_HANDLER: missing delegationOfferId in message body',
      );
      return;
    }

    const storedOffer = await wallet.getDocumentById(offerId);
    if (!storedOffer) {
      logger.debug(
        `ISSUE_CREDENTIAL_HANDLER: no stored offer found for ${offerId}`,
      );
      return;
    }

    // SECURITY: only accept credentials from the DID that originally made the offer
    if (message.from !== storedOffer.issuerDID) {
      logger.debug(
        `ISSUE_CREDENTIAL_HANDLER: rejecting credential for offer ${offerId} — sender ${message.from} does not match stored issuerDID ${storedOffer.issuerDID}`,
      );
      return;
    }

    const credentials = message.body.credentials ?? [];
    const delegationChain = message.body.delegationChain ?? [];

    if (credentials.length === 0) {
      logger.debug(
        `ISSUE_CREDENTIAL_HANDLER: no credentials in message for offer ${offerId}`,
      );
      return;
    }

    for (const credential of credentials) {
      await wallet.addDocument(credential);
    }

    const [delegatedCredential] = credentials;
    const existingChain = await wallet.getDocumentById(
      `${delegatedCredential.id}#delegationChain`,
    );
    if (!existingChain) {
      await addDelegationChain(delegatedCredential, delegationChain, wallet);
    }

    await wallet.updateDocument({
      ...storedOffer,
      status: 'accepted',
      updatedAt: new Date().toISOString(),
    });

    const holderDID = pickDID(message.to);
    const issuerDID = message.from;

    await messageProvider.sendMessage({
      type: ACK,
      from: holderDID,
      to: issuerDID,
      pthid: message.id,
      body: {
        goal_code: GOAL_CODE,
        delegationOfferId: offerId,
        status: 'OK',
      },
    });

    wallet.eventManager.emit('delegatedCredentialReceived', {
      delegationOfferId: offerId,
      credentials,
      delegationChain,
    });
  },
};

export const DELEGATION_ACK_HANDLER = {
  check: function (message) {
    return message.type === ACK && message.body?.goal_code === GOAL_CODE;
  },
  handle: async function (message, {wallet}) {
    const offerId = message.body.delegationOfferId;

    const storedOffer = await wallet.getDocumentById(offerId);
    if (!storedOffer) {
      logger.debug(
        `DELEGATION_ACK_HANDLER: no stored offer found for ${offerId}`,
      );
      return;
    }

    storedOffer.status = 'accepted';
    storedOffer.updatedAt = new Date().toISOString();

    await wallet.updateDocument(storedOffer);

    logger.debug(
      `DELEGATION_ACK_HANDLER: delegation offer ${offerId} marked as accepted`,
    );
  },
};

export const messageHandlers = [
  INVITATION_HANDLER,
  DELEGATION_REQUEST_HANDLER,
  ISSUE_CREDENTIAL_HANDLER,
  DELEGATION_ACK_HANDLER,
];

export async function handleMessage(
  message,
  context: {
    wallet: any;
    messageProvider: any;
  },
) {
  const decoded = decodeMessage(message);
  if (!decoded) {
    logger.debug('handleMessage: message could not be decoded, skipping');
    return;
  }

  const handler = messageHandlers.find(h => h.check(decoded));
  if (!handler) {
    logger.debug(
      `handleMessage: no handler matched message type ${decoded.type}`,
    );
    return;
  }

  return handler.handle(decoded, context);
}
