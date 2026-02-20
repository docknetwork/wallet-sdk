import {IWallet} from '@docknetwork/wallet-sdk-core/lib/types';
import {
  closeWallet,
  getCredentialProvider,
  getWallet,
} from '../helpers/wallet-helpers';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';
import {createProofRequest} from '../helpers/certs-helpers';
import axios from 'axios';

describe('Range proofs verification', () => {
  let proofRequest: any;

  beforeAll(async () => {
    proofRequest = await createProofRequest(
      'db3ca660-f353-4298-8522-73ef95ea1a16',
    );
  });
  it('should create range proofs presentation without subject', async () => {
    const wallet: IWallet = await getWallet();
    const controller = await createVerificationController({
      wallet,
    });

    const credentialUrl =
      'https://creds-testnet.dock.io/697fe144364680179937fa748a5b2483f3ee2743ab751cbad8305338eb53a7a3';
    const password = '1234';
    const {data: credential} = await axios.get(
      `${credentialUrl}?p=${btoa(password)}`,
    );

    try {
      await getCredentialProvider().addCredential(credential);
    } catch(err) {
      console.error('Credential already added');
    }

    await controller.start({
      template: proofRequest.qr,
    });

    // We can keep the attributes to reveal empty
    // Range proof attributes will be handled automatically during presentation creation
    // and will not be revealed in the presentation
    // even if we include them in the attributesToReveal, they will be ignored
    const attributesToReveal = [];

    controller.selectedCredentials.set(credential.id, {
      credential: credential,
      attributesToReveal,
    });

    const presentation = await controller.createPresentation();

    // presentation should not have subject revealed
    expect(
      presentation.verifiableCredential[0].credentialSubject,
    ).toBeUndefined();

    // assert that the bounds for dateOfBirth are present
    expect(
      presentation.verifiableCredential[0].proof.bounds.credentialSubject
        .dateOfBirth,
    ).toEqual([
      {
        min: 502675200000,
        max: 884541351600000,
        paramId: 'key0',
        protocol: 'LegoGroth16',
      },
    ]);
  });

  it('should not reveal range proof attributes for KVAC credentials', async () => {
    const wallet: IWallet = await getWallet();
    const controller = await createVerificationController({
      wallet,
    });

    const credentialUrl =
      'https://creds-testnet.truvera.io/16c431993e6678af4fc74a9b995250bfe3a2ecf215baa31f0945164ac89fd798';
    const password = 'test';
    const {data: credential} = await axios.get(
      `${credentialUrl}?p=${btoa(password)}`,
    );

    try {
      await getCredentialProvider().addCredential(credential);
    } catch(err) {
      console.error('Credential already added');
    }

    await controller.start({
      template: proofRequest.qr,
    });

    // Reveal only id attribute
    // The range proof attribute dateOfBirth will be handled automatically during presentation creation
    const attributesToReveal = ['credentialSubject.id'];

    controller.selectedCredentials.set(credential.id, {
      credential: credential,
      attributesToReveal,
    });

    const presentation = await controller.createPresentation();

    // presentation should not have dateOfBirth revealed
    expect(
      presentation.verifiableCredential[0].credentialSubject.dateOfBirth,
    ).toBeUndefined();
    expect(
      presentation.verifiableCredential[0].credentialSubject.id,
    ).toBeDefined();
    // assert that the bounds for dateOfBirth are present
    expect(
      presentation.verifiableCredential[0].proof.bounds.credentialSubject
        .dateOfBirth,
    ).toEqual([
      {
        min: 502675200000,
        max: 884541351600000,
        paramId: 'key0',
        protocol: 'LegoGroth16',
      },
    ]);
  });

  it('should not reveal issuanceDate', async () => {
    const wallet: IWallet = await getWallet();
    const controller = await createVerificationController({
      wallet,
    });

    await controller.start({
      template: proofRequest.qr,
    });

    const credentialUrl =
      'https://creds-testnet.dock.io/697fe144364680179937fa748a5b2483f3ee2743ab751cbad8305338eb53a7a3';
    const password = '1234';
    const {data: credential} = await axios.get(
      `${credentialUrl}?p=${btoa(password)}`,
    );

    try {
      await getCredentialProvider().addCredential(credential);
    } catch(err) {
      console.error('Credential already added');
    }

    // pexToBounds should skip issuanceDate
    // There is an SDK limitation that prevents us from sharing the actual issuanceDate
    const attributesToReveal = ['issuanceDate', 'credentialSubject.salary'];

    controller.selectedCredentials.set(credential.id, {
      credential: credential,
      attributesToReveal,
    });

    const presentation = await controller.createPresentation();

    // Presentation issuanceDate should not be equal to the credential issuanceDate
    // The credential SDK will genreate a presentation timestamp instead
    expect(presentation.verifiableCredential[0].issuanceDate).not.toBe(
      credential.issuanceDate,
    );
    expect(presentation.verifiableCredential[0].credentialSubject.salary).toBe(
      credential.credentialSubject.salary,
    );
  });
  afterAll(() => closeWallet());
});
