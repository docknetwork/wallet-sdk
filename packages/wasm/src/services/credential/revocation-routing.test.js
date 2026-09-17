/**
 * A StatusList2021 credential must not be routed into the accumulator checker:
 * getAccumulator can't resolve a status-list2021 id, and the throw used to be
 * swallowed, leaving a revoked credential reported as verified.
 */
const statusListCredential = {
  credentialStatus: {
    id: `status-list2021:dock:0x${'a'.repeat(64)}#3`,
    type: 'StatusList2021Entry',
    statusListIndex: '3',
    statusListCredential: 'https://api.example.com/status-list/1',
  },
};

const accumulatorCredential = {
  credentialStatus: {
    id: 'dock:accumulator:0x123',
    type: 'DockVBAccumulator2022',
    revocationId: '5',
  },
};

/** Mirrors the routing condition in service.ts verifyCredential. */
function routesToAccumulator(credential, verified = true) {
  const isStatusList2021 =
    credential.credentialStatus?.type === 'StatusList2021Entry';
  return Boolean(
    verified && credential.credentialStatus?.id && !isStatusList2021,
  );
}

describe('revocation checker routing', () => {
  it('does not send StatusList2021 credentials to the accumulator checker', () => {
    expect(routesToAccumulator(statusListCredential)).toBe(false);
  });

  it('still sends accumulator credentials to the accumulator checker', () => {
    expect(routesToAccumulator(accumulatorCredential)).toBe(true);
  });

  it('skips the check when the credential failed verification', () => {
    expect(routesToAccumulator(accumulatorCredential, false)).toBe(false);
  });

  it('skips the check when there is no credentialStatus', () => {
    expect(routesToAccumulator({})).toBe(false);
  });
});

describe('revoked status detection', () => {
  // credential-provider maps a verification error to CredentialStatus.Revoked
  // by matching this regex; both revocation paths must produce a match.
  const REVOKED = /\brevo(?:ke[sd]?|king|cations?)\b/;

  it('matches the StatusList2021 error from credential-sdk', () => {
    expect(
      REVOKED.test(
        'Credential was revoked (or suspended) according to the status list referenced in `credentialStatus`'.toLowerCase(),
      ),
    ).toBe(true);
  });

  it('matches the accumulator error from service.ts', () => {
    expect(
      REVOKED.test('revocation check: the credential is revoked'.toLowerCase()),
    ).toBe(true);
  });

  it('does not match unrelated words containing "revo"', () => {
    expect(REVOKED.test('revolutionary credential'.toLowerCase())).toBe(false);
  });
});
