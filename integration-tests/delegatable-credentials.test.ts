import {
  verifyDelegatablePresentation,
  issueDelegationCredential,
  issueDelegatedCredential,
  createSignedPresentation,
  createCedarPolicy,
  MAY_CLAIM_IRI,
  W3C_CREDENTIALS_V1,
  DELEGATION_CONTEXT_TERMS,
} from '@docknetwork/wallet-sdk-wasm/src/services/credential/delegatable-credentials';
import { didService } from '@docknetwork/wallet-sdk-wasm/src/services/dids/service';

// ============================================================================
// TEST-SPECIFIC CONTEXTS (Credit Score Use Case)
// ============================================================================

/**
 * Context for credit score delegation credentials
 * Extends the base delegation terms with credit score specific vocabulary
 */
const CREDIT_SCORE_DELEGATION_CONTEXT = [
  W3C_CREDENTIALS_V1,
  {
    ...DELEGATION_CONTEXT_TERMS,
    ex: 'https://example.org/credentials#',
    CreditScoreDelegation: 'ex:CreditScoreDelegation',
    body: 'ex:body',
  },
];

/**
 * Context for credit score credentials issued by delegates
 */
const CREDIT_SCORE_CREDENTIAL_CONTEXT = [
  W3C_CREDENTIALS_V1,
  {
    ...DELEGATION_CONTEXT_TERMS,
    ex: 'https://example.org/credentials#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    CreditScoreCredential: 'ex:CreditScoreCredential',
    creditScore: { '@id': 'ex:creditScore', '@type': 'xsd:integer' },
  },
];

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
      context: CREDIT_SCORE_DELEGATION_CONTEXT,
      types: ['VerifiableCredential', 'CreditScoreDelegation', 'DelegationCredential'],
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
      context: CREDIT_SCORE_CREDENTIAL_CONTEXT,
      types: ['VerifiableCredential', 'CreditScoreCredential'],
    });

    // Issue an unauthorized delegation (no creditScore in mayClaim)
    unauthorizedDelegationCredential = await issueDelegationCredential(rootIssuerKey, {
      id: 'urn:cred:unauthorized-delegation',
      issuerDid: rootIssuerDid,
      delegateDid: delegateDid,
      mayClaim: ['someOtherClaim'], // Does NOT include creditScore
      context: CREDIT_SCORE_DELEGATION_CONTEXT,
      types: ['VerifiableCredential', 'CreditScoreDelegation', 'DelegationCredential'],
    });
  });

  it('should issue a valid delegation credential', () => {
    expect(delegationCredential).toBeDefined();
    expect(delegationCredential.id).toBe(DELEGATION_ROOT_ID);
    expect(delegationCredential.issuer).toBe(rootIssuerDid);
    expect(delegationCredential.credentialSubject.id).toBe(delegateDid);
    expect(delegationCredential.credentialSubject[MAY_CLAIM_IRI]).toContain('creditScore');
    expect(delegationCredential.proof).toBeDefined();
    expect(delegationCredential.rootCredentialId).toBeUndefined();
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

  it('should create a valid presentation with a delegated credential', async () => {
    const presentation = await createSignedPresentation(delegateKey, {
      credentials: [delegationCredential],
      holderDid: delegateDid,
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    const result = await verifyDelegatablePresentation(presentation, {
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    expect(result.verified).toBe(true);
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

  it('should deny unauthorized delegation (wrong mayClaim)', async () => {
    // Create a credential that uses an unauthorized delegation
    // The unauthorizedDelegationCredential only grants 'someOtherClaim', not 'creditScore'
    const unauthorizedCreditScore = await issueDelegatedCredential(delegateKey, {
      id: 'urn:cred:unauthorized-credit-score',
      issuerDid: delegateDid,
      subjectDid: SUBJECT_DID,
      claims: {
        creditScore: 500,
      },
      rootCredentialId: 'urn:cred:unauthorized-delegation',
      previousCredentialId: 'urn:cred:unauthorized-delegation',
      context: CREDIT_SCORE_CREDENTIAL_CONTEXT,
      types: ['VerifiableCredential', 'CreditScoreCredential'],
    });

    // Create presentation with unauthorized delegation
    const presentation = await createSignedPresentation(delegateKey, {
      credentials: [unauthorizedDelegationCredential, unauthorizedCreditScore],
      holderDid: delegateDid,
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    // Create Cedar policy that requires creditScore claim authorization
    const policies = createCedarPolicy({
      maxDepth: 2,
      rootIssuer: rootIssuerDid,
      requiredClaims: {
        creditScore: 0,
      },
    });

    // Verify the presentation - should fail because creditScore is not authorized
    const result = await verifyDelegatablePresentation(presentation, {
      challenge: CHALLENGE,
      domain: DOMAIN,
      policies,
    });

    console.log('Unauthorized delegation result:', {
      verified: result.verified,
      delegationDecision: result.delegationResult?.decision,
      failures: result.delegationResult?.failures?.map(f => f.message),
    });

    // Delegation should be denied because the delegate doesn't have creditScore authority
    expect(result.delegationResult?.decision).toBe('deny');
    expect(result.delegationResult?.failures).toBeDefined();
    expect(result.delegationResult?.failures?.length).toBeGreaterThan(0);
    expect(result.delegationResult?.failures?.[0]?.code).toBe('UNAUTHORIZED_CLAIM');
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
