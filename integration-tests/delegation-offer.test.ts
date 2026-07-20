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
import {getDelegationDetails} from '@docknetwork/wallet-sdk-core/src/delegation/delegation-policy';

async function issueRootCredential(walletClient) {
  const delegationRoleId = 'e79c0d16-8739-4e54-94d7-53d9f1c97c71';
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
    delegationRoleId,
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
    expect(issuedCredential.delegationRoleId).toBe('e79c0d16-8739-4e54-94d7-53d9f1c97c71');

    // Re-delegated credential must carry the same credentialSchema as the root credential.
    expect(issuedCredential.credentialSchema).toEqual(rootCredential.credentialSchema);

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


    // Resolve the full delegation details for the stored credential and verify
    // it carries the capabilities the holder was delegated.
    const delegationDetails = await getDelegationDetails(storedCredential, holderWallet.wallet);

    // The holder was delegated the root role (Travel Agent 1).
    expect(delegationDetails.delegationPolicy.id).toBe(travelAgencyPolicy.id);
    expect(delegationDetails.role.roleId).toBe('e79c0d16-8739-4e54-94d7-53d9f1c97c71');
    expect(delegationDetails.role.label).toBe('Travel Agent 1');
    expect(delegationDetails.role.level).toBe(1);

    // remainingDelegationDepth = maxDelegationDepth (4) - role level (1)
    expect(delegationDetails.remainingDelegationDepth).toBe(3);

    // Tree root is the delegated role itself.
    expect(delegationDetails.roleTree.roleId).toBe('e79c0d16-8739-4e54-94d7-53d9f1c97c71');

    // delegationOptions = every descendant role the holder may delegate to (all 7 non-root roles).
    const optionRoleIds = delegationDetails.delegationOptions.map(r => r.roleId).sort();
    expect(optionRoleIds).toEqual(
      [
        '8e5abc88-7006-42ae-ae48-9e34f8f66124',
        '6375baa1-a52d-4838-9100-3facea02ba49',
        '16f68474-bf3b-4494-9fe5-f141a7d74a33',
        'c1bd8821-c645-4dd6-ab07-9bc087755db9',
        '9726317c-cb60-4ae7-a828-e334b10f6f52',
        '888aeee9-c3ed-469b-86bd-910490c9aa20',
        'd39f29c4-fc3e-4b5d-9eae-9f576576e4fb',
      ].sort(),
    );

    // Chain starts with the holder's own delegated credential.
    expect(delegationDetails.delegationChain[0].id).toBe(storedCredential.id);
    expect(delegationDetails.delegationChain[0].rootCredentialId).toBe(rootCredential.id);

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
