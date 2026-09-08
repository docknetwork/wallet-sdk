import {createFullWalletClient, closeWallet} from './helpers/wallet-helpers';
import {handleMessage} from '../packages/core/src/delegation/delegation-offer';
import {
  approveDelegationRequest,
  createDelegationRequest,
  sendDelegationRequest,
} from '../packages/core/src/delegation/delegation-request';
import {issueCredential} from '@docknetwork/wallet-sdk-core/src/delegation/delegation-issuance';
import {
  TRAVEL_AGENCY_CONTEXT,
  travelAgencyPolicy,
} from './delegation/delegation-fixtures';
import {getDelegationDetails} from '@docknetwork/wallet-sdk-core/src/delegation/delegation-policy';

const ROOT_ROLE_ID = 'e79c0d16-8739-4e54-94d7-53d9f1c97c71'; // Travel Agent 1
const REQUESTED_ROLE_ID = '8e5abc88-7006-42ae-ae48-9e34f8f66124'; // Corporate Account Manager

async function issueRootCredential(walletClient) {
  const credentialData = {
    '@context': TRAVEL_AGENCY_CONTEXT,
    type: [
      'VerifiableCredential',
      'TravelAgencyCredential',
      'DelegationCredential',
    ],
    issuer: {
      id: 'did:test:root-issuer',
      name: 'Travel Agency',
    },
    credentialSchema: {
      id: 'https://schema.truvera.io/travel-agency-credential.json',
      type: 'JsonSchemaValidator2018',
    },
    credentialSubject: {
      id: 'did:test:travel-agency',
      allowedRoutes: ['US-NYC-LAX', 'US-SFO-SEA', 'US-ORD-MIA'],
      purchaseLimit: 10000,
      reserveFlights: true,
      reserveHotels: true,
    },
    issuanceDate: new Date().toISOString(),
  };
  const [issuerKey] = await walletClient.didProvider.getDIDKeyPairs();
  const credential = await issueCredential(
    credentialData,
    issuerKey,
    travelAgencyPolicy,
    ROOT_ROLE_ID,
  );
  await walletClient.wallet.addDocument(credential);
  return credential;
}

describe('Delegation Request', () => {
  let delegatorWallet: Awaited<ReturnType<typeof createFullWalletClient>>;
  let delegateeWallet: Awaited<ReturnType<typeof createFullWalletClient>>;
  let stopDelegatorAutoFetch: () => void;
  let stopDelegateeAutoFetch: () => void;

  beforeAll(async () => {
    delegatorWallet = await createFullWalletClient();
    console.log('[setup] delegator wallet ready, DID:', delegatorWallet.did);

    delegateeWallet = await createFullWalletClient();
    console.log('[setup] delegatee wallet ready, DID:', delegateeWallet.did);

    stopDelegatorAutoFetch = delegatorWallet.messageProvider.startAutoFetch();
    stopDelegateeAutoFetch = delegateeWallet.messageProvider.startAutoFetch();
  }, 60_000);

  afterAll(async () => {
    stopDelegatorAutoFetch?.();
    stopDelegateeAutoFetch?.();
    await closeWallet(delegatorWallet.wallet);
    await closeWallet(delegateeWallet.wallet);
  });

  it('delegatee requests a delegation and delegator approves it', async () => {
    // The delegator holds a delegatable root credential (Travel Agent 1).
    const rootCredential = await issueRootCredential(delegatorWallet);

    // Step 1: Delegatee creates a delegation request for a role under the
    // known policy. The request carries the FULL policy — policy ids are
    // data: URIs and never match across wallets, matching is content-based.
    const delegationRequest = await createDelegationRequest({
      wallet: delegateeWallet.wallet,
      requesterDID: delegateeWallet.did,
      delegatorDID: delegatorWallet.did,
      delegationPolicy: travelAgencyPolicy,
      delegationRole: REQUESTED_ROLE_ID,
      message:
        'I need access to search and book flights and hotels for your upcoming trip.',
    });

    expect(delegationRequest.id).toBeDefined();
    expect(delegationRequest.status).toBe('pending');

    // The request is persisted on the delegatee side so the issuance leg can
    // resolve it by id when the delegated credential arrives.
    const storedRequest = await delegateeWallet.wallet.getDocumentById(
      delegationRequest.id,
    );
    expect(storedRequest).toBeDefined();
    expect(storedRequest.type).toContain('DelegationRequest');

    // Step 2: Delegatee sends the request to the delegator over DIDComm.
    await sendDelegationRequest({
      delegationRequest,
      messageProvider: delegateeWallet.messageProvider,
    });

    const proposalMessage =
      await delegatorWallet.messageProvider.waitForMessage();
    console.log('[delegator] received delegation request:', proposalMessage);

    expect(proposalMessage.type).toBe(
      'https://didcomm.org/issue-credential/3.0/propose-credential',
    );
    expect(proposalMessage.from).toBe(delegateeWallet.did);
    expect(proposalMessage.body.goal_code).toBe('dock.request-delegation');

    // Step 3: Delegator dispatches the message — the handler stores the
    // request, filters wallet credentials that can fulfill it, and emits an
    // event for the review UI.
    const requestReceivedPromise = new Promise<any>(resolve => {
      delegatorWallet.wallet.eventManager.addListener(
        'delegationRequestReceived',
        payload => resolve(payload),
      );
    });

    await handleMessage(proposalMessage, {
      wallet: delegatorWallet.wallet,
      messageProvider: delegatorWallet.messageProvider,
    });

    const {delegationRequest: receivedRequest, matchingCredentials} =
      await requestReceivedPromise;
    console.log('[delegator] delegationRequestReceived:', receivedRequest.id);

    expect(receivedRequest.id).toBe(delegationRequest.id);
    expect(receivedRequest.requesterDID).toBe(delegateeWallet.did);
    expect(receivedRequest.delegationRole).toBe(REQUESTED_ROLE_ID);
    expect(receivedRequest.status).toBe('pending');
    expect(matchingCredentials.length).toBe(1);
    expect(matchingCredentials[0].id).toBe(rootCredential.id);

    // Step 4: Delegator approves — issues the delegated credential from the
    // matching credential and sends it back. From here the flow converges
    // with the delegation offer issuance leg.
    await approveDelegationRequest({
      delegationRequest: receivedRequest,
      credentialId: matchingCredentials[0].id,
      wallet: delegatorWallet.wallet,
      messageProvider: delegatorWallet.messageProvider,
    });

    const delegatorStoredRequest = await delegatorWallet.wallet.getDocumentById(
      delegationRequest.id,
    );
    expect(delegatorStoredRequest.status).toBe('accepted');
    expect(delegatorStoredRequest.revocationData.credentialId).toBeDefined();
    expect(
      delegatorStoredRequest.revocationData.credentialStatus,
    ).toBeDefined();

    // Step 5: Delegatee receives the delegated credential.
    const issuanceMessage =
      await delegateeWallet.messageProvider.waitForMessage();
    console.log('[delegatee] received issuance message:', issuanceMessage);

    expect(issuanceMessage.type).toBe(
      'https://didcomm.org/issue-credential/3.0/issue-credential',
    );
    expect(issuanceMessage.from).toBe(delegatorWallet.did);
    expect(issuanceMessage.body.delegationOfferId).toBe(delegationRequest.id);

    const [issuedCredential] = issuanceMessage.body.credentials;
    expect(issuedCredential.type).toContain('DelegationCredential');
    expect(issuedCredential.rootCredentialId).toBe(rootCredential.id);
    expect(issuedCredential.delegationRoleId).toBe(REQUESTED_ROLE_ID);

    const credentialReceivedPromise = new Promise<any>(resolve => {
      delegateeWallet.wallet.eventManager.addListener(
        'delegatedCredentialReceived',
        payload => resolve(payload),
      );
    });

    await handleMessage(issuanceMessage, {
      wallet: delegateeWallet.wallet,
      messageProvider: delegateeWallet.messageProvider,
    });

    const receivedPayload = await credentialReceivedPromise;
    expect(receivedPayload.delegationOfferId).toBe(delegationRequest.id);
    expect(receivedPayload.credentials[0].id).toBe(issuedCredential.id);

    // Delegated credential is stored and carries the requested role.
    const storedCredential = await delegateeWallet.wallet.getDocumentById(
      issuedCredential.id,
    );
    const delegationDetails = await getDelegationDetails(
      storedCredential,
      delegateeWallet.wallet,
    );
    expect(delegationDetails.role.roleId).toBe(REQUESTED_ROLE_ID);
    expect(delegationDetails.role.label).toBe('Corporate Account Manager');
    expect(delegationDetails.delegationChain[0].id).toBe(rootCredential.id);

    // Delegatee's stored request advanced to accepted.
    const delegateeStoredRequest = await delegateeWallet.wallet.getDocumentById(
      delegationRequest.id,
    );
    expect(delegateeStoredRequest.status).toBe('accepted');

    // Step 6: Delegator receives the ACK.
    const ackMessage = await delegatorWallet.messageProvider.waitForMessage();
    console.log('[delegator] received ACK:', ackMessage);

    expect(ackMessage.type).toBe(
      'https://didcomm.org/issue-credential/3.0/ack',
    );
    expect(ackMessage.from).toBe(delegateeWallet.did);
    expect(ackMessage.body.delegationOfferId).toBe(delegationRequest.id);
    expect(ackMessage.body.status).toBe('OK');

    await handleMessage(ackMessage, {
      wallet: delegatorWallet.wallet,
      messageProvider: delegatorWallet.messageProvider,
    });

    const finalRequest = await delegatorWallet.wallet.getDocumentById(
      delegationRequest.id,
    );
    expect(finalRequest.status).toBe('accepted');
  }, 60_000);
});
