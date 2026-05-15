export function resolveOfferedCredentialConfig(client) {
  const supported = client.getCredentialsSupported();
  const offerIds =
    client.credentialOffer?.credential_offer?.credential_configuration_ids ??
    client.credentialOffer?.credential_configuration_ids ??
    [];

  if (Array.isArray(supported)) {
    return supported[0];
  }

  const matched = offerIds.map(id => supported[id]).find(Boolean);
  return matched ?? Object.values(supported)[0];
}

export function resolveFormatAndType(config) {
  const format = config.format;
  const scopeTail = config.scope?.split(':').slice(-1)[0];
  const definitionType = config.credential_definition?.type?.slice(-1)[0];

  const credentialTypes =
    format === 'vc+sd-jwt' ? config.vct : definitionType ?? scopeTail;

  return {format, credentialTypes};
}
