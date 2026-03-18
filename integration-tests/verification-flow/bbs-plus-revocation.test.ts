import {IWallet} from '@docknetwork/wallet-sdk-core/lib/types';
import {
  addCredentialIfNotExists,
  closeWallet,
  getCredentialProvider,
  getWallet,
} from '../helpers/wallet-helpers';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';
import {ProofTemplateIds, createProofRequest} from '../helpers/certs-helpers';
import { bbsPlusRevocationCredential, credentialWithUpdatedWitness } from './bbs-plus-revocation-credentials';

// Skip in CI due to network/accumulator access issues - passes locally
const describeOrSkip = process.env.CI ? describe.skip : describe;

describeOrSkip('BBS+ revocation', () => {
  it('should verify a revokable bbs+ credential', async () => {
    const wallet: IWallet = await getWallet();

    await addCredentialIfNotExists(bbsPlusRevocationCredential);

    const proofRequest = await createProofRequest(
      ProofTemplateIds.ANY_CREDENTIAL,
    );

    const result: any = await getCredentialProvider().isValid(bbsPlusRevocationCredential);

    expect(result.status).toBe('verified');

    const controller = await createVerificationController({
      wallet,
    });

    await controller.start({
      template: proofRequest,
    });

    let attributesToReveal = ['credentialSubject.name'];

    controller.selectedCredentials.set(bbsPlusRevocationCredential.id, {
      credential: bbsPlusRevocationCredential,
      attributesToReveal,
    });

    const presentation = await controller.createPresentation();
    console.log('Presentation generated');
    console.log(JSON.stringify(presentation, null, 2));
    console.log('Sending presentation to Certs API');

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

    expect(certsResponse.verified).toBe(true);
  });

  it('should verify a revokable bbs+ credential with an updated witness', async () => {
    const wallet: IWallet = await getWallet();

    await addCredentialIfNotExists(credentialWithUpdatedWitness);

    const proofRequest = await createProofRequest(
      ProofTemplateIds.ANY_CREDENTIAL,
    );

    const result: any = await getCredentialProvider().isValid(credentialWithUpdatedWitness);

    // TODO: Uncomment this when gets done https://dock-team.atlassian.net/browse/DCKM-483
    // expect(result.status).toBe('verified');

    // const controller = await createVerificationController({
    //   wallet,
    // });

    // await controller.start({
    //   template: proofRequest,
    // });

    // let attributesToReveal = ['credentialSubject.name'];

    // controller.selectedCredentials.set(credential.id, {
    //   credential: credential,
    //   attributesToReveal,
    // });

    // const presentation = await controller.createPresentation();
    // console.log('Presentation generated');
    // console.log(JSON.stringify(presentation, null, 2));
    // console.log('Sending presentation to Certs API');

    // let certsResponse;
    // try {
    //   certsResponse = await controller.submitPresentation(presentation);
    //   console.log('CERTS response');
    //   console.log(JSON.stringify(certsResponse, null, 2));
    // } catch (err) {
    //   certsResponse = err.response.data;
    //   console.log('Certs API returned an error');
    //   console.log(JSON.stringify(certsResponse, null, 2));
    // }
    // 
    // expect(certsResponse.verified).toBe(false);
  });

  // Working to fix that under: https://dock-team.atlassian.net/browse/DCKM-453
  // it('should handle a revoked bbs+ credential as not valid', async () => {
  //   const wallet: IWallet = await getWallet();

  //   getCredentialProvider().addCredential(bbsPlusRevokedCredential);

  //   const proofRequest = await createProofRequest(
  //     ProofTemplateIds.ANY_CREDENTIAL,
  //   );

  //   const controller = await createVerificationController({
  //     wallet,
  //   });

  //   await controller.start({
  //     template: proofRequest,
  //   });

  //   let attributesToReveal = ['credentialSubject.name'];

  //   controller.selectedCredentials.set(bbsPlusRevokedCredential.id, {
  //     credential: bbsPlusRevokedCredential,
  //     attributesToReveal,
  //   });

  //   const presentation = await controller.createPresentation();
  //   console.log('Presentation generated');
  //   console.log(JSON.stringify(presentation, null, 2));
  //   console.log('Sending presentation to Certs API');

  //   let data;

  //   try {
  //     const certsResponse = await controller.submitPresentation(presentation);
  //     console.log('CERTS response');
  //     console.log(JSON.stringify(certsResponse, null, 2));
  //   } catch (err) {
  //     data = err.response.data;
  //     console.log('Certs API returned an error');
  //     console.log(JSON.stringify(data, null, 2));
  //   }

  //   expect(data.status).toBe(400);
  //   // The current error message from certs is the following:
  //   // Credential not verified: Invalid anoncreds presentation due to error: VBAccumProofContributionFailed(1, PairingResponseInvalid)
  // });

  afterAll(() => closeWallet());
});
