// Universal resolvers can return verification methods (e.g. cheqd offchain
// BBS+ keys) inside the relationship arrays instead of in verificationMethod,
// either as JSON-stringified blobs or as embedded objects. Both leave
// publicKeyBase58 unreachable for BBS+ verification, which looks keys up in
// verificationMethod. Lift them out and leave the id as a reference, matching
// the on-chain resolver's CheqdDIDDocument.toDIDDocument behaviour.

const RELATIONSHIP_PROPS = [
  'assertionMethod',
  'authentication',
  'capabilityInvocation',
  'capabilityDelegation',
  'keyAgreement',
] as const;

function isEmbeddedVerificationMethod(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).type === 'string'
  );
}

function parseInlineVerificationMethod(entry: unknown): any | null {
  if (isEmbeddedVerificationMethod(entry)) {
    return entry;
  }

  if (typeof entry !== 'string') {
    return null;
  }

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
    const seenIds = new Set(existing.map((method: any) => method?.id));
    const newMethods = liftedMethods.filter(method => {
      if (seenIds.has(method.id)) {
        return false;
      }
      seenIds.add(method.id);
      return true;
    });

    doc.verificationMethod = [...existing, ...newMethods];
  }

  return doc;
}
