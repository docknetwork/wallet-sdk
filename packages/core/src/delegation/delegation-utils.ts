import assert from 'assert';

/**
 * Check if a given credential is delegatable
 * @param credential - The credential to check
 * @returns A boolean indicating whether the credential is delegatable
 */
export function isDelegatableCredential(credential) {
  const context = credential['@context'];

  assert(
    Array.isArray(context),
    'Credential @context must be an array of strings or objects',
  );

  const delegationContext = 'https://ld.truvera.io/credentials/delegation';

  if (context.includes(delegationContext)) {
    return true;
  }

  return false;
}
