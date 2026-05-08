import {CapabilityGrant} from './delegation-types';

export const DELEGATION_CONTEXT = 'https://ld.truvera.io/credentials/delegation';

export function isDelegatableCredential(credential): boolean {
  return (
    Array.isArray(credential?.['@context']) &&
    credential['@context'].includes(DELEGATION_CONTEXT)
  );
}
