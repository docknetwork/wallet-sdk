import {IWallet} from '@docknetwork/wallet-sdk-core/lib/types';
import {
  closeWallet,
  getWallet,
  getDIDProvider,
  getCredentialProvider,
} from '../helpers/wallet-helpers';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';
import universityDegree from '../data/default-presentation-tests/university-degree.json';
import universityDegree2 from '../data/default-presentation-tests/university-degree-2.json';
import equinetCreditScore from '../data/default-presentation-tests/equinet-credit-score.json';
import {createProofRequest} from '../helpers/certs-helpers';

jest.retryTimes(0);

// Request a university degree and reveal dateOfBirth
const template1 = '91138d81-1b54-4955-a5bc-4e2d90d8f7b1';
// 1 range proof credential is requested, creditScore greater than 50
const template2 = 'a7786f42-03ee-4f49-80b8-ce3027b5a903';
// Any credential with dateOfBirth is revealed
const template3 = 'a3e775bb-aaab-4489-b31b-746dc74f76c5';
// 2 range proofs
const template4 = '9b434ed1-3b65-4b7c-b678-afc7e218f063';

let wallet: IWallet;
let didProvider;

describe('Default presentation', () => {
  beforeAll(async () => {
    wallet = await getWallet();
    didProvider = getDIDProvider();
    const credentialProvider = getCredentialProvider();

    await didProvider.ensureDID();
    await credentialProvider.addCredential(universityDegree);
    await credentialProvider.addCredential(universityDegree2);
    await credentialProvider.addCredential(equinetCreditScore);
  });

  afterAll(() => closeWallet());

  it('should create a default presentation for university degree', async () => {
    const proofRequest = await createProofRequest(template1);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    const presentation = await controller.createDefaultPresentation();

    expect(presentation).toBeDefined();
    expect(presentation.type).toEqual(['VerifiablePresentation']);
    expect(presentation.verifiableCredential).toBeDefined();
    expect(presentation.verifiableCredential.length).toBe(1);

    const result = controller.evaluatePresentation(presentation);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should create a default presentation with range proof', async () => {
    const proofRequest = await createProofRequest(template2);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    const presentation = await controller.createDefaultPresentation();

    expect(presentation).toBeDefined();
    expect(presentation.type).toEqual(['VerifiablePresentation']);
    expect(presentation.verifiableCredential).toBeDefined();
    expect(presentation.verifiableCredential.length).toBe(1);

  });

  it('should create a default presentation for any credential with dateOfBirth', async () => {
    const proofRequest = await createProofRequest(template3);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    const presentation = await controller.createDefaultPresentation();

    expect(presentation).toBeDefined();
    expect(presentation.type).toEqual(['VerifiablePresentation']);
    expect(presentation.verifiableCredential).toBeDefined();
    expect(presentation.verifiableCredential.length).toBe(1);

  });
});
