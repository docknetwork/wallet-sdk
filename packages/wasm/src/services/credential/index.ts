// @ts-nocheck
import {credentialService} from './service';

// TODO: rename it to credentialService, will need to update dock-app
export const credentialServiceRPC = credentialService;

export {
  delegatableCredentialsService,
  verifyDelegatablePresentation,
  issueDelegationCredential,
  issueDelegatedCredential,
  createSignedPresentation,
  createUnsignedPresentation,
  createCedarPolicy,
  cedar,
  MAY_CLAIM_IRI,
  W3C_CREDENTIALS_V1,
  DELEGATION_ENGINE_NS,
  DELEGATION_CONTEXT_TERMS,
  PRESENTATION_CONTEXT,
} from './delegatable-credentials';
