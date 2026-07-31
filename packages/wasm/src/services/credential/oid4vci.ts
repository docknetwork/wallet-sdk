function assertHttps(url, label) {
  if (!url) {
    return;
  }
  const {protocol, origin} = new URL(url);
  if (protocol !== 'https:') {
    throw new Error(
      `Only HTTPS is allowed for OID4VCI ${label}, got: ${origin}`,
    );
  }
}

export function enforceOfferUriHttps(uri, allowInsecureHttpRequests) {
  if (allowInsecureHttpRequests) {
    return;
  }
  const offerUri = new URL(uri).searchParams.get('credential_offer_uri');
  assertHttps(offerUri, 'credential_offer_uri');
}

export function enforceIssuerHttps(client, allowInsecureHttpRequests) {
  if (allowInsecureHttpRequests) {
    return;
  }
  assertHttps(client.getIssuer(), 'credential_issuer');
}

export function resolveOfferedCredentialConfig(client) {
  const supported = client.getCredentialsSupported();
  const offerIds =
    client.credentialOffer?.credential_offer?.credential_configuration_ids ??
    client.credentialOffer?.credential_configuration_ids ??
    [];

  if (Array.isArray(supported)) {
    const matchedLegacy = supported.find(
      entry => entry?.id && offerIds.includes(entry.id),
    );
    return matchedLegacy ?? supported[0];
  }

  const matched = offerIds.map(id => supported[id]).find(Boolean);
  return matched ?? Object.values(supported)[0];
}

const KNOWN_FORMATS = new Set([
  'vc+sd-jwt',
  'dc+sd-jwt',
  'ldp_vc',
  'jwt_vc_json',
  'jwt_vc_json-ld',
  'jwt_vc',
]);

export function resolveFormatAndType(config) {
  const scopeSegments = config.scope?.split(':') ?? [];
  const scopeTail = scopeSegments.slice(-1)[0];
  const scopePrefix = scopeSegments.length > 1 ? scopeSegments[0] : undefined;
  const definitionType = config.credential_definition?.type?.slice(-1)[0];

  const format =
    config.format ??
    (scopePrefix && KNOWN_FORMATS.has(scopePrefix) ? scopePrefix : 'ldp_vc');

  const credentialTypes =
    format === 'vc+sd-jwt' || format === 'dc+sd-jwt'
      ? config.vct
      : definitionType ?? scopeTail;

  return {format, credentialTypes};
}
