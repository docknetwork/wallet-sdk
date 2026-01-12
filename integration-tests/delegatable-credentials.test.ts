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
import {credentialService} from '@docknetwork/wallet-sdk-wasm/src/services/credential/service';
import {didService} from '@docknetwork/wallet-sdk-wasm/src/services/dids/service';
import {pexService} from '@docknetwork/wallet-sdk-wasm/src/services/pex';
import {v4 as uuidv4} from 'uuid';
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
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    CreditScoreDelegation: 'ex:CreditScoreDelegation',
    creditScore: {'@id': 'ex:creditScore', '@type': 'xsd:integer'},
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
    creditScore: {'@id': 'ex:creditScore', '@type': 'xsd:integer'},
  },
];

const CHALLENGE = 'test-challenge-123';
const DOMAIN = 'test.example.com';

function generateCredentialId(namespace: string) {
  return `urn:${namespace}:${uuidv4()}`;
}

describe('Delegatable Credentials', () => {
  let issuerKey: any;
  let holderKey: any;
  let agentKey: any;
  let subAgentKey: any;
  let issuerDid: string;
  let holderDid: string;
  let agentDid: string;
  let subAgentDid: string;
  let rootCredential: any;
  let credDelegatedToAgent: any;
  let credDelegatedToSubAgent: any;
  let unauthorizedDelegationCredential: any;

  beforeAll(async () => {
    // Generate key pairs for root issuer and delegate
    issuerKey = await didService.generateKeyDoc({
      type: 'ed25519',
    });
    holderKey = await didService.generateKeyDoc({
      type: 'ed25519',
    });
    agentKey = await didService.generateKeyDoc({
      type: 'ed25519',
    });
    subAgentKey = await didService.generateKeyDoc({
      type: 'ed25519',
    });

    // Extract DIDs from the key documents
    issuerDid = issuerKey.controller;
    holderDid = holderKey.controller;
    agentDid = agentKey.controller;
    subAgentDid = subAgentKey.controller;

    // Issue the root delegation credential
    // This grants the delegate authority to issue creditScore claims
    rootCredential = await issueDelegationCredential(issuerKey, {
      id: generateCredentialId('root-issuer'),
      issuer: issuerDid,
      '@context': CREDIT_SCORE_DELEGATION_CONTEXT,
      issuanceDate: new Date().toISOString(),
      type: [
        'VerifiableCredential',
        'CreditScoreCredential',
        'DelegationCredential',
      ],
      credentialSubject: {
        id: holderDid,
        creditScore: 760,
        [MAY_CLAIM_IRI]: ['creditScore'],
      },
      previousCredentialId: null,
      rootCredentialId: null,
    });

    // Issue a credit score credential as the agent
    credDelegatedToAgent = await issueDelegatedCredential(holderKey, {
      id: generateCredentialId('root-issuer'),
      '@context': CREDIT_SCORE_CREDENTIAL_CONTEXT,
      issuer: holderDid,
      issuanceDate: new Date().toISOString(),
      type: [
        'VerifiableCredential',
        'CreditScoreCredential',
        'DelegationCredential',
      ],
      credentialSubject: {
        id: agentDid,
        creditScore: 400,
        [MAY_CLAIM_IRI]: ['creditScore'],
      },
      previousCredentialId: rootCredential.id,
      rootCredentialId: rootCredential.id,
    });

    credDelegatedToSubAgent = await issueDelegatedCredential(agentKey, {
      id: generateCredentialId('agent'),
      issuanceDate: new Date().toISOString(),
      issuer: agentDid,
      credentialSubject: {
        id: subAgentDid,
        creditScore: 200,
        [MAY_CLAIM_IRI]: ['creditScore'],
      },
      rootCredentialId: rootCredential.id,
      previousCredentialId: credDelegatedToAgent.id,
      '@context': CREDIT_SCORE_CREDENTIAL_CONTEXT,
      type: ['VerifiableCredential', 'CreditScoreCredential'],
    });

    // Issue an unauthorized delegation (no creditScore in mayClaim)
    unauthorizedDelegationCredential = await issueDelegationCredential(issuerKey, {
      id: 'urn:cred:unauthorized-delegation',
      issuanceDate: new Date().toISOString(),
      issuer: issuerDid,
      credentialSubject: {
        id: holderDid,
        creditScore: 760,
        [MAY_CLAIM_IRI]: ['someOtherClaim'],
      },
      '@context': CREDIT_SCORE_DELEGATION_CONTEXT,
      type: ['VerifiableCredential', 'CreditScoreDelegation', 'DelegationCredential'],
    });
  });

  it('should issue a valid delegation credential', () => {
    expect(rootCredential).toBeDefined();
    expect(rootCredential.issuer).toBe(issuerDid);
    expect(rootCredential.credentialSubject.id).toBe(holderDid);
    expect(rootCredential.credentialSubject[MAY_CLAIM_IRI]).toContain(
      'creditScore',
    );
    expect(rootCredential.proof).toBeDefined();
    expect(rootCredential.rootCredentialId).toBeNull();
    expect(rootCredential.previousCredentialId).toBeNull();
  });

  it('should issue a valid delegated credential', () => {
    expect(credDelegatedToAgent).toBeDefined();
    expect(credDelegatedToAgent.issuer).toBe(holderDid);
    expect(credDelegatedToAgent.credentialSubject.id).toBe(agentDid);
    expect(credDelegatedToAgent.credentialSubject.creditScore).toBe(400);
    expect(credDelegatedToAgent.proof).toBeDefined();
    expect(credDelegatedToAgent.rootCredentialId).toBe(rootCredential.id);
    expect(credDelegatedToAgent.previousCredentialId).toBe(rootCredential.id);
    expect(credDelegatedToAgent.type).toContain('VerifiableCredential');
  });

  it('should create a valid presentation with a delegated credential', async () => {
    const presentation = await createSignedPresentation(agentKey, {
      credentials: [rootCredential, credDelegatedToAgent],
      holderDid: agentDid,
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    const result = await verifyDelegatablePresentation(presentation, {
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    expect(result.verified).toBe(true);
  });

  it('should handle pex request with delegated credential', async () => {

    const presentationDefinition = {
      id: 'delegation_test',
      input_descriptors: [
        {
          id: 'root-credential',
          name: 'Root Credential',
          purpose: 'Must be the root credential issued by the required issuer',
          group: ['1'],
          constraints: {
            fields: [
              {
                path: ['$.type'],
                filter: {
                  type: 'array',
                  contains: {
                    const: 'CreditScoreCredential',
                  },
                },
              },
              {
                path: ['$.issuer', '$.iss'],
                filter: {
                  type: 'string',
                  const: issuerDid,
                },
              },
            ],
          },
        },
        {
          id: 'other-credentials',
          name: 'Additional Credentials',
          purpose:
            'Any number of additional credentials of the specified type from any issuer',
          group: ['2'],
          constraints: {
            fields: [
              {
                path: ['$.type'],
                filter: {
                  type: 'array',
                  contains: {
                    const: 'CreditScoreCredential',
                  },
                },
              },
            ],
          },
        },
      ],
      submission_requirements: [
        {
          from: '1',
          name: 'Root Credential',
          rule: 'pick',
          count: 1,
        },
        {
          from: '2',
          name: 'Additional Credentials',
          rule: 'pick',
          min: 0, // Minimum 0 = optional
        },
      ],
    };

    const result = await credentialService.filterCredentials({
      credentials: [rootCredential, credDelegatedToAgent],
      presentationDefinition,
      holderDid: subAgentDid,
    });

    console.log('PEX Result:', JSON.stringify(result, null, 2));


    expect(result.verifiableCredential?.length).toBe(2);
    expect(result.errors?.length).toBe(0);
  });


  it('should verify authorized delegation with Cedar policies', async () => {
    // Create a signed presentation with both credentials
    const presentation = await createSignedPresentation(agentKey, {
      credentials: [rootCredential, credDelegatedToAgent],
      holderDid: agentDid,
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    // Create Cedar policy that allows this delegation
    const policies = createCedarPolicy({
      maxDepth: 2,
      rootIssuer: issuerDid,
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
    if (
      result.delegationResult?.summaries?.length &&
      result.delegationResult.summaries.length > 0
    ) {
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
    const unauthorizedCreditScore = await issueDelegatedCredential(holderKey, {
      id: 'urn:cred:unauthorized-credit-score',
      issuer: holderDid,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: agentDid,
        creditScore: 500,
        [MAY_CLAIM_IRI]: ['creditScore'],
      },
      rootCredentialId: unauthorizedDelegationCredential.id,
      previousCredentialId: unauthorizedDelegationCredential.id,
      '@context': CREDIT_SCORE_CREDENTIAL_CONTEXT,
      type: ['VerifiableCredential', 'CreditScoreCredential'],
    });

    // Create presentation with unauthorized delegation
    const presentation = await createSignedPresentation(agentKey, {
      credentials: [unauthorizedDelegationCredential, unauthorizedCreditScore],
      holderDid: holderDid,
      challenge: CHALLENGE,
      domain: DOMAIN,
    });

    // Create Cedar policy that requires creditScore claim authorization
    const policies = createCedarPolicy({
      maxDepth: 2,
      rootIssuer: issuerDid,
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
    const presentation = await createSignedPresentation(agentKey, {
      credentials: [rootCredential, credDelegatedToAgent],
      holderDid: agentDid,
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
    expect(policy.staticPolicies).toContain(
      'context.authorizedClaims.level >= 5',
    );
    expect(policy.staticPolicies).toContain(
      'context.authorizedClaims.role == "admin"',
    );
  });
});