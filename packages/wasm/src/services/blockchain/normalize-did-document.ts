// The universal resolver returns cheqd offchain (BBS+) keys as stringified
// blobs in the relationship arrays instead of objects in verificationMethod,
// leaving publicKeyBase58 unreachable. Lift them out, matching the on-chain
// resolver's CheqdDIDDocument.toDIDDocument behaviour.

const RELATIONSHIP_PROPS = [
  'assertionMethod',
  'authentication',
  'capabilityInvocation',
  'capabilityDelegation',
  'keyAgreement',
] as const;

function parseInlineVerificationMethod(entry: string): any | null {
  let parsed: unknown = entry;

  // cheqd offchain keys are double-JSON-stringified, so unwrap up to twice.
  for (let i = 0; i < 2 && typeof parsed === 'string'; i++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (parsed && typeof parsed === 'object' && typeof (parsed as any).id === 'string') {
    return parsed;
  }

  return null;
}

export function normalizeDIDDocument(doc: any): any {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }

  const liftedMethods: any[] = [];

  for (const prop of RELATIONSHIP_PROPS) {
    if (!Array.isArray(doc[prop])) {
      continue;
    }

    doc[prop] = doc[prop].map((entry: any) => {
      if (typeof entry !== 'string') {
        return entry;
      }

      const method = parseInlineVerificationMethod(entry);
      if (!method) {
        return entry;
      }

      liftedMethods.push(method);
      return method.id;
    });
  }

  if (liftedMethods.length) {
    const existing = Array.isArray(doc.verificationMethod)
      ? doc.verificationMethod
      : [];
    const existingIds = new Set(existing.map((method: any) => method?.id));
    const newMethods = liftedMethods.filter(
      method => !existingIds.has(method.id),
    );

    doc.verificationMethod = [...existing, ...newMethods];
  }

  return doc;
}
