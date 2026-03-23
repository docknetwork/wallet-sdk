import {IWallet} from '@docknetwork/wallet-sdk-core/lib/types';
import {closeWallet, getWallet} from '../helpers/wallet-helpers';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';
import {blockchainService} from '@docknetwork/wallet-sdk-wasm/src/services/blockchain';
import {credentialService} from '@docknetwork/wallet-sdk-wasm/src/services/credential/service';

const credential = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    'https://ld.dock.io/security/bbs/v1',
    {
      dk: 'https://ld.dock.io/credentials#',
      BasicCredential: 'dk:BasicCredential',
      name: 'dk:name',
      biometric: 'dk:biometric',
      created: 'dk:created',
      data: 'dk:data',
      description: 'dk:description',
      logo: 'dk:logo',
    },
  ],
  id: 'https://creds-testnet.dock.io/b38670b557fb63a4ab1a7104026f94fd26847e20ce7aecca1cdc4614b01c75b7',
  type: ['VerifiableCredential', 'BasicCredential'],
  credentialSubject: {
    id: 'did:key:z6Mkv9oreVc641WshEzJDtnEc55yqh7w3oHeyhbRQz3mY4qm',
    name: 'Test Credential',
    biometric: {
      id: 'some-id',
      created: '2024-02-09T19:14:04.108Z',
      data: 'data',
    },
  },
  issuanceDate: '2024-02-09T19:14:04.108Z',
  issuer: {
    name: 'Forsur',
    description: 'Forsur is the biometric provider.',
    logo: 'https://img.dock.io/80f154126a78bba321b413c3ffb8d4a7',
    id: 'did:dock:5HLbQLSmirNuZVRsdWKbsgdajw9QTGzSFJABSVzMT5EBj5sb',
  },
  name: 'Test Credential',
  cryptoVersion: '0.5.0',
  credentialSchema: {
    id: 'data:application/json;charset=utf-8,%7B%22%24schema%22%3A%22http%3A%2F%2Fjson-schema.org%2Fdraft-07%2Fschema%23%22%2C%22definitions%22%3A%7B%22encryptableCompString%22%3A%7B%22type%22%3A%22string%22%7D%2C%22encryptableString%22%3A%7B%22type%22%3A%22string%22%7D%7D%2C%22properties%22%3A%7B%22%40context%22%3A%7B%22type%22%3A%22string%22%7D%2C%22credentialSchema%22%3A%7B%22type%22%3A%22string%22%7D%2C%22credentialSubject%22%3A%7B%22properties%22%3A%7B%22biometric%22%3A%7B%22properties%22%3A%7B%22created%22%3A%7B%22format%22%3A%22date-time%22%2C%22type%22%3A%22string%22%7D%2C%22data%22%3A%7B%22type%22%3A%22string%22%7D%2C%22id%22%3A%7B%22type%22%3A%22string%22%7D%7D%2C%22type%22%3A%22object%22%7D%2C%22id%22%3A%7B%22type%22%3A%22string%22%7D%2C%22name%22%3A%7B%22type%22%3A%22string%22%7D%7D%2C%22type%22%3A%22object%22%7D%2C%22cryptoVersion%22%3A%7B%22type%22%3A%22string%22%7D%2C%22id%22%3A%7B%22type%22%3A%22string%22%7D%2C%22issuanceDate%22%3A%7B%22format%22%3A%22date-time%22%2C%22type%22%3A%22string%22%7D%2C%22issuer%22%3A%7B%22properties%22%3A%7B%22description%22%3A%7B%22type%22%3A%22string%22%7D%2C%22id%22%3A%7B%22type%22%3A%22string%22%7D%2C%22logo%22%3A%7B%22type%22%3A%22string%22%7D%2C%22name%22%3A%7B%22type%22%3A%22string%22%7D%7D%2C%22type%22%3A%22object%22%7D%2C%22name%22%3A%7B%22type%22%3A%22string%22%7D%2C%22proof%22%3A%7B%22properties%22%3A%7B%22%40context%22%3A%7B%22items%22%3A%5B%7B%22properties%22%3A%7B%22proof%22%3A%7B%22properties%22%3A%7B%22%40container%22%3A%7B%22type%22%3A%22string%22%7D%2C%22%40id%22%3A%7B%22type%22%3A%22string%22%7D%2C%22%40type%22%3A%7B%22type%22%3A%22string%22%7D%7D%2C%22type%22%3A%22object%22%7D%2C%22sec%22%3A%7B%22type%22%3A%22string%22%7D%7D%2C%22type%22%3A%22object%22%7D%2C%7B%22type%22%3A%22string%22%7D%5D%2C%22type%22%3A%22array%22%7D%2C%22created%22%3A%7B%22format%22%3A%22date-time%22%2C%22type%22%3A%22string%22%7D%2C%22proofPurpose%22%3A%7B%22type%22%3A%22string%22%7D%2C%22type%22%3A%7B%22type%22%3A%22string%22%7D%2C%22verificationMethod%22%3A%7B%22type%22%3A%22string%22%7D%7D%2C%22type%22%3A%22object%22%7D%2C%22type%22%3A%7B%22type%22%3A%22string%22%7D%7D%2C%22type%22%3A%22object%22%7D',
    type: 'JsonSchemaValidator2018',
    parsingOptions: {
      useDefaults: false,
      defaultMinimumInteger: -4294967295,
      defaultMinimumDate: -17592186044415,
      defaultDecimalPlaces: 0,
    },
    version: '0.3.0',
  },
  proof: {
    '@context': [
      {
        sec: 'https://w3id.org/security#',
        proof: {
          '@id': 'sec:proof',
          '@type': '@id',
          '@container': '@graph',
        },
      },
      'https://ld.dock.io/security/bbs/v1',
    ],
    type: 'Bls12381BBS+SignatureDock2022',
    created: '2024-04-18T16:51:07Z',
    verificationMethod:
      'did:dock:5HLbQLSmirNuZVRsdWKbsgdajw9QTGzSFJABSVzMT5EBj5sb#keys-2',
    proofPurpose: 'assertionMethod',
    proofValue:
      'zYSvw8zFkQ9ZSV7tktnCuBLCAd61P4XztaqcytXLdMitKxmV7ZTbB4LfxAjPsZQivCb6TcJoosm6ViDHTu2NFj7iJTGpPcWe5v1oUUdvHEacWfaq9L58BcpTyBL3xVE1cj5HTQihFRrJ65rr99NtTSqnZu',
  },
};

const proofRequest = {
  qr: 'https://creds-example.dock.io/proof/d3c0c23e-efb5-41fc-a8a9-6213507f419a',
  id: 'd3c0c23e-efb5-41fc-a8a9-6213507f419a',
  name: 'BasicCredential Template',
  nonce: '08ec5ca2e2446b50b25a55e1b6b21f2b',
  created: '2023-10-02T21:30:55.851Z',
  updated: '2023-10-02T21:30:55.851Z',
  verified: false,
  response_url: `/proof-requests/d3c0c23e-efb5-41fc-a8a9-6213507f419a/send-presentation`,
  request: {
    id: '1cf6a349-f1d3-42f7-b751-8de7fb5fde6c',
    input_descriptors: [
      {
        id: 'Credential 1',
        name: 'Basic Credential (Biometrics)',
        purpose: 'Basic Credential with proof of biometrics',
        constraints: {
          fields: [
            {
              path: ['$.type'],
            },
            {
              path: [
                '$.issuer.id',
                '$.issuer',
                '$.vc.issuer.id',
                '$.vc.issuer',
                '$.iss',
              ],
            },
          ],
        },
      },
    ],
  },
  type: 'proof-request',
};

describe('BBS+ presentations', () => {
  it('should verify valid bbs+ credential with explicit attributesToReveal', async () => {
    const wallet: IWallet = await getWallet();
    const controller = await createVerificationController({
      wallet,
    });

    await controller.start({
      template: proofRequest,
    });

    const attributesToReveal = ['credentialSubject.name'];

    controller.selectedCredentials.set(credential.id, {
      credential: credential,
      attributesToReveal,
    });

    const presentation = await controller.createPresentation();

    const verificationResults = await credentialService.verifyPresentation({
      presentation,
      options: {
        compactProof: true,
        resolver: blockchainService.resolver,
        challenge: proofRequest.nonce,
        unsignedPresentation: true,
        domain: 'dock.io',
      },
    });

    expect(verificationResults.verified).toBe(true);
  });

  it('should generate presentation without explicit attributesToReveal', async () => {
    const wallet: IWallet = await getWallet();
    const controller = await createVerificationController({
      wallet,
    });

    await controller.start({
      template: proofRequest,
    });

    // No attributesToReveal specified - let PEX template handle it
    controller.selectedCredentials.set(credential.id, {
      credential: credential,
    });

    const presentation = await controller.createPresentation();

    const verificationResults = await credentialService.verifyPresentation({
      presentation,
      options: {
        compactProof: true,
        resolver: blockchainService.resolver,
        challenge: proofRequest.nonce,
        unsignedPresentation: true,
        domain: 'dock.io',
      },
    });

    expect(verificationResults.verified).toBe(true);
  });

  afterAll(() => closeWallet());
});
