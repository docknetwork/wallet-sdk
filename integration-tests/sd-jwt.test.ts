import { decodeSDJWT } from '@docknetwork/wallet-sdk-wasm/src/services/credential/sd-jwt';
import {
  BasicCredential,
  PolygonIDCredential,
  UniversityDegreeCredential,
  UniversityDegreeCredentialBBS,
} from './data/credentials';
import {
  addCredentialIfNotExists,
  cleanup,
  closeWallet,
  getCredentialProvider,
  getWallet,
} from './helpers';
import {ProofTemplateIds, createProofRequest} from './helpers/certs-helpers';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';


describe('SD JWT Credentials', () => {
  let wallet;
  let credentialId;
  const jwt =
    'eyJ0eXAiOiJ2YytzZC1qd3QiLCJraWQiOiJkaWQ6Y2hlcWQ6dGVzdG5ldDpjMDg5MGYxYy1jN2JiLTRlYTYtYmU3YS04YzMxNDA0NzQzYjcja2V5cy0xIiwiYWxnIjoiRWREU0EifQ.eyJpYXQiOjE3NTk0MTQzOTQsImlzcyI6ImRpZDpjaGVxZDp0ZXN0bmV0OmMwODkwZjFjLWM3YmItNGVhNi1iZTdhLThjMzE0MDQ3NDNiNyNrZXlzLTEiLCJ2Y3QiOiJJbnRlcm5hbFRlc3RpbmciLCJfc2QiOlsiM3JVUGt1Mk5XckFFeTV3ZE9uVms5TkJBa0haMWE4RDB6Y2liMFNQdmthWSIsIkhjNHAxMnZTTWNMQ0piNVRYVlFrdFFMR2xjM0J3SDNWN2ltakV5ZDdvdzAiLCJNZWNNZEd6NjAxY3kwTTdvanRtSjR1LUI5LTJxSXAya1RvbFpDUm1GZ1pFIiwiZmo4WHdBb0lERmRsWmpEa0NTVzVpeXBPYUZBcVplTWZDRncwTWd3cHhOQSJdLCJfc2RfYWxnIjoic2hhLTI1NiJ9.FcYvNrldceL5BTNmoIaS4Mub8a5NcbiseUeSmmvUpOW8SUom-bchV5AEefrH1VMECbdc2whhk2sW4_jmZo7_Dw~WyI1YTRkZWY1MTAzYjRiYjc0IiwiaWQiLCJkaWQ6a2V5Ono2TWt1OVI4emRBOExENmhjRlhrbjQ3akxuZmNLWk5HbXdhVHJEbmFDQmtTYjhVbiJd~WyJiZDUyMjQ5ZjAyNjk3NWRkIiwiZGF0ZSIsIjIwMjUtMTAtMDkiXQ~WyJlMjcxNzExNzVkODdlMWE1IiwibmFtZSIsIm1heWNvbiJd~WyIwZDFiOTBlNTlhNmMyNDNiIiwibnVtYmVyIiwxMjNd~';

  beforeAll(async () => {
    await cleanup();

    wallet = await getWallet();

    const result = await addCredentialIfNotExists(jwt);
    credentialId = result?.id;
  });

  it('expect to import SD-JWT credential', async () => {
    const credential = await getCredentialProvider().getById(credentialId);

    expect(credential).toBeDefined();
    expect(credential._sd_jwt).toBeDefined();
    expect(credential._sd_jwt.encoded).toBe(jwt);

    expect(credential.type).toEqual([
      'VerifiableCredential',
      'InternalTesting',
    ]);
    expect(credential.issuer).toBe(
      'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1',
    );
    expect(credential.credentialSubject.number).toBe(123);
    expect(credential.issuanceDate).toBe('2025-10-02T14:13:14.000Z');
    expect(credential.expirationDate).toBe(undefined);
  });

  it('expect to import a decoded SD-JWT payload object', async () => {
    const decodedPayload = {
      iat: 1778854828,
      iss: 'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1',
      vct: 'BasicCredential',
      _sd: [
        '4bqpGCWfOvT_RcZYuyteRnUuFMaHsynG6RNQDh0v4UA',
        'ocOxmMDZJuQvIaHsCFPur2fkM6q6eeAMGvS5uvBRvJ8',
      ],
      _sd_alg: 'sha-256',
    };

    const result = await addCredentialIfNotExists(decodedPayload);
    expect(result?.id).toBeDefined();

    const credential = await getCredentialProvider().getById(result.id);

    expect(credential).toBeDefined();
    expect(credential.type).toEqual([
      'VerifiableCredential',
      decodedPayload.vct,
    ]);
    expect(credential.issuer).toBe(decodedPayload.iss);
    expect(credential.issuanceDate).toBe(
      new Date(decodedPayload.iat * 1000).toISOString(),
    );

    expect(credential.credentialSubject).toEqual({});
    expect(credential._sd_jwt).toBeDefined();
    expect(credential._sd_jwt.encoded).toBeUndefined();
  });

  it('expect to create presentation from SD-JWT credential', async () => {
    const credential = await getCredentialProvider().getById(credentialId);

    const proofRequest = await createProofRequest(
      ProofTemplateIds.ANY_CREDENTIAL,
    );

    const controller = await createVerificationController({
      wallet,
    });

    await controller.start({
      template: proofRequest,
    });

    let attributesToReveal = ['credentialSubject.number'];

    controller.selectedCredentials.set(credential.id, {
      credential: credential,
      attributesToReveal,
    });

    const presentation = await controller.createPresentation();


    const decoded = await decodeSDJWT(presentation.verifiableCredential[0]);

    expect(decoded.disclosures?.length).toBe(1);
    expect(decoded.disclosures?.[0].key).toBe('number');
    expect(decoded.disclosures?.[0].value).toBe(123);
  });

  afterAll(() => closeWallet());
});
