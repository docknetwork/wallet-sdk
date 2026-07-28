import {
  createFullWalletClient,
  closeWallet,
} from './helpers/wallet-helpers';
import {issueCredential} from '@docknetwork/wallet-sdk-core/src/delegation/delegation-issuance';
import {
  isDelegatableCredentialRevoked,
  revokeDelegatableCredential,
  unrevokeDelegatableCredential,
  RevocationContext,
} from '@docknetwork/wallet-sdk-core/src/delegation/delegation-revocation';
import {
  TRAVEL_AGENCY_CONTEXT,
  travelAgencyPolicy,
} from './delegation/delegation-fixtures';
// @ts-ignore - runtime resolved via jest moduleNameMapper to dist/cjs/vc/contexts.cjs; no shipped types
import cachedUris from '@docknetwork/credential-sdk/vc/contexts';

function evictStatusListCache(credential: any) {
  const url = credential?.credentialStatus?.statusListCredential;
  if (url) cachedUris.delete(url.endsWith('/') ? url.slice(0, -1) : url);
}

const SPONSOR_KEY = process.env.TRUVERA_API_SPONSOR_KEY;
const API_URL = process.env.DELEGATION_REVOCATION_API_URL;

const ROLE_ID = 'e79c0d16-8739-4e54-94d7-53d9f1c97c71';

async function issueRevocableRootCredential(walletClient, ctx: RevocationContext) {
  const credentialData = {
    '@context': TRAVEL_AGENCY_CONTEXT,
    type: ['VerifiableCredential', 'TravelAgencyCredential', 'DelegationCredential'],
    issuer: {id: ctx.issuerDID, name: 'Travel Agency'},
    credentialSubject: {
      id: 'did:test:travel-agency',
      allowedRoutes: ['US-NYC-LAX'],
      purchaseLimit: 10000,
    },
    issuanceDate: new Date().toISOString(),
  };

  const [issuerKey] = await walletClient.didProvider.getDIDKeyPairs();
  // status list entry is allocated + embedded automatically from the context
  const credential = await issueCredential(
    credentialData,
    issuerKey,
    travelAgencyPolicy,
    ROLE_ID,
    undefined,
    ctx,
  );
  await walletClient.wallet.addDocument(credential);
  return credential as any;
}

describe('Delegatable Revocation', () => {
  let walletClient;
  let ctx: RevocationContext;

  beforeAll(async () => {
    if (!SPONSOR_KEY || !API_URL) {
      throw new Error(
        'Missing required environment variables: TRUVERA_API_SPONSOR_KEY and DELEGATION_REVOCATION_API_URL',
      );
    }

    walletClient = await createFullWalletClient();
    ctx = {
      wallet: walletClient.wallet,
      issuerDID: walletClient.did,
      truveraApiConfigs: {
        authKey: SPONSOR_KEY as string,
        apiUrl: API_URL as string,
      },
    };
  });

  afterAll(async () => {
    await closeWallet(walletClient?.wallet);
  });

  it('should issue a delegatable credential and revoke/unrevoke it', async () => {
    const credential = await issueRevocableRootCredential(walletClient, ctx);

    // status entry embedded at issuance
    expect(credential.credentialStatus).toBeDefined();
    expect(credential.credentialStatus.type).toBe('StatusList2021Entry');
    expect(credential.credentialStatus.statusPurpose).toBe('revocation');
    expect(typeof credential.credentialStatus.statusListIndex).toBe('string');
    expect(credential.credentialStatus.statusListCredential).toContain('http');

    // not revoked initially
    expect(await isDelegatableCredentialRevoked(credential)).toBe(false);

    // revoke -> revoked
    await revokeDelegatableCredential(credential, ctx);
    expect(await isDelegatableCredentialRevoked(credential)).toBe(true);

    // unrevoke -> not revoked
    await unrevokeDelegatableCredential(credential, ctx);
    expect(await isDelegatableCredentialRevoked(credential)).toBe(false);
  });

  it('should resolve revocation via credentialProvider.isValid', async () => {
    const credential = await issueRevocableRootCredential(walletClient, ctx);

    expect((await walletClient.credentialProvider.isValid(credential)).status).toBe(
      'verified',
    );

    await revokeDelegatableCredential(credential, ctx);
    evictStatusListCache(credential);
    expect((await walletClient.credentialProvider.isValid(credential)).status).toBe(
      'revoked',
    );

    await unrevokeDelegatableCredential(credential, ctx);
    evictStatusListCache(credential);
    expect((await walletClient.credentialProvider.isValid(credential)).status).toBe(
      'verified',
    );
  });

  it('should assign sequential indices across issuances', async () => {
    const first = await issueRevocableRootCredential(walletClient, ctx);
    const second = await issueRevocableRootCredential(walletClient, ctx);

    const firstIndex = Number(first.credentialStatus.statusListIndex);
    const secondIndex = Number(second.credentialStatus.statusListIndex);
    expect(secondIndex).toBe(firstIndex + 1);
  });
});
