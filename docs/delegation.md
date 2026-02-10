# Delegatable Credentials

Delegatable credentials enable a credential issuer (delegator) to delegate their authority to issue specific types of credentials to other entities (delegees). This creates a chain of trust where delegees can issue credentials on behalf of the original issuer, within the bounds of their delegated authority.

## Overview

A delegatable credential allows an issuer to:
- Grant specific issuance authorities to delegates
- Control which claims delegates can issue
- Establish delegation chains with multiple levels
- Enforce policies using Cedar policy language
- Verify the entire delegation chain during presentation

## Key Concepts

### Delegation Chain

A delegation chain consists of:
- **Root Credential**: The original delegation issued by the authoritative issuer
- **Delegated Credentials**: Credentials issued by delegates using their delegated authority
- **Chain Verification**: Each credential in the chain references its predecessor via `previousCredentialId` and the root via `rootCredentialId`

### May Claim

The `mayClaim` property (IRI: `https://www.dock.io/rdf2020#mayClaim`) specifies which claims a delegate is authorized to issue. For example:

```javascript
credentialSubject: {
  id: 'did:example:delegate',
  creditScore: 760,
  [MAY_CLAIM_IRI]: ['creditScore'], // Delegate can only issue creditScore claims
}
```

### Cedar Policies

[Cedar](https://docs.cedarpolicy.com/) is a language for defining permissions as policies. Cedar policies provide fine-grained authorization control over delegation chains. They can enforce:
- Maximum delegation depth
- Required root issuer
- Minimum claim values
- Specific claim values

## API Reference

### Core Functions

#### `issueDelegationCredential(keyDoc, options)`

Issues a root delegation credential that grants authority to a delegate.

**Parameters:**
- `keyDoc`: Signing key document of the issuer
- `options`:
  - `id`: Unique credential identifier
  - `issuer`: DID of the issuer
  - `@context`: JSON-LD context including delegation terms
  - `issuanceDate`: ISO timestamp
  - `type`: Array including 'DelegationCredential'
  - `credentialSubject`: Object containing:
    - `id`: DID of the delegate
    - `[MAY_CLAIM_IRI]`: Array of authorized claim names
    - Additional claims
  - `previousCredentialId`: Should be `null` for root credentials
  - `rootCredentialId`: Should be `null` for root credentials

**Returns:** Signed delegation credential

**Example:**
```javascript
const rootCredential = await issueDelegationCredential(issuerKey, {
  id: 'urn:uuid:12345678',
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
```

#### `issueDelegatedCredential(keyDoc, options)`

Issues a credential using delegated authority.

**Parameters:**
- `keyDoc`: Signing key document of the delegate
- `options`:
  - `id`: Unique credential identifier
  - `issuer`: DID of the delegate issuer
  - `@context`: JSON-LD context
  - `issuanceDate`: ISO timestamp
  - `type`: Array of credential types
  - `credentialSubject`: Object containing:
    - `id`: DID of the credential subject
    - Claims being issued
    - `[MAY_CLAIM_IRI]` (optional): For further delegation
  - `previousCredentialId`: ID of the delegating credential
  - `rootCredentialId`: ID of the root credential

**Returns:** Signed delegated credential

**Example:**
```javascript
const delegatedCredential = await issueDelegatedCredential(holderKey, {
  id: 'urn:uuid:87654321',
  issuer: holderDid,
  '@context': CREDIT_SCORE_CREDENTIAL_CONTEXT,
  issuanceDate: new Date().toISOString(),
  type: [
    'VerifiableCredential',
    'CreditScoreCredential',
    'DelegationCredential',
  ],
  credentialSubject: {
    id: agentDid,
    creditScore: 400,
    [MAY_CLAIM_IRI]: ['creditScore'], // For further delegation
  },
  previousCredentialId: rootCredential.id,
  rootCredentialId: rootCredential.id,
});
```

#### `createSignedPresentation(keyDoc, options)`

Creates a signed verifiable presentation containing delegated credentials.

**Parameters:**
- `keyDoc`: Signing key document of the holder
- `options`:
  - `credentials`: Array of credentials (must include full delegation chain)
  - `holderDid`: DID of the presentation holder
  - `challenge`: Challenge string for replay protection
  - `domain`: Domain string for binding

**Returns:** Signed verifiable presentation

**Example:**
```javascript
const presentation = await createSignedPresentation(agentKey, {
  credentials: [rootCredential, credDelegatedToAgent],
  holderDid: agentDid,
  challenge: 'test-challenge-123',
  domain: 'test.example.com',
});
```

#### `verifyDelegatablePresentation(presentation, options)`

Verifies a presentation containing delegated credentials.

**Parameters:**
- `presentation`: The verifiable presentation to verify
- `options`:
  - `challenge`: Expected challenge string
  - `domain`: Expected domain string
  - `policies` (optional): Cedar policies object

**Returns:** Verification result object containing:
- `verified`: Boolean indicating overall verification status
- `delegationResult`: Delegation verification result with:
  - `decision`: 'allow' or 'deny'
  - `summaries`: Array of delegation chain summaries
  - `failures`: Array of failure objects (if denied)
- `credentialResults`: Array of individual credential verification results

**Example:**
```javascript
const result = await verifyDelegatablePresentation(presentation, {
  challenge: CHALLENGE,
  domain: DOMAIN,
  policies,
});

console.log('Verified:', result.verified);
console.log('Decision:', result.delegationResult?.decision);
```

#### `createCedarPolicy(options)`

Creates Cedar policy rules for delegation authorization.

**Parameters:**
- `options`:
  - `maxDepth`: Maximum allowed delegation chain depth
  - `rootIssuer`: Required DID of the root issuer
  - `requiredClaims`: Object mapping claim names to required values:
    - Number values: minimum required value (e.g., `creditScore: 500`)
    - String values: exact required value (e.g., `role: "admin"`)
    - Any value: description of the claim requirement

**Returns:** Policy object with `staticPolicies` string

**Example:**
```javascript
const policies = createCedarPolicy({
  maxDepth: 2,
  rootIssuer: 'did:example:root-issuer',
  requiredClaims: {
    creditScore: 500,       // Minimum value
    role: 'admin',          // Exact match
    body: 'Issuer of Credits', // Description
  },
});
```

### Context Constants

#### `MAY_CLAIM_IRI`
The IRI used for the `mayClaim` property in credential subjects.
```javascript
const MAY_CLAIM_IRI = 'https://www.dock.io/rdf2020#mayClaim';
```

#### `DELEGATION_CONTEXT_TERMS`
Base JSON-LD terms for delegation credentials.

#### `W3C_CREDENTIALS_V1`
Standard W3C Verifiable Credentials context URL.


## Integration with Presentation Exchange (PEX)

Delegatable credentials can be used with Presentation Exchange to request specific delegation chains:

```javascript
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
              contains: { const: 'CreditScoreCredential' },
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
      purpose: 'Any number of additional credentials of the specified type',
      group: ['2'],
      constraints: {
        fields: [
          {
            path: ['$.type'],
            filter: {
              type: 'array',
              contains: { const: 'CreditScoreCredential' },
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
      min: 0,
    },
  ],
};

// Filter credentials that match the definition
const filterResult = await credentialService.filterCredentials({
  credentials: [rootCredential, credDelegatedToAgent],
  presentationDefinition,
  holderDid: agentDid,
});

// Create presentation
const presentation = await createSignedPresentation(agentKey, {
  credentials: [rootCredential, credDelegatedToAgent],
  holderDid: agentDid,
  challenge: CHALLENGE,
  domain: DOMAIN,
});

// Evaluate presentation against definition
const validationResults = await pexService.evaluatePresentation({
  presentation,
  presentationDefinition,
});
```

## Best Practices

1. **Always Include Full Chain**: When creating presentations with delegated credentials, include the complete delegation chain from root to leaf.

2. **Use Specific mayClaim Values**: Be explicit about which claims a delegate can issue. Avoid overly broad delegations.

3. **Implement Cedar Policies**: Use Cedar policies to enforce business rules like maximum delegation depth and claim requirements.

4. **Handle Verification Failures**: Check both the overall `verified` status and the `delegationResult.decision` to understand why verification failed.


## Testing

See `integration-tests/delegatable-credentials.test.ts` for comprehensive test examples including:

- Issuing valid delegation credentials
- Issuing delegated credentials with proper chain references
- Creating and verifying presentations with delegation chains
- Enforcing authorization with Cedar policies
- Handling unauthorized delegations
- Multi-level delegation chains
- Integration with Presentation Exchange

Run the tests with:
```bash
npm test integration-tests/delegatable-credentials.test.ts
```

## References

- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [Cedar Policy Language](https://www.cedarpolicy.com/)
- [Presentation Exchange](https://identity.foundation/presentation-exchange/)
