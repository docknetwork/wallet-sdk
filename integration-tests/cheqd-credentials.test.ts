import { IWallet } from '@docknetwork/wallet-sdk-core/lib/types';
import { createVerificationController } from '@docknetwork/wallet-sdk-core/src/verification-controller';
import { CheqdCredentialNonZKP, CheqdCredentialZKP } from './data/credentials/cheqd-credentials';
import { addCredentialIfNotExists, closeWallet, createNewWallet, getCredentialProvider, getWallet } from './helpers';
import { ProofTemplateIds, createProofRequest } from './helpers/certs-helpers';

describe('Cheq integration tests', () => {
  beforeAll(async () => {
    await createNewWallet();
  });

  it('should verify a non ZKP cheqd credential', async () => {
    const wallet: IWallet = await getWallet();

    await addCredentialIfNotExists(CheqdCredentialNonZKP);

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

    const presentation = await controller.createDefaultPresentation();
    const evaluation = await controller.evaluatePresentation(presentation);

    expect(evaluation.isValid).toBe(true);
  });

  afterAll(() => closeWallet());
});
