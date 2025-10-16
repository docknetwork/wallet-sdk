import {
  BasicCredential,
  PolygonIDCredential,
  UniversityDegreeCredential,
  UniversityDegreeCredentialBBS,
} from './data/credentials';
import {
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

    const result = await getCredentialProvider().addCredential(jwt);
    credentialId = result.id;
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

    let attributesToReveal = ['credentialSubject.name'];

    controller.selectedCredentials.set(credential.id, {
      credential: credential,
      attributesToReveal,
    });

    const presentation = await controller.createPresentation();

    console.log(JSON.stringify(presentation, null, 2));

    let certsResponse;
    try {
      certsResponse = await controller.submitPresentation(presentation);
      console.log('CERTS response');
      console.log(JSON.stringify(certsResponse, null, 2));
    } catch (err) {
      certsResponse = err.response.data;
      console.log('Certs API returned an error');
      console.log(JSON.stringify(certsResponse, null, 2));
    }
  });

  afterAll(() => closeWallet());
});
