// @ts-nocheck
import * as cedar from '@cedar-policy/cedar-wasm/nodejs';
import {
  verifyPresentation,
  issueCredential,
  signPresentation,
  documentLoader,
  getSuiteFromKeyDoc,
} from '@docknetwork/credential-sdk/vc';
import { MAY_CLAIM_IRI } from '@docknetwork/vc-delegation-engine';
import { getKeypairFromDoc } from '@docknetwork/universal-wallet/methods/keypairs';
import { blockchainService } from '../blockchain/service';

/**
 * Prepares a key document for signing by creating a proper keypair with signer capability
 * @param keyDoc - The key document with id, controller, type, and key material
 * @returns A key document with an active signer
 */
function prepareKeyForSigning(keyDoc: KeyPair): any {
  const kp = getKeypairFromDoc(keyDoc);
  // Get the signer from the keypair - this returns an object with id and sign method
  const signer = kp.signer();
  // Set the id on the signer to match the verification method
  signer.id = keyDoc.id;
  return {
    ...keyDoc,
    keypair: kp,
    signer,
  };
}

export interface VerificationResult {
  verified: boolean;
  credentialResults?: any[];
  delegationResult?: {
    decision: string;
    summaries?: any[];
    authorizations?: any[];
    failures?: any[];
  };
  error?: any;
}

export interface CedarPolicies {
  staticPolicies: string;
}

export interface VerifiablePresentation {
  '@context': any[];
  type: string[];
  proof?: any;
  verifiableCredential?: any[];
}

export interface DelegationCredential {
  '@context': any[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  previousCredentialId: string | null;
  rootCredentialId: string;
  credentialSubject: {
    id: string;
    [key: string]: any;
  };
  proof?: any;
}

export interface VerifyDelegationOptions {
  challenge?: string;
  domain?: string;
  unsignedPresentation?: boolean;
  failOnUnauthorizedClaims?: boolean;
  policies?: CedarPolicies;
}

export interface KeyPair {
  type: string;
  id?: string;
  controller?: string;
  publicKeyJwk?: any;
  privateKeyJwk?: any;
  publicKeyBase58?: string;
  privateKeyBase58?: string;
}

/**
 * W3C Credentials V1 context URL
 */
export const W3C_CREDENTIALS_V1 = 'https://www.w3.org/2018/credentials/v1';

/**
 * Re-export MAY_CLAIM_IRI for use in credentials
 */
export { MAY_CLAIM_IRI };

/**
 * Namespace used by the vc-delegation-engine for delegation properties
 */
export const DELEGATION_ENGINE_NS = 'https://ld.truvera.io/credentials/delegation#';

/**
 * Base delegation context terms required for delegation credentials.
 * These terms define the JSON-LD mappings needed for the vc-delegation-engine
 * to properly process delegation chains.
 *
 * Use this as a base and extend with your own application-specific terms:
 * @example
 * const myContext = [
 *   W3C_CREDENTIALS_V1,
 *   {
 *     ...DELEGATION_CONTEXT_TERMS,
 *     // Add your custom terms here
 *     MyCredentialType: 'https://example.org/MyCredentialType',
 *     myField: 'https://example.org/myField',
 *   },
 * ];
 */
export const DELEGATION_CONTEXT_TERMS = {
  '@version': 1.1,
  '@protected': true,
  DelegationCredential: `${DELEGATION_ENGINE_NS}DelegationCredential`,
  mayClaim: { '@id': MAY_CLAIM_IRI, '@container': '@set' },
  rootCredentialId: { '@id': `${DELEGATION_ENGINE_NS}rootCredentialId`, '@type': '@id' },
  previousCredentialId: { '@id': `${DELEGATION_ENGINE_NS}previousCredentialId`, '@type': '@id' },
};

/**
 * Default context for verifiable presentations
 */
export const PRESENTATION_CONTEXT = [W3C_CREDENTIALS_V1];

/**
 * Issues a delegation credential that grants authority to a delegate
 * @param keyPair - The key pair to sign the credential
 * @param params - Delegation parameters
 * @returns Signed delegation credential
 */
export async function issueDelegationCredential(
  keyPair: KeyPair,
  credential: any
): Promise<DelegationCredential> {
  const preparedKey = prepareKeyForSigning(keyPair);
  return issueCredential(preparedKey, credential);
}

/**
 * Issues a credential as a delegate (with delegation chain reference)
 * @param keyPair - The delegate's key pair to sign the credential
 * @param params - Credential parameters
 * @returns Signed credential
 */
export async function issueDelegatedCredential(
  keyPair: KeyPair,
  credential: any
): Promise<any> {
  const preparedKey = prepareKeyForSigning(keyPair);
  return issueCredential(preparedKey, credential);
}

/**
 * Creates and signs a verifiable presentation with delegation credentials
 * @param keyPair - The key pair to sign the presentation
 * @param params - Presentation parameters
 * @returns Signed verifiable presentation
 */
export async function createSignedPresentation(
  keyPair: KeyPair,
  params: {
    credentials: any[];
    holderDid: string;
    challenge: string;
    domain: string;
    context?: any[];
  }
): Promise<VerifiablePresentation> {
  const {
    credentials,
    holderDid,
    challenge,
    domain,
    context = PRESENTATION_CONTEXT,
  } = params;

  const presentation = {
    '@context': context,
    type: ['VerifiablePresentation'],
    holder: holderDid,
    verifiableCredential: credentials,
  };

  // Create key document for signing with proper keypair
  const keyDoc = {
    ...keyPair,
    id: keyPair.id || `${holderDid}#keys-1`,
    controller: keyPair.controller || holderDid,
  };

  const preparedKey = prepareKeyForSigning(keyDoc);
  return signPresentation(presentation, preparedKey, challenge, domain);
}

/**
 * Verifies a verifiable presentation with optional delegation chain validation
 * Uses the credential-sdk's verifyPresentation which automatically:
 * 1. Verifies the presentation signature
 * 2. Verifies all credentials
 * 3. Detects delegation credentials
 * 4. Validates the delegation chain
 * 5. Applies Cedar policies if provided
 *
 * @param vp - The verifiable presentation to verify
 * @param options - Verification options
 * @returns Verification result with delegation info if applicable
 */
export async function verifyDelegatablePresentation(
  vp: VerifiablePresentation,
  options: VerifyDelegationOptions = {}
): Promise<VerificationResult> {
  const {
    challenge = vp.proof?.challenge || 'default-challenge',
    domain = vp.proof?.domain || 'default-domain',
    unsignedPresentation = false,
    failOnUnauthorizedClaims = true,
    policies,
  } = options;

  const verifyOptions: any = {
    challenge,
    domain,
    documentLoader: documentLoader(blockchainService.resolver),
    unsignedPresentation,
    failOnUnauthorizedClaims,
  };

  // Add Cedar authorization if policies are provided
  if (policies) {
    verifyOptions.cedarAuth = {
      policies,
      cedar,
    };
  }

  return verifyPresentation(vp, verifyOptions);
}

/**
 * Creates a Cedar policy for delegation verification
 * @param config - Policy configuration
 * @returns Cedar policy object
 */
export function createCedarPolicy(config: {
  maxDepth?: number;
  rootIssuer: string;
  requiredClaims?: Record<string, any>;
}): CedarPolicies {
  const { maxDepth = 2, rootIssuer, requiredClaims = {} } = config;

  let claimsConditions = '';
  for (const [key, value] of Object.entries(requiredClaims)) {
    if (typeof value === 'number') {
      claimsConditions += ` &&\n  context.authorizedClaims.${key} >= ${value}`;
    } else if (typeof value === 'string') {
      claimsConditions += ` &&\n  context.authorizedClaims.${key} == "${value}"`;
    }
  }

  const policyText = `
permit(
  principal in Credential::Chain::"Action:Verify",
  action == Credential::Action::"Verify",
  resource
) when {
  principal == context.vpSigner &&
  context.tailDepth <= ${maxDepth} &&
  context.rootIssuer == Credential::Actor::"${rootIssuer}"${claimsConditions}
};
`;

  return { staticPolicies: policyText };
}

/**
 * Creates an unsigned verifiable presentation (for testing)
 * @param credentials - Array of credentials to include
 * @param proof - Optional proof object
 * @param context - Optional context
 * @returns Verifiable presentation object
 */
export function createUnsignedPresentation(
  credentials: any[],
  proof?: any,
  context: any[] = PRESENTATION_CONTEXT
): VerifiablePresentation {
  const vp: VerifiablePresentation = {
    '@context': context,
    type: ['VerifiablePresentation'],
    verifiableCredential: credentials,
  };

  if (proof) {
    vp.proof = proof;
  }

  return vp;
}

/**
 * Re-export cedar for use in tests and external code
 */
export { cedar };

/**
 * Service class for delegatable credentials operations
 */
class DelegatableCredentialsService {
  name = 'delegatable-credentials';

  rpcMethods = [
    DelegatableCredentialsService.prototype.issueDelegation,
    DelegatableCredentialsService.prototype.issueDelegatedCredential,
    DelegatableCredentialsService.prototype.createPresentation,
    DelegatableCredentialsService.prototype.verifyPresentation,
    DelegatableCredentialsService.prototype.createPolicy,
  ];

  /**
   * Issues a delegation credential
   */
  async issueDelegation(params: {
    keyPair: KeyPair;
    id: string;
    issuerDid: string;
    delegateDid: string;
    mayClaim: string[];
    context: any[];
    types: string[];
    additionalSubjectProperties?: Record<string, any>;
    previousCredentialId?: string | null;
    rootCredentialId?: string;
  }): Promise<DelegationCredential> {
    return issueDelegationCredential(params.keyPair, params);
  }

  /**
   * Issues a credential as a delegate
   */
  async issueDelegatedCredential(params: {
    keyPair: KeyPair;
    id: string;
    issuerDid: string;
    subjectDid: string;
    claims: Record<string, any>;
    rootCredentialId: string;
    previousCredentialId: string;
    context: any[];
    types: string[];
  }): Promise<any> {
    return issueDelegatedCredential(params.keyPair, params);
  }

  /**
   * Creates and signs a verifiable presentation
   */
  async createPresentation(params: {
    keyPair: KeyPair;
    credentials: any[];
    holderDid: string;
    challenge: string;
    domain: string;
    context?: any[];
  }): Promise<VerifiablePresentation> {
    return createSignedPresentation(params.keyPair, params);
  }

  /**
   * Verifies a verifiable presentation with delegation chain
   */
  async verifyPresentation(params: {
    presentation: VerifiablePresentation;
    challenge?: string;
    domain?: string;
    unsignedPresentation?: boolean;
    failOnUnauthorizedClaims?: boolean;
    policies?: CedarPolicies;
  }): Promise<VerificationResult> {
    return verifyDelegatablePresentation(params.presentation, {
      challenge: params.challenge,
      domain: params.domain,
      unsignedPresentation: params.unsignedPresentation,
      failOnUnauthorizedClaims: params.failOnUnauthorizedClaims,
      policies: params.policies,
    });
  }

  /**
   * Creates a Cedar policy for delegation verification
   */
  createPolicy(params: {
    maxDepth?: number;
    rootIssuer: string;
    requiredClaims?: Record<string, any>;
  }): CedarPolicies {
    return createCedarPolicy(params);
  }
}

export const delegatableCredentialsService = new DelegatableCredentialsService();