import { IWallet } from '@docknetwork/wallet-sdk-core/lib/types';
import { createVerificationController } from '@docknetwork/wallet-sdk-core/src/verification-controller';
import { CheqdCredentialNonZKP, CheqdCredentialZKP } from './data/credentials/cheqd-credentials';
import { closeWallet, createNewWallet, getCredentialProvider, getWallet } from './helpers';
import { ProofTemplateIds, createProofRequest } from './helpers/certs-helpers';

describe('Cheq integration tests', () => {
  beforeAll(async () => {
    await createNewWallet();
  });

  it('should verify a non ZKP cheqd credential', async () => {
    const wallet: IWallet = await getWallet();

    try {
      await getCredentialProvider().addCredential(CheqdCredentialNonZKP);
    } catch(err) {
      console.error('Credential already added');
    }

    const proofRequest = await createProofRequest(
      ProofTemplateIds.ANY_CREDENTIAL,
    );

    const result: any = await getCredentialProvider().isValid(CheqdCredentialNonZKP);

    expect(result).toBeTruthy();

    const controller = await createVerificationController({
      wallet,
    });

    await controller.start({
      template: proofRequest,
    });

    controller.selectedCredentials.set(CheqdCredentialNonZKP.id, {
      credential: CheqdCredentialNonZKP,
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
