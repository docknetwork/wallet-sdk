import {IWallet} from '@docknetwork/wallet-sdk-core/lib/types';
import {
  closeWallet,
  getWallet,
  getDIDProvider,
  getCredentialProvider,
} from '../helpers/wallet-helpers';
import {createVerificationController} from '@docknetwork/wallet-sdk-core/src/verification-controller';
import delegatedCredential from '../data/default-presentation-tests/delegated-credential.json';
import {setWitnessCacheTTL} from '@docknetwork/wallet-sdk-wasm/src/services/credential/bbs-revocation';
import { CredentialStatus } from '@docknetwork/wallet-sdk-core/src/credential-provider';

jest.retryTimes(0);

let wallet: IWallet;
let didProvider;

describe('Delegatable credential verification', () => {
  beforeAll(async () => {
    setWitnessCacheTTL(0);

    wallet = await getWallet();
    didProvider = getDIDProvider();
    const credentialProvider = getCredentialProvider();

    await didProvider.ensureDID();
    await credentialProvider.addCredential(delegatedCredential);
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  afterAll(() => closeWallet());

  it('should create a default presentation for university degree', async () => {
    const credentialProvider = getCredentialProvider();
    credentialProvider.getCredentialStatus = jest.fn().mockResolvedValue({
      status: CredentialStatus.Verified,
    });

    const controller = createVerificationController({
      wallet,
      didProvider,
      credentialProvider,
    });

    await controller.start({
      template: {
        signature: null,
        qr: 'https://creds-testnet.truvera.io/proof/d51365ef-f3ae-4ce6-8cf7-5afc8ecd44dd',
        id: 'd51365ef-f3ae-4ce6-8cf7-5afc8ecd44dd',
        name: 'Test agent verification',
        nonce: '0e67edff8c51605ab3f4b25381f7a863',
        created: '2026-07-21T12:16:55.309Z',
        response_url:
          'https://api-testnet.truvera.io/proof-requests/d51365ef-f3ae-4ce6-8cf7-5afc8ecd44dd/send-presentation',
        request: {
          id: 'd51365ef-f3ae-4ce6-8cf7-5afc8ecd44dd',
          input_descriptors: [
            {
              id: 'Credential 1',
              name: 'Test agent verification',
              purpose: 'Test agent verification',
              constraints: {
                fields: [
                  {
                    path: ['$.credentialSchema.id'],
                    filter: {
                      const:
                        'https://schema.truvera.io/PurchasingAuthority-V4-1781869267904.json',
                    },
                  },
                  {path: ['$.credentialSubject.jobRole']},
                ],
              },
            },
          ],
        },
        type: 'proof-request',
      },
    });

    const presentation = await controller.createDefaultPresentation();

    expect(presentation).toBeDefined();
    expect(presentation.type).toEqual(['VerifiablePresentation']);
    expect(presentation.verifiableCredential).toBeDefined();
    expect(presentation.verifiableCredential.length).toBe(1);
  });
});
