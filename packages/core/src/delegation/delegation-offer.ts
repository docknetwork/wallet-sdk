import {v4 as uuid} from 'uuid';
import {getAllDIDs, getDefaultDID} from '../did-provider';
import { delegateCredential, issueCredential } from './delegation-issuance';
import { getDelegationChain } from './delegation-chain';

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

type CapabilityPreview = {
  name: string;
  value: string;
};

// Simplified preview of a delegation offer, used for display in the wallet UI
type DelegationOfferPreview = {
  id: string;
  issuer: {
    did: string;
    name: string;
  };
  createdAt: string;
  role: string;
  expirationDate: string;
  capabilities: CapabilityPreview[];
  attributes: string[];
};

type DelegationOffer = {
  id: string;
  messageId?: string;
  issuerDID?: string;
  status: 'sent' | 'accepted' | 'rejected';
  [key: string]: any;
};

export async function createDelegationOffer(walletClient, {
  delegationPolicy,
  delegationRole,
  credentialId,
}: {
  delegationPolicy: any;
  delegationRole: string;
  credentialId?: string;
}) {
  // TODO: Check if credential is delegatable

  const offerId = uuid();
  const delegationOffer = {
    id: offerId,
    credentialId: credentialId,
    issuerDID: walletClient.did,
    issuer: {
      did: walletClient.did,
    },
    to: undefined,
    delegationPolicy,
    delegationRole,
    capabilities: [],
    attributes: [],
    delegationConstraints: {},
    sentAt: new Date().toISOString(),
    updatedAt: null,
    status: 'sent',
  };

  // Persist on the issuer side so DELEGATION_REQUEST_HANDLER can look it up
  // when the holder replies with a credential request.
  await walletClient.wallet.addDocument({
    type: 'DelegationOffer',
    ...delegationOffer,
  });

  return delegationOffer;
}

// OOB invitation (issuer → holder via QR/link)
export function createOOBInvitation(issuerDID, delegationOffer) {
  const delegationOfferMessage = {
    type: OOB_INVITATION,
    id: delegationOffer.id,
    from: issuerDID,
    body: {
      goal_code: GOAL_CODE,
      goal: 'Acme is offering you a delegation',
      offer_id: delegationOffer.id,
    },
    attachments: [
      {
        id: delegationOffer.id,
        media_type: 'application/json',
        // TODO: create delegation offer preview
        data: {json: delegationOffer},
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
    console.log('[decodeMessage] unrecognized URL scheme, skipping');
    return null;
  }

  const encoded = message.slice(oobPrefix.length);
  try {
    return JSON.parse(base64urlDecode(encoded));
  } catch (err) {
    console.log('[decodeMessage] failed to decode OOB payload:', err);
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
  const holderName = await getAllDIDs({wallet}).then(
    dids => dids.find(d => d.didDocument.id === holderDID)?.name,
  );

  console.log('[holder] accepting delegation offer:', {
    issuerDID,
    holderDID,
    holderName,
  });

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

  console.log(
    '[holder] sending delegation request to issuer:',
    requestCredentialMessage,
  );

  await messageProvider.sendMessage(requestCredentialMessage);
}

// Delegation message handlers
export const INVITATION_HANDLER = {
  check: function (message) {
    return (
      message.type === OOB_INVITATION && message.body?.goal_code === GOAL_CODE
    );
  },
  handle: async function (
    message,
    {
      // context
      messageProvider,
      wallet,
    },
  ) {
    console.log('[INVITATION_HANDLER] handling message:', message);

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

    console.log(
      '[INVITATION_HANDLER] emitting delegationOfferReceived for offer:',
      delegationOffer.id,
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
    console.log('[DELEGATION_REQUEST_HANDLER] handling message:', message);

    const offerId = message.body.offer_id;
    const delegationOffer = await wallet.getDocumentById(offerId);
    if (!delegationOffer) {
      console.log(
        '[DELEGATION_REQUEST_HANDLER] no matching delegation offer found for request:',
        offerId,
      );
      return;
    }

    const holderDID = message.from;

    // update delegation offer status to accepted and add holder DID
    delegationOffer.status = 'accepted';
    delegationOffer.holderDID = holderDID;
    delegationOffer.updatedAt = new Date().toISOString();

    await wallet.updateDocument(delegationOffer);

    const parentCredential = await wallet.getDocumentById(
      delegationOffer.credentialId,
    );

    const delegatedCredential = await delegateCredential({
      credential: parentCredential,
      wallet,
      delegationPolicy: delegationOffer.delegationPolicy,
      roleId: delegationOffer.delegationRole,
    });

    const delegationChain = await getDelegationChain(parentCredential, wallet);

    const issuerDID = Array.isArray(message.to) ? message.to[0] : message.to;

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

export const messageHandlers = [
  INVITATION_HANDLER,
  DELEGATION_REQUEST_HANDLER,
];

export async function handleMessage(
  message,
  context: {
    wallet;
    messageProvider;
  },
) {
  console.log('[handleMessage] called with:', message);

  const decoded = decodeMessage(message);
  if (!decoded) {
    console.log('[handleMessage] message could not be decoded, skipping');
    return;
  }

  const handler = messageHandlers.find(h => h.check(decoded));
  if (!handler) {
    console.log(
      '[handleMessage] no handler matched message type:',
      decoded.type,
    );
    return;
  }

  console.log(
    '[handleMessage] dispatching to handler for type:',
    decoded.type,
  );
  return handler.handle(decoded, context);
}
