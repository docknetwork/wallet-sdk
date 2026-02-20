import {IWallet} from '@docknetwork/wallet-sdk-core/lib/types';
import {
  closeWallet,
  getCredentialProvider,
  getWallet,
} from '../helpers/wallet-helpers';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';
import {ProofTemplateIds, createProofRequest} from '../helpers/certs-helpers';
import { cheqdRevocationCredential } from './bbs-plus-revocation-credentials';

describe('BBS+ revocation cheqd', () => {
  it('should verify a revokable bbs+ credential issued on cheqd', async () => {
    const wallet: IWallet = await getWallet();

    try {
      await getCredentialProvider().addCredential(cheqdRevocationCredential);
    } catch(err) {
      console.error('Credential already added');
    }

    const proofRequest = await createProofRequest(
      ProofTemplateIds.ANY_CREDENTIAL,
    );

    const result: any = await getCredentialProvider().isValid(cheqdRevocationCredential);

    expect(result.status).toBe('verified');

    const controller = await createVerificationController({
      wallet,
    });

    await controller.start({
      template: proofRequest,
    });

    let attributesToReveal = ['credentialSubject.name'];

    controller.selectedCredentials.set(cheqdRevocationCredential.id, {
      credential: cheqdRevocationCredential,
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

  afterAll(() => closeWallet());
});
