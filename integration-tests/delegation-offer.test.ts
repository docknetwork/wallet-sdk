import {
  createFullWalletClient,
  closeWallet,
} from './helpers/wallet-helpers';
import {
  acceptDelegationOffer,
  createDelegationOffer,
  createOOBInvitation,
  handleMessage,
} from '../packages/core/src/delegation/delegation-offer';
import {issueCredential} from '@docknetwork/wallet-sdk-core/src/delegation/delegation-issuance';
import {
  TRAVEL_AGENCY_CONTEXT,
  travelAgencyPolicy,
} from './delegation/delegation-fixtures';

async function issueRootCredential(walletClient) {
  const roleId = 'e79c0d16-8739-4e54-94d7-53d9f1c97c71';
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
    roleId,
  );
  await walletClient.wallet.addDocument(credential);
  return credential;
}

describe('Credential Distribution', () => {
  let issuerWallet: Awaited<ReturnType<typeof createFullWalletClient>>;
  let holderWallet: Awaited<ReturnType<typeof createFullWalletClient>>;
  let stopIssuerAutoFetch: () => void;
  let stopHolderAutoFetch: () => void;

  beforeAll(async () => {
    console.log('[setup] creating issuer wallet...');
    issuerWallet = await createFullWalletClient();
    console.log('[setup] issuer wallet ready, DID:', issuerWallet.did);

    console.log('[setup] creating holder wallet...');
    holderWallet = await createFullWalletClient();
    console.log('[setup] holder wallet ready, DID:', holderWallet.did);

    console.log('[setup] starting auto-fetch for both wallets...');
    stopIssuerAutoFetch = issuerWallet.messageProvider.startAutoFetch();
    stopHolderAutoFetch = holderWallet.messageProvider.startAutoFetch();
    console.log('[setup] auto-fetch started');
  }, 60_000);

  afterAll(async () => {
    console.log('[teardown] stopping auto-fetch...');
    stopIssuerAutoFetch?.();
    stopHolderAutoFetch?.();

    console.log('[teardown] closing issuer wallet...');
    await closeWallet(issuerWallet.wallet);

    console.log('[teardown] closing holder wallet...');
    await closeWallet(holderWallet.wallet);

    console.log('[teardown] done');
  });

  it('issuer should share OOB invitation with holder', async () => {
    const rootCredential = await issueRootCredential(issuerWallet);

    // Step 1: Issuer creates a delegation offer and shares the OOB invitation URL with the holder
    const delegationOffer = await createDelegationOffer({
      wallet: issuerWallet.wallet,
      issuerDID: issuerWallet.did,
      delegationPolicy: travelAgencyPolicy,
      credentialId: rootCredential.id,
      delegationRole: 'e79c0d16-8739-4e54-94d7-53d9f1c97c71',
    });

    const qrCode = createOOBInvitation(issuerWallet.did, delegationOffer, {
      goal: 'Test issuer is offering you a delegation',
    });
    console.log('[issuer] OOB invitation URL created:', qrCode);

    // Listens for delegation offer events and accepts them when received
    const offerAcceptPromise = new Promise<any>(resolve => {
      holderWallet.wallet.eventManager.addListener(
        'delegationOfferReceived',
        async delegationOffer => {
          console.log(
            '[holder] delegationOfferReceived event:',
            delegationOffer,
          );
          await acceptDelegationOffer({
            delegationOffer,
            wallet: holderWallet.wallet,
            messageProvider: holderWallet.messageProvider,
          });
          resolve(delegationOffer);
        },
      );
    });

    // Step 2: Holder scans the OOB invitation URL — this decodes it, persists the offer, and emits the event
    console.log('[holder] scanning OOB invitation URL...');
    await handleMessage(qrCode, {
      wallet: holderWallet.wallet,
      messageProvider: holderWallet.messageProvider,
    });

    // Wait for the offer to be accepted in the event listener, then verify it was processed correctly
    const acceptedOffer = await offerAcceptPromise;
    console.log('[holder] delegation offer accepted:', acceptedOffer.id);

    // Verify the delegation offer was added to the holder's wallet
    const storedOffer = await holderWallet.wallet.getDocumentById(
      acceptedOffer.id,
    );
    console.log('[holder] stored delegation offer:', storedOffer);
    expect(storedOffer).toBeDefined();
    expect(storedOffer.type).toContain('DelegationOffer');

    // Step 3: The issuer should receive a credential request message from the holder as a result of accepting the offer

    const credentialRequestFromHolder = await issuerWallet.messageProvider.waitForMessage();

    console.log('[issuer] received message after offer acceptance:', credentialRequestFromHolder);

    expect(credentialRequestFromHolder).toBeDefined();
    expect(credentialRequestFromHolder.from).toBe(holderWallet.did);
    expect(credentialRequestFromHolder.type).toBe('https://didcomm.org/issue-credential/3.0/request-credential');

    // create handlers for credential request messages for delegation offer
    await handleMessage(credentialRequestFromHolder, {
      wallet: issuerWallet.wallet,
      messageProvider: issuerWallet.messageProvider,
    });

    // check if delegation offer is accepted in the issuer wallet, and holder did is added to the document

    const updatedOffer = await issuerWallet.wallet.getDocumentById(acceptedOffer.id);
    console.log('[issuer] updated delegation offer after handling credential request:', updatedOffer);

    expect(updatedOffer).toBeDefined();
    expect(updatedOffer.type).toContain('DelegationOffer');
    expect(updatedOffer.status).toBe('accepted');
    expect(updatedOffer.holderDID).toBe(holderWallet.did);

    // Step 4: Holder receive the delegatable credential from the issuer
    const delegatableCredential = await holderWallet.messageProvider.waitForMessage();


    console.log('[holder] received message after credential request:', delegatableCredential);

    expect(delegatableCredential).toBeDefined();
    expect(delegatableCredential.type).toBe('https://didcomm.org/issue-credential/3.0/issue-credential');
    expect(delegatableCredential.from).toBe(issuerWallet.did);
    expect(delegatableCredential.body.delegationOfferId).toBe(acceptedOffer.id);
    expect(Array.isArray(delegatableCredential.body.credentials)).toBe(true);
    expect(delegatableCredential.body.credentials.length).toBeGreaterThan(0);

    const [issuedCredential] = delegatableCredential.body.credentials;
    expect(issuedCredential.type).toContain('DelegationCredential');
    expect(issuedCredential.rootCredentialId).toBe(rootCredential.id);
    expect(issuedCredential.roleId).toBe('e79c0d16-8739-4e54-94d7-53d9f1c97c71');

    const delegationChain = delegatableCredential.body.delegationChain;
    expect(Array.isArray(delegationChain)).toBe(true);
    expect(delegationChain.length).toBeGreaterThan(0);
    expect(delegationChain[0].id).toBe(rootCredential.id);

    // Step 5: Holder dispatches the issue-credential message — the handler
    // stores the delegated credential, sends an ACK back, and emits an event.
    const credentialReceivedPromise = new Promise<any>(resolve => {
      holderWallet.wallet.eventManager.addListener(
        'delegatedCredentialReceived',
        payload => {
          console.log('[holder] delegatedCredentialReceived event:', payload);
          resolve(payload);
        },
      );
    });

    await handleMessage(delegatableCredential, {
      wallet: holderWallet.wallet,
      messageProvider: holderWallet.messageProvider,
    });

    const receivedPayload = await credentialReceivedPromise;
    expect(receivedPayload.delegationOfferId).toBe(acceptedOffer.id);
    expect(receivedPayload.credentials[0].id).toBe(issuedCredential.id);

    // Verify the delegated credential was persisted on the holder side.
    const storedCredential = await holderWallet.wallet.getDocumentById(
      issuedCredential.id,
    );
    expect(storedCredential).toBeDefined();
    expect(storedCredential.rootCredentialId).toBe(rootCredential.id);

    // Verify the holder's stored offer was advanced to 'accepted'.
    const holderStoredOffer = await holderWallet.wallet.getDocumentById(
      acceptedOffer.id,
    );
    expect(holderStoredOffer.status).toBe('accepted');

    // Step 6: The issuer should receive an ACK from the holder.
    const ackMessage = await issuerWallet.messageProvider.waitForMessage();
    console.log('[issuer] received ACK:', ackMessage);
    expect(ackMessage.type).toBe('https://didcomm.org/issue-credential/3.0/ack');
    expect(ackMessage.from).toBe(holderWallet.did);
    expect(ackMessage.body.delegationOfferId).toBe(acceptedOffer.id);
    expect(ackMessage.body.status).toBe('OK');
  }, 60_000);
});
