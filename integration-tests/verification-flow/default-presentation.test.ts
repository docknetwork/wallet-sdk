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

    const submitResult = await controller.submitPresentation(presentation);

    expect(submitResult.verified).toBe(true);
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

    const submitResult = await controller.submitPresentation(presentation);
    expect(submitResult.verified).toBe(true);
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

    const submitResult = await controller.submitPresentation(presentation);

    expect(submitResult.verified).toBe(true);
  });

  it('should create a default presentation with 2 range proofs', async () => {
    const proofRequest = await createProofRequest(template4);

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
    expect(presentation.verifiableCredential.length).toBeGreaterThanOrEqual(1);

    const submitResult = await controller.submitPresentation(presentation);
    expect(submitResult.verified).toBe(true);
  });

  it('should return selected credentials by descriptor with alternatives', async () => {
    const proofRequest = await createProofRequest(template1);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    await controller.createDefaultPresentation();

    const descriptors = controller.getSelectedCredentialsByDescriptor();

    expect(descriptors.length).toBeGreaterThanOrEqual(1);

    const descriptor = descriptors[0];
    expect(descriptor.selected).toBeDefined();
    expect(descriptor.selected.id).toBeDefined();
    expect(descriptor.descriptorName).toBeDefined();
    // Template1 requires university degree, and we have 2 university degrees in the wallet
    expect(descriptor.alternatives.length).toBeGreaterThanOrEqual(1);
  });

  it('should return credential options for a selected credential', async () => {
    const proofRequest = await createProofRequest(template1);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    await controller.createDefaultPresentation();

    const descriptors = controller.getSelectedCredentialsByDescriptor();
    const selectedCredentialId = descriptors[0].selected.id;

    const options = controller.getCredentialOptionsForDescriptor(selectedCredentialId);

    expect(options.selected.id).toBe(selectedCredentialId);
    expect(options.alternatives.length).toBeGreaterThanOrEqual(1);
    // The alternative should not be the same as the selected credential
    expect(options.alternatives.every(alt => alt.id !== selectedCredentialId)).toBe(true);
  });

  it('should switch a credential and generate a valid presentation', async () => {
    const proofRequest = await createProofRequest(template1);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    await controller.createDefaultPresentation();

    const descriptors = controller.getSelectedCredentialsByDescriptor();
    const originalCredentialId = descriptors[0].selected.id;
    const replacementCredentialId = descriptors[0].alternatives[0].id;

    const newPresentation = await controller.switchCredential(
      originalCredentialId,
      replacementCredentialId,
    );

    expect(newPresentation).toBeDefined();
    expect(newPresentation.type).toEqual(['VerifiablePresentation']);

    // Verify the selected credentials were actually swapped
    const updatedDescriptors = controller.getSelectedCredentialsByDescriptor();
    expect(updatedDescriptors[0].selected.id).toBe(replacementCredentialId);

    const result = controller.evaluatePresentation(newPresentation);
    expect(result.isValid).toBe(true);
  });

  it('should throw when switching with a non-selected credential', async () => {
    const proofRequest = await createProofRequest(template1);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    await controller.createDefaultPresentation();

    await expect(
      controller.switchCredential('non-existent-id', universityDegree2.id),
    ).rejects.toThrow('is not currently selected');
  });

  it('should throw when switching with an ineligible replacement', async () => {
    const proofRequest = await createProofRequest(template1);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    await controller.createDefaultPresentation();

    const descriptors = controller.getSelectedCredentialsByDescriptor();
    const selectedCredentialId = descriptors[0].selected.id;

    await expect(
      controller.switchCredential(selectedCredentialId, 'non-existent-credential'),
    ).rejects.toThrow('is not a valid replacement');
  });

  it('should return requested attributes for a credential', async () => {
    const proofRequest = await createProofRequest(template1);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    await controller.createDefaultPresentation();

    const descriptors = controller.getSelectedCredentialsByDescriptor();
    const selectedCredentialId = descriptors[0].selected.id;

    const attributes = controller.getRequestedAttributes(selectedCredentialId);

    expect(attributes.length).toBeGreaterThanOrEqual(1);
    // Template1 requests dateOfBirth
    const dateOfBirth = attributes.find(a => a.name === 'credentialSubject.dateOfBirth');
    expect(dateOfBirth).toBeDefined();
    expect(dateOfBirth.isRangeProof).toBe(false);
    expect(dateOfBirth.value).toBeDefined();
  });

  it('should identify range proof attributes', async () => {
    const proofRequest = await createProofRequest(template2);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    await controller.createDefaultPresentation();

    const descriptors = controller.getSelectedCredentialsByDescriptor();
    const selectedCredentialId = descriptors[0].selected.id;

    const attributes = controller.getRequestedAttributes(selectedCredentialId);

    const rangeProofAttr = attributes.find(a => a.isRangeProof);
    expect(rangeProofAttr).toBeDefined();
    expect(rangeProofAttr.value).toBeNull();
    expect(rangeProofAttr.min !== undefined || rangeProofAttr.max !== undefined).toBe(true);
  });

  it('should return credential status for a valid credential', async () => {
    const proofRequest = await createProofRequest(template1);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    await controller.createDefaultPresentation();

    const descriptors = controller.getSelectedCredentialsByDescriptor();
    const selectedCredentialId = descriptors[0].selected.id;

    const status = await controller.getCredentialStatus(selectedCredentialId);

    expect(status).toBeDefined();
    expect(status.status).toBe('verified');
  });

  it('should check if a credential can be switched', async () => {
    const proofRequest = await createProofRequest(template1);

    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: proofRequest,
    });

    await controller.createDefaultPresentation();

    const descriptors = controller.getSelectedCredentialsByDescriptor();
    const selectedCredentialId = descriptors[0].selected.id;

    // Template1 has 2 matching university degrees, so switching should be possible
    expect(controller.canSwitchCredential(selectedCredentialId)).toBe(true);
    // Non-existent credential should return false
    expect(controller.canSwitchCredential('non-existent-id')).toBe(false);
  });
});
