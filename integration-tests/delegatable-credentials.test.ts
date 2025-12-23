import {
  verifyDelegatablePresentation,
  issueDelegationCredential,
  issueDelegatedCredential,
  createSignedPresentation,
  createCedarPolicy,
  MAY_CLAIM_IRI,
} from '@docknetwork/wallet-sdk-wasm/src/services/credential/delegatable-credentials';
import { didService } from '@docknetwork/wallet-sdk-wasm/src/services/dids/service';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const DELEGATION_ROOT_ID = 'urn:cred:delegation-root';
const CREDIT_SCORE_CRED_ID = 'urn:cred:credit-score-alice';
const SUBJECT_DID = 'did:example:alice';

const CHALLENGE = 'test-challenge-123';
const DOMAIN = 'test.example.com';

describe('Delegatable Credentials', () => {
  let rootIssuerKey: any;
  let delegateKey: any;
  let rootIssuerDid: string;
  let delegateDid: string;
  let delegationCredential: any;
  let creditScoreCredential: any;
  let unauthorizedDelegationCredential: any;

  beforeAll(async () => {
    // Generate key pairs for root issuer and delegate
    rootIssuerKey = await didService.generateKeyDoc({
      type: 'ed25519',
    });
    delegateKey = await didService.generateKeyDoc({
      type: 'ed25519',
    });

    // Extract DIDs from the key documents
    rootIssuerDid = rootIssuerKey.controller;
    delegateDid = delegateKey.controller;

    console.log('Root Issuer DID:', rootIssuerDid);
    console.log('Delegate DID:', delegateDid);

    // Issue the root delegation credential
    // This grants the delegate authority to issue creditScore claims
    delegationCredential = await issueDelegationCredential(rootIssuerKey, {
      id: DELEGATION_ROOT_ID,
      issuerDid: rootIssuerDid,
      delegateDid: delegateDid,
      mayClaim: ['creditScore'],
      additionalSubjectProperties: {
        body: 'Issuer of Credit Scores',
      },
    });

    // Issue a credit score credential as the delegate
    creditScoreCredential = await issueDelegatedCredential(delegateKey, {
      id: CREDIT_SCORE_CRED_ID,
      issuerDid: delegateDid,
      subjectDid: SUBJECT_DID,
      claims: {
        creditScore: 760,
      },
      rootCredentialId: DELEGATION_ROOT_ID,
      previousCredentialId: DELEGATION_ROOT_ID,
    });

    // Issue an unauthorized delegation (no creditScore in mayClaim)
    unauthorizedDelegationCredential = await issueDelegationCredential(rootIssuerKey, {
      id: 'urn:cred:unauthorized-delegation',
      issuerDid: rootIssuerDid,
      delegateDid: delegateDid,
      mayClaim: ['someOtherClaim'], // Does NOT include creditScore
    });
  });

  it('should issue a valid delegation credential', () => {
    expect(delegationCredential).toBeDefined();
    expect(delegationCredential.id).toBe(DELEGATION_ROOT_ID);
    expect(delegationCredential.issuer).toBe(rootIssuerDid);
    expect(delegationCredential.credentialSubject.id).toBe(delegateDid);
    expect(delegationCredential.credentialSubject[MAY_CLAIM_IRI]).toContain('creditScore');
    expect(delegationCredential.proof).toBeDefined();
    expect(delegationCredential.rootCredentialId).toBe(DELEGATION_ROOT_ID);
    expect(delegationCredential.previousCredentialId).toBeNull();
  });

  it('should issue a valid delegated credential', () => {
    expect(creditScoreCredential).toBeDefined();
    expect(creditScoreCredential.id).toBe(CREDIT_SCORE_CRED_ID);
    expect(creditScoreCredential.issuer).toBe(delegateDid);
    expect(creditScoreCredential.credentialSubject.id).toBe(SUBJECT_DID);
    expect(creditScoreCredential.credentialSubject.creditScore).toBe(760);
    expect(creditScoreCredential.proof).toBeDefined();
    expect(creditScoreCredential.rootCredentialId).toBe(DELEGATION_ROOT_ID);
    expect(creditScoreCredential.previousCredentialId).toBe(DELEGATION_ROOT_ID);
  });

  it('should verify authorized delegation with Cedar policies', async () => {
    // Create a signed presentation with both credentials
    const presentation = await createSignedPresentation(delegateKey, {
      credentials: [delegationCredential, creditScoreCredential],
      holderDid: delegateDid,
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    // Create Cedar policy that allows this delegation
    const policies = createCedarPolicy({
      maxDepth: 2,
      rootIssuer: rootIssuerDid,
      requiredClaims: {
        creditScore: 0,
        body: 'Issuer of Credit Scores',
      },
    });

    // Verify the presentation
    const result = await verifyDelegatablePresentation(presentation, {
      challenge: CHALLENGE,
      domain: DOMAIN,
      policies,
    });

    console.log('Verification result:', {
      verified: result.verified,
      delegationDecision: result.delegationResult?.decision,
      credentialResults: result.credentialResults?.map(r => r.verified),
    });

    // Check delegation result
    expect(result.delegationResult).toBeDefined();
    expect(result.delegationResult?.decision).toBe('allow');

    // Log delegation summary for debugging
    if (result.delegationResult?.summaries?.length > 0) {
      const summary = result.delegationResult.summaries[0];
      console.log('Delegation summary:', {
        rootIssuer: summary.rootIssuer,
        tailIssuer: summary.tailIssuer,
        tailDepth: summary.tailDepth,
        authorizedClaims: summary.authorizedClaims,
      });
    }
  });

  it('should verify delegation without Cedar policies', async () => {
    // Create a signed presentation
    const presentation = await createSignedPresentation(delegateKey, {
      credentials: [delegationCredential, creditScoreCredential],
      holderDid: delegateDid,
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    // Verify without Cedar policies - just validates delegation chain
    const result = await verifyDelegatablePresentation(presentation, {
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    console.log('Verification without policies:', {
      verified: result.verified,
      delegationDecision: result.delegationResult?.decision,
    });

    expect(result.delegationResult).toBeDefined();
    expect(result.delegationResult?.failures || []).toHaveLength(0);
  });

  it('should create Cedar policies with helper function', () => {
    const policy = createCedarPolicy({
      maxDepth: 3,
      rootIssuer: 'did:example:root',
      requiredClaims: {
        level: 5,
        role: 'admin',
      },
    });

    expect(policy.staticPolicies).toContain('context.tailDepth <= 3');
    expect(policy.staticPolicies).toContain('did:example:root');
    expect(policy.staticPolicies).toContain('context.authorizedClaims.level >= 5');
    expect(policy.staticPolicies).toContain('context.authorizedClaims.role == "admin"');
  });
});
