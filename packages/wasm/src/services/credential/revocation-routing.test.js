/**
 * A StatusList2021 credential must not be routed into the accumulator checker:
 * getAccumulator can't resolve a status-list2021 id, and the throw used to be
 * swallowed, leaving a revoked credential reported as verified.
 *
 * ts-jest emits native ESM for service.ts, so jest.mock can't replace its
 * `getIsRevoked` binding. Instead we drive the real accumulator path and observe
 * the blockchain call it makes — the same seam bbs-revocation.test.js uses.
 */
import {
  credentialService as service,
  credentialUtils as serviceCredentialUtils,
} from './service';
import {blockchainService} from '../blockchain/service';

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

describe('revocation checker routing', () => {
  let verifySpy;
  let getAccumulator;
  let originalModules;

  beforeEach(() => {
    getAccumulator = jest.fn().mockResolvedValue(null);
    originalModules = blockchainService.modules;
    blockchainService.modules = {accumulator: {getAccumulator}};
    verifySpy = jest
      .spyOn(serviceCredentialUtils, 'verifyCredential')
      .mockResolvedValue({verified: true});
  });

  afterEach(() => {
    blockchainService.modules = originalModules;
    verifySpy.mockRestore();
  });

  it('does not send StatusList2021 credentials to the accumulator checker', async () => {
    const result = await service.verifyCredential({
      credential: statusListCredential,
    });

    expect(getAccumulator).not.toHaveBeenCalled();
    expect(result.verified).toBe(true);
    // Issuer matching is skipped for status-list2021: the status list credential
    // is issued by the status list owner, not the credential issuer.
    expect(verifySpy).toHaveBeenCalledWith(
      statusListCredential,
      expect.objectContaining({verifyMatchingIssuersForRevocation: false}),
    );
  });

  it('sends accumulator credentials to the accumulator checker', async () => {
    await service.verifyCredential({
      credential: accumulatorCredential,
      membershipWitness: JSON.stringify({witness: '0xaabbcc', blockNo: '1'}),
    });

    expect(getAccumulator).toHaveBeenCalledWith(
      accumulatorCredential.credentialStatus.id,
      false,
    );
    expect(verifySpy).toHaveBeenCalledWith(
      accumulatorCredential,
      expect.objectContaining({verifyMatchingIssuersForRevocation: true}),
    );
  });

  it('skips the check when the credential failed verification', async () => {
    verifySpy.mockResolvedValue({verified: false});

    await service.verifyCredential({credential: accumulatorCredential});

    expect(getAccumulator).not.toHaveBeenCalled();
  });

  it('skips the check when there is no credentialStatus', async () => {
    await service.verifyCredential({credential: {id: 'urn:1'}});

    expect(getAccumulator).not.toHaveBeenCalled();
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
