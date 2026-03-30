import {IWallet, WalletEvents} from './types';
import {
  createVerificationController,
  VerificationStatus,
} from './verification-controller';
import {createWallet} from './wallet';
import customerCredentialJSON from './fixtures/customer-credential.json';
import universityDegreeBBS from './fixtures/university-degree-bbs.json';
import iiwCredential from './fixtures/iiw-credential.json';
import iiwTemplate from './fixtures/iiw-template.json';
import anyCredentialProofRequest from './fixtures/any-credential-proof-request.json';
import universityDegreeProofRequest from './fixtures/university-degree-proof-request.json';
import {createDIDProvider, IDIDProvider} from './did-provider';
import {replaceResponseURL} from './helpers';
import {createDataStore} from '@docknetwork/wallet-sdk-data-store-typeorm/src';

describe('Verification provider', () => {
  let wallet: IWallet;
  let didProvider: IDIDProvider;

  beforeAll(async () => {
    wallet = await createWallet({
      dataStore: await createDataStore({
        databasePath: ':memory:',
        defaultNetwork: 'testnet',
      }),
    });

    await wallet.waitForEvent(WalletEvents.networkConnected);

    didProvider = createDIDProvider({
      wallet,
    });

    await didProvider.ensureDID();

    await wallet.addDocument(customerCredentialJSON);
    await wallet.addDocument(universityDegreeBBS);
    await wallet.addDocument(iiwCredential);
  });

  it('expect to create verification controller', async () => {
    const controller = createVerificationController({
      wallet,
    });

    await controller.start({
      template: anyCredentialProofRequest,
    });

    const currentDID = await didProvider.getAll();

    expect(controller.getSelectedDID()).toBe(currentDID[0].didDocument.id);
    expect(controller.getStatus()).toEqual(
      VerificationStatus.SelectingCredentials,
    );
    expect(controller.selectedCredentials.size).toEqual(0);
    expect(controller.getTemplateJSON()).toEqual(anyCredentialProofRequest);
    expect(controller.getFilteredCredentials()).toEqual([
      customerCredentialJSON,
      universityDegreeBBS,
    ]);
  });

  it('expect to generate presentation for a selected credential', async () => {
    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: anyCredentialProofRequest,
    });

    const credentials = controller.getFilteredCredentials();

    // select the first credential in the filtered list
    controller.selectedCredentials.set(credentials[0].id, {
      credential: credentials[0],
    });

    const presentation = await controller.createPresentation();

    expect(presentation.credentials[0]).toStrictEqual(credentials[0]);
    expect(presentation.type).toEqual(['VerifiablePresentation']);

    // validate the presentation
    const result = await controller.evaluatePresentation(presentation);

    expect(result.isValid).toBe(true);
  });

  it('expect to create a default presentation using filtered credentials', async () => {
    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: anyCredentialProofRequest,
    });

    const credentials = controller.getFilteredCredentials();

    const presentation = await controller.createDefaultPresentation();

    expect(presentation.credentials[0]).toStrictEqual(credentials[0]);
    expect(presentation.type).toEqual(['VerifiablePresentation']);

    // validate the presentation
    const result = await controller.evaluatePresentation(presentation);

    expect(result.isValid).toBe(true);
  });

  it('expect to generate presentation iiw credential', async () => {
    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    const updatedTemplate = replaceResponseURL(iiwTemplate);
    await controller.start({
      template: updatedTemplate,
    });

    const credentials = controller.getFilteredCredentials();
    const selectedCredentialId = iiwCredential.id;
    const selectedCredential = credentials.find(
      item => item.id === selectedCredentialId,
    );
    // select the first credential in the filtered list
    controller.selectedCredentials.set(selectedCredential.id, {
      credential: selectedCredential,
      attributesToReveal: [
        'credentialSubject.holderName',
        'credentialSubject.booleanYesNO',
      ],
    });

    const presentation = await controller.createPresentation();

    expect(presentation.credentials[0].id).toEqual(selectedCredential.id);
    expect(presentation.type).toEqual(['VerifiablePresentation']);

    // validate the presentation
    const result = await controller.evaluatePresentation(presentation);

    expect(result.isValid).toBe(true);
  });

  it('expect to generate presentation for a bbs credential, selecting specific attributes to share', async () => {
    const controller = createVerificationController({
      wallet,
      didProvider,
    });

    await controller.start({
      template: universityDegreeProofRequest,
    });

    const credentials = controller.getFilteredCredentials();

    expect(credentials.length).toBe(1);
    // select the first credential in the filtered list
    controller.selectedCredentials.set(credentials[0].id, {
      credential: credentials[0],
      attributesToReveal: ['name', 'credentialSubject.dateOfBirth'],
    });

    const presentation = await controller.createPresentation();

    const result = await controller.evaluatePresentation(presentation);
    expect(result.isValid).toBe(true);
  });
});
