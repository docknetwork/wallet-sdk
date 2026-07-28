const bs58 = require('base58-universal');
const {Secp256r1Keypair} = require('@docknetwork/credential-sdk/keypairs');
const {createWallet} = require('./wallet');
const {createDIDProvider} = require('./did-provider');
const {
  createDataStore,
} = require('@docknetwork/wallet-sdk-data-store-typeorm/src');

describe('DID Provider - createSigningKey / signWithKeyId', () => {
  let wallet;
  let didProvider;
  const controller = 'did:key:z6MkjjCpsoQrwnEmqHzLdxWowXk5gjbwor4urC1RPDmGeV8r';

  beforeEach(async () => {
    wallet = await createWallet({
      dataStore: await createDataStore({
        databasePath: ':memory:',
      }),
    });
    didProvider = createDIDProvider({wallet});
  });

  it('expect to create a secp256r1 signing key and sign with it', async () => {
    const keyDoc = await didProvider.createSigningKey({controller});

    expect(keyDoc.controller).toEqual(controller);
    expect(keyDoc.type).toEqual('EcdsaSecp256r1VerificationKey2019');
    expect(keyDoc.publicKeyBase58).toBeDefined();
    expect(keyDoc.privateKeyBase58).toBeDefined();

    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const signature = await didProvider.signWithKeyId({
      keyId: keyDoc.id,
      data,
    });

    expect(signature).toBeInstanceOf(Uint8Array);

    const publicKeyBytes = bs58.decode(keyDoc.publicKeyBase58);
    expect(Secp256r1Keypair.verify(data, signature, publicKeyBytes)).toBe(true);

    // A signature over different data must not verify.
    expect(
      Secp256r1Keypair.verify(
        new Uint8Array([9, 9, 9]),
        signature,
        publicKeyBytes,
      ),
    ).toBe(false);
  });

  it('expect to reject an invalid controller', async () => {
    await expect(
      didProvider.createSigningKey({controller: 'not-a-did'}),
    ).rejects.toThrow(/valid DID/);
  });

  it('expect to reject signing with an unknown keyId', async () => {
    await expect(
      didProvider.signWithKeyId({
        keyId: 'does-not-exist',
        data: new Uint8Array([1]),
      }),
    ).rejects.toThrow('No stored key document found');
  });
});
