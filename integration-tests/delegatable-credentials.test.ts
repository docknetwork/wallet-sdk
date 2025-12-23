import {
  verifyDelegatablePresentation,
  createCedarPolicy,
  createDelegatablePresentation,
  createDelegationCredential,
  createEd25519Proof,
} from '@docknetwork/wallet-sdk-wasm/src/services/credential/delegatable-credentials';


/**
 * Delegation namespace for credential chain properties
 */
const DELEGATION_NAMESPACE = 'https://ld.truvera.io/credentials/delegation#';

/**
 * Pre-defined context for credit delegation credentials
 */
const CREDIT_DELEGATION_CONTEXT = [
  'https://www.w3.org/2018/credentials/v1',
  'https://ld.truvera.io/credentials/delegation',
  {
    '@version': 1.1,
    ex: 'https://example.org/credentials#',
    delegation: DELEGATION_NAMESPACE,
    CreditScoreDelegation: 'ex:CreditScoreDelegation',
    DelegationCredential: 'delegation:DelegationCredential',
    body: 'ex:body',
    rootCredentialId: { '@id': 'delegation:rootCredentialId', '@type': '@id' },
    previousCredentialId: { '@id': 'delegation:previousCredentialId', '@type': '@id' },
  },
];

/**
 * Pre-defined context for credit score credentials
 */
const CREDIT_SCORE_CONTEXT = [
  'https://www.w3.org/2018/credentials/v1',
  'https://ld.truvera.io/credentials/delegation',
  {
    '@version': 1.1,
    ex: 'https://example.org/credentials#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    delegation: DELEGATION_NAMESPACE,
    CreditScoreCredential: 'ex:CreditScoreCredential',
    creditScore: { '@id': 'ex:creditScore', '@type': 'xsd:integer' },
    rootCredentialId: { '@id': 'delegation:rootCredentialId', '@type': '@id' },
    previousCredentialId: { '@id': 'delegation:previousCredentialId', '@type': '@id' },
  },
];

/**
 * Pre-defined context for verifiable presentations
 */
const PRESENTATION_CONTEXT = ['https://www.w3.org/2018/credentials/v1'];

describe('Delegatable Credentials', () => {
  // Cedar policy for credit score delegation
  const policies = createCedarPolicy({
    maxDepth: 2,
    rootIssuer: 'did:dock:a',
    requiredClaims: {
      creditScore: 0,
      body: 'Issuer of Credit Scores',
    },
  });

  // Authorized delegation credential
  const authorizedDelegation = createDelegationCredential({
    id: 'urn:cred:deleg-a-b',
    context: CREDIT_DELEGATION_CONTEXT,
    types: ['VerifiableCredential', 'CreditScoreDelegation', 'DelegationCredential'],
    issuer: 'did:dock:a',
    subjectId: 'did:dock:b',
    mayClaim: ['creditScore'],
    additionalSubjectProperties: {
      body: 'Issuer of Credit Scores',
    },
  });

  // Authorized score credential
  const authorizedScore = {
    '@context': CREDIT_SCORE_CONTEXT,
    id: 'urn:cred:score-alice',
    type: ['VerifiableCredential', 'CreditScoreCredential'],
    issuer: 'did:dock:b',
    previousCredentialId: 'urn:cred:deleg-a-b',
    rootCredentialId: 'urn:cred:deleg-a-b',
    credentialSubject: {
      id: 'did:example:alice',
      creditScore: 760,
    },
  };

  // Unauthorized delegation credential (no creditScore claim)
  const unauthorizedDelegation = createDelegationCredential({
    id: 'urn:cred:deleg-a-b',
    context: CREDIT_DELEGATION_CONTEXT,
    types: ['VerifiableCredential', 'CreditScoreDelegation', 'DelegationCredential'],
    issuer: 'did:dock:a',
    subjectId: 'did:dock:b',
    mayClaim: ['noClaim'],
  });

  it('should verify authorized credit score delegation', async () => {
    const proof = createEd25519Proof({
      verificationMethod: 'did:dock:b#auth-key',
      challenge: 'credit-score-example',
      domain: 'docklabs.example',
      created: '2025-01-17T12:15:51Z',
      jws: 'test..signature',
    });

    const vp = createDelegatablePresentation(
      [authorizedDelegation, authorizedScore],
      proof,
      PRESENTATION_CONTEXT
    );

    const result = await verifyDelegatablePresentation(vp, { policies });

    expect(result.decision).toBe('allow');
    expect(result.failures).toStrictEqual([]);
  });

  it('should deny unauthorized credit score delegation', async () => {
    const proof = createEd25519Proof({
      verificationMethod: 'did:dock:d#auth-key',
      challenge: 'credit-score-example',
      domain: 'docklabs.example',
      created: '2025-01-17T12:15:51Z',
      jws: 'test..signature',
    });

    const vp = createDelegatablePresentation(
      [unauthorizedDelegation, authorizedScore],
      proof,
      PRESENTATION_CONTEXT
    );

    const result = await verifyDelegatablePresentation(vp, { policies });

    expect(result.decision).not.toBe('allow');
  });

  it('should verify delegation without Cedar policies', async () => {
    const proof = createEd25519Proof({
      verificationMethod: 'did:dock:b#auth-key',
      challenge: 'credit-score-example',
      domain: 'docklabs.example',
      created: '2025-01-17T12:15:51Z',
      jws: 'test..signature',
    });

    const vp = createDelegatablePresentation(
      [authorizedDelegation, authorizedScore],
      proof,
      PRESENTATION_CONTEXT
    );

    const result = await verifyDelegatablePresentation(vp);

    expect(result.failures).toStrictEqual([]);
  });

  it('should create delegation credentials with helper function', () => {
    const delegation = createDelegationCredential({
      id: 'urn:cred:test-delegation',
      issuer: 'did:dock:issuer',
      subjectId: 'did:dock:subject',
      mayClaim: ['claim1', 'claim2'],
      additionalSubjectProperties: {
        customProp: 'value',
      },
    });

    expect(delegation.id).toBe('urn:cred:test-delegation');
    expect(delegation.issuer).toBe('did:dock:issuer');
    expect(delegation.credentialSubject.id).toBe('did:dock:subject');
    expect(delegation.credentialSubject['https://rdf.dock.io/alpha/2021#mayClaim']).toEqual(['claim1', 'claim2']);
    expect(delegation.credentialSubject.customProp).toBe('value');
    expect(delegation.rootCredentialId).toBe('urn:cred:test-delegation');
  });

  it('should create Cedar policies with helper function', () => {
    const policy = createCedarPolicy({
      maxDepth: 3,
      rootIssuer: 'did:dock:root',
      requiredClaims: {
        level: 5,
        role: 'admin',
      },
    });

    expect(policy.staticPolicies).toContain('context.tailDepth <= 3');
    expect(policy.staticPolicies).toContain('did:dock:root');
    expect(policy.staticPolicies).toContain('context.authorizedClaims.level >= 5');
    expect(policy.staticPolicies).toContain('context.authorizedClaims.role == "admin"');
  });
});
