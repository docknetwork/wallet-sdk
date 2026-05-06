import {CapabilityGrant} from './delegation-types';

export const DELEGATION_CONTEXT = 'https://ld.truvera.io/credentials/delegation';

export function isDelegatableCredential(credential): boolean {
  return (
    Array.isArray(credential?.['@context']) &&
    credential['@context'].includes(DELEGATION_CONTEXT)
  );
}

/**
 * For an array-shaped capability grant, return the values to display.
 * If the schema's items have an `enum`, those win. Otherwise fall back to
 * the holder context (e.g. "Allowed Routes" — values come from runtime,
 * not the schema).
 */
export function getGrantValues(
  grant: CapabilityGrant,
  holderValues?: Record<string, string[] | undefined>,
): string[] | undefined {
  const items = (grant.schema as {items?: {enum?: unknown[]}}).items;
  if (Array.isArray(items?.enum)) return items.enum.map(String);
  return holderValues?.[grant.capability];
}
