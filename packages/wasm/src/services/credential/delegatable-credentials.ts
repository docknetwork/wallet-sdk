// @ts-nocheck
import jsonld from 'jsonld';
import * as cedar from '@cedar-policy/cedar-wasm/nodejs';
import {
  verifyVPWithDelegation,
  authorizeEvaluationsWithCedar,
} from '@docknetwork/vc-delegation-engine';

export interface DocumentLoaderResult {
  contextUrl: string | null;
  documentUrl: string;
  document: any;
}

export interface VerificationResult {
  decision: string;
  failures?: any[];
  evaluations?: any[];
  authorizations?: any[];
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
  previousCredentialId: string | null;
  rootCredentialId: string;
  credentialSubject: {
    id: string;
    [key: string]: any;
  };
}

/**
 * Default document loader that fetches JSON-LD contexts from URLs
 * Falls back to minimal context structure for unavailable URLs
 */
export async function defaultDocumentLoader(
  url: string
): Promise<DocumentLoaderResult> {
  const urlString = url.toString();

  // Try to fetch from the web first
  if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
    try {
      const response = await fetch(urlString);
      if (response.ok) {
        const document = await response.json();
        return {
          contextUrl: null,
          documentUrl: urlString,
          document,
        };
      }
    } catch (error) {
      // Fall through to return empty context
    }
  }

  // Return minimal context structure for known URLs
  return {
    contextUrl: null,
    documentUrl: urlString,
    document: {
      '@context': {
        '@version': 1.1,
      },
    },
  };
}

/**
 * Verifies a verifiable presentation with delegation chain validation
 * @param vp - The verifiable presentation to verify
 * @param options - Optional configuration
 * @param options.documentLoader - Custom document loader function
 * @param options.policies - Cedar policies for authorization
 * @returns Verification result with decision and any failures
 */
export async function verifyDelegatablePresentation(
  vp: VerifiablePresentation,
  options: {
    documentLoader?: (url: string) => Promise<DocumentLoaderResult>;
    policies?: CedarPolicies;
  } = {}
): Promise<VerificationResult> {
  const documentLoader = options.documentLoader || defaultDocumentLoader;

  const expandedPresentation = await jsonld.expand(vp, { documentLoader });
  const credentialContexts = new Map<string, any>();

  (vp.verifiableCredential ?? []).forEach((vc: any) => {
    if (vc && typeof vc.id === 'string' && vc['@context']) {
      credentialContexts.set(vc.id, vc['@context']);
    }
  });

  const result = await verifyVPWithDelegation({
    expandedPresentation,
    credentialContexts,
    documentLoader,
  });

  if (result.failures && result.failures.length > 0) {
    return { ...result, decision: 'deny' };
  }

  let decision = result.decision;
  let authorizations: any[] = [];

  if (options.policies) {
    const authorizationOutcome = authorizeEvaluationsWithCedar({
      cedar,
      evaluations: result.evaluations,
      policies: options.policies,
    });
    decision = authorizationOutcome.decision;
    authorizations = authorizationOutcome.authorizations;
  }

  return { ...result, decision, authorizations };
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
 * Creates a verifiable presentation for delegation
 * @param credentials - Array of credentials to include
 * @param proof - Proof object for the presentation
 * @param context - Optional additional context
 * @returns Verifiable presentation object
 */
export function createDelegatablePresentation(
  credentials: any[],
  proof: any,
  context: any[] = ['https://www.w3.org/2018/credentials/v1']
): VerifiablePresentation {
  return {
    '@context': context,
    type: ['VerifiablePresentation'],
    proof,
    verifiableCredential: credentials,
  };
}

/**
 * Delegation namespace for credential chain properties
 */
const DELEGATION_NAMESPACE = 'https://ld.truvera.io/credentials/delegation#';

/**
 * Pre-defined context for credit delegation credentials
 */
export const CREDIT_DELEGATION_CONTEXT = [
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
export const CREDIT_SCORE_CONTEXT = [
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
export const PRESENTATION_CONTEXT = ['https://www.w3.org/2018/credentials/v1'];

/**
 * Creates a delegation credential
 * @param params - Delegation credential parameters
 * @returns Delegation credential object
 */
export function createDelegationCredential(params: {
  id: string;
  context?: any[];
  types?: string[];
  issuer: string;
  subjectId: string;
  mayClaim: string[];
  additionalSubjectProperties?: Record<string, any>;
  previousCredentialId?: string | null;
  rootCredentialId?: string;
}): DelegationCredential {
  const {
    id,
    context = CREDIT_DELEGATION_CONTEXT,
    types = ['VerifiableCredential', 'CreditScoreDelegation', 'DelegationCredential'],
    issuer,
    subjectId,
    mayClaim,
    additionalSubjectProperties = {},
    previousCredentialId = null,
    rootCredentialId,
  } = params;

  return {
    '@context': context,
    id,
    type: types,
    issuer,
    previousCredentialId,
    rootCredentialId: rootCredentialId || id,
    credentialSubject: {
      id: subjectId,
      'https://rdf.dock.io/alpha/2021#mayClaim': mayClaim,
      ...additionalSubjectProperties,
    },
  };
}

/**
 * Creates an Ed25519 proof object for presentations
 * @param params - Proof parameters
 * @returns Proof object
 */
export function createEd25519Proof(params: {
  verificationMethod: string;
  challenge: string;
  domain: string;
  created?: string;
  jws?: string;
}): any {
  return {
    type: 'Ed25519Signature2018',
    created: params.created || new Date().toISOString(),
    verificationMethod: params.verificationMethod,
    proofPurpose: 'authentication',
    challenge: params.challenge,
    domain: params.domain,
    jws: params.jws || 'placeholder..signature',
  };
}

/**
 * Service class for delegatable credentials operations
 */
class DelegatableCredentialsService {
  name = 'delegatable-credentials';

  rpcMethods = [
    DelegatableCredentialsService.prototype.verifyPresentation,
    DelegatableCredentialsService.prototype.createPolicy,
    DelegatableCredentialsService.prototype.createPresentation,
    DelegatableCredentialsService.prototype.createDelegation,
  ];

  /**
   * Verifies a verifiable presentation with delegation chain
   */
  async verifyPresentation(params: {
    presentation: VerifiablePresentation;
    policies?: CedarPolicies;
    documentLoader?: (url: string) => Promise<DocumentLoaderResult>;
  }): Promise<VerificationResult> {
    return verifyDelegatablePresentation(params.presentation, {
      policies: params.policies,
      documentLoader: params.documentLoader,
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

  /**
   * Creates a verifiable presentation for delegation
   */
  createPresentation(params: {
    credentials: any[];
    proof: any;
    context?: any[];
  }): VerifiablePresentation {
    return createDelegatablePresentation(
      params.credentials,
      params.proof,
      params.context
    );
  }

  /**
   * Creates a delegation credential
   */
  createDelegation(params: {
    id: string;
    context?: any[];
    types?: string[];
    issuer: string;
    subjectId: string;
    mayClaim: string[];
    additionalSubjectProperties?: Record<string, any>;
    previousCredentialId?: string | null;
    rootCredentialId?: string;
  }): DelegationCredential {
    return createDelegationCredential(params);
  }
}

export const delegatableCredentialsService = new DelegatableCredentialsService();
