import {
  acquireOpenIDCredentialFromURI,
  getAuthURL,
  decodeRequestJWT,
  getPresentationSubmision,
} from './oidvc';
import {credentialServiceRPC} from '@docknetwork/wallet-sdk-wasm/src/services/credential';
import {MetadataClient} from '@sphereon/oid4vci-client';
import {jwtDecode} from 'jwt-decode';
import axios from 'axios';

jest.mock('@docknetwork/wallet-sdk-wasm/src/services/credential');
jest.mock('@sphereon/oid4vci-client');
jest.mock('jwt-decode');
jest.mock('axios');

describe('acquireOpenIDCredentialFromURI', () => {
  const didProvider: any = {
    getDIDKeyPairs: jest.fn(),
  };

  const uri = 'https://example.com/credential';

  beforeEach(() => {
    didProvider.getDIDKeyPairs.mockResolvedValue([{id: 'did:example:123'}]);
    (credentialServiceRPC.acquireOIDCredential as jest.Mock).mockResolvedValue({
      credential: 'fake-credential',
    });
  });

  it('should acquire OID credential without authorization URL', async () => {
    const response = await acquireOpenIDCredentialFromURI({didProvider, uri});
    expect(didProvider.getDIDKeyPairs).toHaveBeenCalled();
    expect(credentialServiceRPC.acquireOIDCredential).toHaveBeenCalledWith({
      uri,
      holderKeyDocument: {id: 'did:example:123'},
      allowInsecureHttpRequests: undefined,
    });
    expect(response).toBe('credential');
  });

  it('should acquire OID credential with authorization URL', async () => {
    const getAuthCode = jest.fn().mockResolvedValue('auth-code');
    (credentialServiceRPC.acquireOIDCredential as jest.Mock).mockResolvedValueOnce({
      authorizationURL: 'https://example.com/auth',
    });

    const response = await acquireOpenIDCredentialFromURI({
      didProvider,
      uri,
      getAuthCode,
    });
    expect(getAuthCode).toHaveBeenCalledWith('https://example.com/auth');
    expect(credentialServiceRPC.acquireOIDCredential).toHaveBeenCalledWith({
      uri,
      holderKeyDocument: {id: 'did:example:123'},
      authorizationCode: 'auth-code',
      allowInsecureHttpRequests: undefined,
    });
    expect(response).toBe('credential');
  });

  it('should pass allowInsecureHttpRequests through to the wasm service', async () => {
    await acquireOpenIDCredentialFromURI({
      didProvider,
      uri: 'openid-credential-offer://?credential_offer_uri=http://localhost/offer',
      allowInsecureHttpRequests: true,
    });
    expect(credentialServiceRPC.acquireOIDCredential).toHaveBeenCalledWith({
      uri: 'openid-credential-offer://?credential_offer_uri=http://localhost/offer',
      holderKeyDocument: {id: 'did:example:123'},
      allowInsecureHttpRequests: true,
    });
  });
});

describe('getAuthURL', () => {
  it('should generate an auth URL', async () => {
    const uri = 'https://example.com?client_id=fake-client';
    const metadata = {
      authorizationServerMetadata: {
        request_object_signing_alg_values_supported: ['RS256'],
      },
      authorization_endpoint: 'https://auth.example.com/authorize',
    };
    (MetadataClient.retrieveAllMetadata as jest.Mock).mockResolvedValue(metadata);

    const result = await getAuthURL(uri);
    expect(MetadataClient.retrieveAllMetadata).toHaveBeenCalledWith(
      'fake-client',
    );
    expect(result).toContain('https://auth.example.com/authorize?');
    expect(result).toContain('client_id=dock-wallet');
    expect(result).toContain('redirect_uri=dockwallet://vp');
  });
});

describe('decodeRequestJWT', () => {
  it('should decode JWT from the request URI', async () => {
    const uri = 'https://example.com?request_uri=https://example.com/jwt';
    const jwt = 'some-jwt';
    const decodedJWT = {sub: '1234567890', name: 'Testing', admin: true};
    (axios.get as jest.Mock).mockResolvedValue({data: jwt});
    (jwtDecode as jest.Mock).mockReturnValue(decodedJWT);

    const result = await decodeRequestJWT(uri);
    expect(axios.get).toHaveBeenCalledWith('https://example.com/jwt');
    expect(jwtDecode).toHaveBeenCalledWith(jwt);
    expect(result).toEqual(decodedJWT);
  });
});

describe('getPresentationSubmision', () => {
  it('should get presentation submission', async () => {
    const credentials = [
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://ld.truvera.io/credentials/extensions-v1',
          {
            BasicCredential: 'dk:BasicCredential',
            dk: 'https://ld.truvera.io/credentials#',
          },
        ],
        id: 'https://creds-testnet.truvera.io/8afcb0925ad0d31c6afcc7fdec040f3b6c8260c20cdc6da5042307a9fa0dd7a6',
        type: ['VerifiableCredential', 'BasicCredential'],
        credentialSubject: {
          id: 'did:key:z6MkkS7LbdxSqP8WM5GfsXiNwZC6Ve33aj83eEyzsFGphepp',
          name: 'Test Credential',
        },
        issuanceDate: '2025-02-22T19:14:04.108Z',
        issuer: {
          name: 'Quotient Credit Union',
          description: 'Quotient Credit Union is the credit union.',
          logo: 'https://img.dock.io/06d78272268c606a172d5fd1cd559b46',
          id: 'did:cheqd:testnet:5ad9c962-74e7-4857-891e-95e4a3b035d0',
        },
        name: 'Test Credential',
        proof: {
          type: 'Ed25519Signature2018',
          created: '2025-05-29T18:48:19Z',
          verificationMethod:
            'did:cheqd:testnet:5ad9c962-74e7-4857-891e-95e4a3b035d0#keys-1',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..c5vxz6GKOuWykNKuNVqZ4giOplR3V8YVsJ5Ej4i5Dk3urVFd2ODsAkcu5Th7qWJrD5L3zEJzGEvlUbtRFCS1BQ',
        },
      },
    ];
    const presentationDefinition = {
      id: '94d240d2-b70f-412e-8331-1b610407cce6',
      name: 'Verificação de maioridade',
      purpose: 'Verificação de maioridade',
      input_descriptors: [
        {
          id: 'OpenFinanceCredentialV2',
          name: 'Verificação de maioridade',
          purpose: 'Verificação de maioridade',
          constraints: {
            fields: [
              {
                path: ['$.credentialSubject.name'],
              },
              {
                path: ['$.type', '$.vc.type'],
                filter: {
                  type: 'array',
                  contains: {
                    const: 'BasicCredential',
                  },
                },
              },
            ],
          },
        },
      ],
    };

    const holderDID =
      'did:key:z6MkkS7LbdxSqP8WM5GfsXiNwZC6Ve33aj83eEyzsFGphepp';

    const result = await getPresentationSubmision({
      credentials,
      presentationDefinition,
      holderDID,
    });

    expect(result).toStrictEqual({
      id: expect.any(String),
      definition_id: '94d240d2-b70f-412e-8331-1b610407cce6',
      descriptor_map: [
        {
          id: 'OpenFinanceCredentialV2',
          format: 'ldp_vc',
          path: '$.verifiableCredential[0]',
        },
      ],
    });
  });
});
