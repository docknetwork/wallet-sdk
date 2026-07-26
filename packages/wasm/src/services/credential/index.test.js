import {assertRpcService, getPromiseError} from '../test-utils';
import {
  credentialService as service,
  credentialUtils as serviceCredentialUtils,
  pexUtils,
} from './service';
import {validation} from './config';
import {CredentialServiceRPC} from './service-rpc';
import {OpenID4VCIClientV1_0_13} from '@sphereon/oid4vci-client';
import {didService} from '../dids/service';

describe('Credential Service', () => {
  beforeAll(async () => {
    const mockAddCredentialToPresent = jest.fn(() => 0);
    const mockAddAttributeToReveal = jest.fn();
    const mockCreatePresentation = jest.fn();
    const mockDeriveCredentials = jest.fn(() => []);

    jest
      .spyOn(serviceCredentialUtils, 'Presentation')
      .mockImplementation(() => {
        return {
          addCredentialToPresent: mockAddCredentialToPresent,
          addAttributeToReveal: mockAddAttributeToReveal,
          createPresentation: mockCreatePresentation,
          deriveCredentials: mockDeriveCredentials,
          presBuilder: {
            enforceBounds: jest.fn(),
          },
        };
      });
  });
  it('ServiceRpc', () => {
    assertRpcService(CredentialServiceRPC, service, validation);
  });
  it('expect to validate errors when verifying credential', async () => {
    const error0 = await getPromiseError(() => service.verifyCredential({}));
    expect(error0.message).toBe('invalid credential');
  });
  it('expect to reject SD-JWT credentials missing compact serialization', async () => {
    const result = await service.verifyCredential({
      credential: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'BasicCredential'],
        issuer: 'did:example:issuer',
        credentialSubject: {},
        _sd_jwt: {
          // decoded-payload imports store metadata without an encoded JWT
        },
      },
    });

    expect(result.verified).toBe(false);
    expect(result.error).toContain('compact serialization');
  });
  it('expect to verify credential', async () => {
    jest
      .spyOn(serviceCredentialUtils, 'verifyCredential')
      .mockImplementationOnce(async () => ({verified: true}));
    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        {
          dk: 'https://ld.dock.io/credentials#',
          BasicCredential: 'dk:BasicCredential',
          name: 'dk:name',
          email: 'dk:email',
          title: 'dk:title',
          description: 'dk:description',
          logo: 'dk:logo',
        },
        {
          prettyVC: 'https://ld.dock.io/credentials#prettyVC',
          orientation: 'https://ld.dock.io/credentials#orientation',
          size: 'https://ld.dock.io/credentials#size',
        },
      ],
      credentialStatus: {
        id: 'rev-reg:dock:0xccf6767a9337d89171a478a31318db2e55a6e7bd0858e080fdd6507990072a63',
        type: 'CredentialStatusList2017',
      },
      id: 'https://creds-testnet.dock.io/e185bba44983790adab513caa84c9ec4debaa2efa9f59b62d96f392eccfdefb6',
      type: ['VerifiableCredential', 'BasicCredential'],
      credentialSubject: {
        id: 'ifeanyiosinakayah15@gmail.com',
        name: 'Ifeanyi Osinakayah',
        email: 'ifeanyiosinakayah15@gmail.com',
        title: 'Basic Credential',
      },
      issuanceDate: '2022-10-26T21:01:54.492Z',
      expirationDate: '2024-10-25T23:00:00.000Z',

      proof: {
        type: 'Ed25519Signature2018',
        created: '2022-10-26T21:03:26Z',
        verificationMethod:
          'did:dock:5DXYT99kpHozJwp8TDbTiwrtoMxJ8Nbq8pSQ8w3hWMz1hw64#keys-1',
        proofPurpose: 'assertionMethod',
        proofValue:
          'z54wiAXqaiwVu3z7ypPEfKrf9bfnsjjUcWkTzqJ6nCsdMjwx3KSYqPN5VoGrSqgg83Ug99QKhLJ8geQhDTaoxdyYP',
      },
      issuer: {
        name: 'Ifeanyi Osinakayah',
        description: '',
        logo: '',
        id: 'did:dock:5DXYT99kpHozJwp8TDbTiwrtoMxJ8Nbq8pSQ8w3hWMz1hw64',
      },
    };
    await service.verifyCredential({credential});
    expect(serviceCredentialUtils.verifyCredential).toBeCalled();
  });
  it('should create a vc', async () => {
    const subject = {
      state: 'debugstate',
    };
    const vc = await service.generateCredential({subject});
    expect(vc).toBeDefined();
    expect(vc).toHaveProperty('context');
    expect(vc).toHaveProperty('credentialSubject', subject);
    expect(vc.type).toContain('VerifiableCredential');
    expect(vc.type).toContain('DockAuthCredential');
  });

  it('should sign a vc', async () => {
    const vc = await service.generateCredential();
    const keyDoc = {
      id: 'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ#z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
      controller: 'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
      type: 'Ed25519VerificationKey2018',
      publicKeyBase58: '3urLbVGF6ouYwgotxFy6637VcLqugU2s9i2XVY2yGU4v',
      privateKeyBase58:
        '3rF4Jhp7vF6tavGZCSgkdMM3ANLB7YpmzfRcB5FTs1Q7EgN6u5cCwzCaHCDYcestRSEHzjF82TvJUaj3mdqcbGnS',
      publicKeyMultibase: 'z3urLbVGF6ouYwgotxFy6637VcLqugU2s9i2XVY2yGU4v',
      privateKeyMultibase:
        'z3rF4Jhp7vF6tavGZCSgkdMM3ANLB7YpmzfRcB5FTs1Q7EgN6u5cCwzCaHCDYcestRSEHzjF82TvJUaj3mdqcbGnS',
    };

    const signVc = await service.signCredential({vcJson: vc.toJSON(), keyDoc});
    expect(signVc).toBeDefined();

    expect(signVc).toHaveProperty('proof');
    expect(signVc).toHaveProperty('issuer', keyDoc.controller);
    expect(signVc.type).toContain('VerifiableCredential');
  });
  it('expect to validate errors', async () => {
    const error0 = await getPromiseError(() =>
      service.createPresentation({
        credentials: [],
      }),
    );
    expect(error0.message).toBe('invalid id');

    const error1 = await getPromiseError(() =>
      service.createPresentation({
        id: 'http://example.edu/credentials/1986',
        credentials: [],
      }),
    );
    expect(error1.message).toBe('invalid KeyDoc');
    const error2 = await getPromiseError(() =>
      service.createPresentation({
        id: 'http://example.edu/credentials/1986',
        keyDoc: {},
        credentials: [],
      }),
    );
    expect(error2.message).toBe('invalid challenge');
  });
  it('should create presentation', async () => {
    const credentials = [
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          {
            dk: 'https://ld.dock.io/credentials#',
            DockAuthCredential: 'dk:DockAuthCredential',
          },
          {state: 'dk:state'},
        ],
        id: 'http://example.edu/credentials/2803',
        type: ['VerifiableCredential', 'DockAuthCredential'],
        credentialSubject: {
          state: 'dockstagingtestHsBR-jkCCPl4sBOh3f3_n66r9X1uIKgW',
        },
        issuanceDate: '2022-08-26T09:12:15.530Z',
        issuer: 'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
        proof: {
          type: 'Ed25519Signature2018',
          created: '2022-08-26T09:12:15Z',
          verificationMethod:
            'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ#z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
          proofPurpose: 'assertionMethod',
          proofValue:
            'z2DjngsHeuSUNZgfEZ3Vw8TRw3H2g8jobzzWeQU3P2fQcN4RMy9h7vHZCi63yR2iQnPTHnsfaG8MCcKnooXVx2zFz',
        },
      },
    ];
    const keyDoc = {
      id: 'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ#z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
      controller: 'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
      type: 'Ed25519VerificationKey2018',
      publicKeyBase58: '3urLbVGF6ouYwgotxFy6637VcLqugU2s9i2XVY2yGU4v',
      privateKeyBase58:
        '3rF4Jhp7vF6tavGZCSgkdMM3ANLB7YpmzfRcB5FTs1Q7EgN6u5cCwzCaHCDYcestRSEHzjF82TvJUaj3mdqcbGnS',
      publicKeyMultibase: 'z3urLbVGF6ouYwgotxFy6637VcLqugU2s9i2XVY2yGU4v',
      privateKeyMultibase:
        'z3rF4Jhp7vF6tavGZCSgkdMM3ANLB7YpmzfRcB5FTs1Q7EgN6u5cCwzCaHCDYcestRSEHzjF82TvJUaj3mdqcbGnS',
    };
    const presentation = await service.createPresentation({
      credentials,
      keyDoc,
      challenge: 'Test',
      id: 'http://example.edu/credentials/1986',
    });
    expect(presentation).toHaveProperty('proof');
    expect(presentation.type).toContain('VerifiablePresentation');
  });

  it('should create unsigned presentation for bbs+ vc', async () => {
    const credentials = [
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://ld.dock.io/security/bbs/v1',
          {
            dk: 'https://ld.dock.io/credentials#',
            BasicCredential: 'dk:BasicCredential',
            name: 'dk:name',
          },
          'https://ld.dock.io/credentials/prettyvc',
        ],
        id: 'http://example.edu/credentials/2803',
        type: ['VerifiableCredential', 'DockAuthCredential'],
        credentialSubject: {
          state: 'dockstagingtestHsBR-jkCCPl4sBOh3f3_n66r9X1uIKgW',
        },
        issuanceDate: '2022-08-26T09:12:15.530Z',
        issuer: 'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
        proof: {
          type: 'Bls12381BBS+SignatureDock2022',
          created: '2022-08-26T09:12:15Z',
          verificationMethod:
            'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ#z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
          proofPurpose: 'assertionMethod',
          proofValue:
            'z2DjngsHeuSUNZgfEZ3Vw8TRw3H2g8jobzzWeQU3P2fQcN4RMy9h7vHZCi63yR2iQnPTHnsfaG8MCcKnooXVx2zFz',
        },
      },
    ];
    const keyDoc = {
      id: 'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ#z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
      controller: 'did:key:z6MkhN7PBjWgSMQ24Bebdpvvw8fVRv7m6MHDqiwTKozzBgrJ',
      type: 'Ed25519VerificationKey2018',
      publicKeyBase58: '3urLbVGF6ouYwgotxFy6637VcLqugU2s9i2XVY2yGU4v',
      privateKeyBase58:
        '3rF4Jhp7vF6tavGZCSgkdMM3ANLB7YpmzfRcB5FTs1Q7EgN6u5cCwzCaHCDYcestRSEHzjF82TvJUaj3mdqcbGnS',
      publicKeyMultibase: 'z3urLbVGF6ouYwgotxFy6637VcLqugU2s9i2XVY2yGU4v',
      privateKeyMultibase:
        'z3rF4Jhp7vF6tavGZCSgkdMM3ANLB7YpmzfRcB5FTs1Q7EgN6u5cCwzCaHCDYcestRSEHzjF82TvJUaj3mdqcbGnS',
    };
    const presentation = await service.createPresentation({
      credentials,
      keyDoc,
      challenge: 'Test',
      id: 'http://example.edu/credentials/1986',
    });

    expect(presentation.proof).toBeNull();
    expect(presentation.type).toContain('VerifiablePresentation');
  });

  it('expect to create bbs+ presentation', async () => {
    const error1 = await getPromiseError(() =>
      service.createBBSPresentation({
        credentials: [],
      }),
    );
    expect(error1.message).toBe('no credential found');

    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/citizenship/v1',
        'https://ld.dock.io/security/bbs/v1',
      ],
      id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
      type: ['VerifiableCredential', 'PermanentResidentCard'],
      credentialSchema: {
        id: 'data:application/json;charset=utf-8,%7B%22%24schema%22%3A%22http%3A%2F%2Fjson-schema.org%2Fdraft-07%2Fschema%23%22%2C%22%24id%22%3A%22https%3A%2F%2Fld.dock.io%2Fexamples%2Fresident-card-schema.json%22%2C%22title%22%3A%22Resident%20Card%20Example%22%2C%22type%22%3A%22object%22%2C%22properties%22%3A%7B%22%40context%22%3A%7B%22title%22%3A%22Context%22%2C%22type%22%3A%22array%22%2C%22items%22%3A%5B%7B%22type%22%3A%22string%22%7D%2C%7B%22type%22%3A%22string%22%7D%2C%7B%22type%22%3A%22string%22%7D%5D%7D%2C%22id%22%3A%7B%22title%22%3A%22Id%22%2C%22type%22%3A%22string%22%7D%2C%22type%22%3A%7B%22title%22%3A%22Type%22%2C%22type%22%3A%22array%22%2C%22items%22%3A%5B%7B%22type%22%3A%22string%22%7D%2C%7B%22type%22%3A%22string%22%7D%5D%7D%2C%22identifier%22%3A%7B%22title%22%3A%22identifier%22%2C%22type%22%3A%22string%22%7D%2C%22name%22%3A%7B%22title%22%3A%22Name%22%2C%22type%22%3A%22string%22%7D%2C%22description%22%3A%7B%22title%22%3A%22Desc%22%2C%22type%22%3A%22string%22%7D%2C%22credentialSubject%22%3A%7B%22type%22%3A%22object%22%2C%22properties%22%3A%7B%22id%22%3A%7B%22title%22%3A%22Id%22%2C%22type%22%3A%22string%22%7D%2C%22type%22%3A%7B%22title%22%3A%22Type%22%2C%22type%22%3A%22array%22%2C%22items%22%3A%5B%7B%22type%22%3A%22string%22%7D%2C%7B%22type%22%3A%22string%22%7D%5D%7D%2C%22givenName%22%3A%7B%22title%22%3A%22Given%20Name%22%2C%22type%22%3A%22string%22%7D%2C%22familyName%22%3A%7B%22title%22%3A%22Family%20Name%22%2C%22type%22%3A%22string%22%7D%2C%22lprNumber%22%3A%7B%22title%22%3A%22LPR%20Number%22%2C%22type%22%3A%22integer%22%2C%22minimum%22%3A0%7D%7D%2C%22required%22%3A%5B%5D%7D%2C%22expirationDate%22%3A%7B%22title%22%3A%22Expiration%20Date%22%2C%22type%22%3A%22string%22%7D%2C%22issuanceDate%22%3A%7B%22title%22%3A%22Issuance%20Date%22%2C%22type%22%3A%22string%22%7D%2C%22issuer%22%3A%7B%22title%22%3A%22Issuer%20DID%22%2C%22type%22%3A%22string%22%7D%7D%7D',
        type: 'JsonSchemaValidator2018',
      },
      identifier: '83627465',
      name: 'Permanent Resident Card',
      description: 'Government of Example Permanent Resident Card.',
      issuanceDate: '2019-12-03T12:19:52Z',
      expirationDate: '2029-12-03T12:19:52Z',
      credentialSubject: {
        id: 'did:example:b34ca6cd37bbf23',
        type: ['PermanentResident', 'Person'],
        givenName: 'JOHN',
        familyName: 'SMITH',
        lprNumber: 1234,
      },
      issuer: 'did:dock:5EoFfpCyEz1vsBXFP7WPYdaKiFqZaBZa44D2tpFMsEkGVt6P',
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
        created: '2022-12-15T06:39:29Z',
        verificationMethod:
          'did:dock:5EoFfpCyEz1vsBXFP7WPYdaKiFqZaBZa44D2tpFMsEkGVt6P#keys-2',
        proofPurpose: 'assertionMethod',
        proofValue:
          'zVogTRy3DCBqMszawwHN25vBYJLANQjyQQbQBj8j356F8bgUEYJurDvEe4SdZVsfGNEc9Q7de6iiDKYrTtdcs4hKidUZz5FBaj5HyPSHp1mbYZ4c4VhxQnrbnpi6gYezvQuq8rBxwG5gFpqoyPqtsGXeC1',
      },
    };

    const credentials = [
      {credential, attributesToReveal: ['credentialSubject.givenName']},
    ];

    await service.createBBSPresentation({
      credentials,
    });

    const bbsPresentation = new serviceCredentialUtils.Presentation();
    expect(bbsPresentation.addCredentialToPresent).toBeCalledWith(
      credential,
      expect.any(Object),
    );
    expect(bbsPresentation.addAttributeToReveal).toBeCalledWith(0, [
      'credentialSubject.givenName',
    ]);
    expect(bbsPresentation.createPresentation).toBeCalled();
  });
  it('expect to derive vc from bbs+ presentation', async () => {
    const error1 = await getPromiseError(() =>
      service.deriveVCFromPresentation({
        credentials: [],
      }),
    );
    expect(error1.message).toBe('no credential found');

    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/citizenship/v1',
        'https://ld.dock.io/security/bbs/v1',
      ],
      id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
      type: ['VerifiableCredential', 'PermanentResidentCard'],
      credentialSchema: {
        id: 'data:application/json;charset=utf-8,%7B%22%24schema%22%3A%22http%3A%2F%2Fjson-schema.org%2Fdraft-07%2Fschema%23%22%2C%22%24id%22%3A%22https%3A%2F%2Fld.dock.io%2Fexamples%2Fresident-card-schema.json%22%2C%22title%22%3A%22Resident%20Card%20Example%22%2C%22type%22%3A%22object%22%2C%22properties%22%3A%7B%22%40context%22%3A%7B%22title%22%3A%22Context%22%2C%22type%22%3A%22array%22%2C%22items%22%3A%5B%7B%22type%22%3A%22string%22%7D%2C%7B%22type%22%3A%22string%22%7D%2C%7B%22type%22%3A%22string%22%7D%5D%7D%2C%22id%22%3A%7B%22title%22%3A%22Id%22%2C%22type%22%3A%22string%22%7D%2C%22type%22%3A%7B%22title%22%3A%22Type%22%2C%22type%22%3A%22array%22%2C%22items%22%3A%5B%7B%22type%22%3A%22string%22%7D%2C%7B%22type%22%3A%22string%22%7D%5D%7D%2C%22identifier%22%3A%7B%22title%22%3A%22identifier%22%2C%22type%22%3A%22string%22%7D%2C%22name%22%3A%7B%22title%22%3A%22Name%22%2C%22type%22%3A%22string%22%7D%2C%22description%22%3A%7B%22title%22%3A%22Desc%22%2C%22type%22%3A%22string%22%7D%2C%22credentialSubject%22%3A%7B%22type%22%3A%22object%22%2C%22properties%22%3A%7B%22id%22%3A%7B%22title%22%3A%22Id%22%2C%22type%22%3A%22string%22%7D%2C%22type%22%3A%7B%22title%22%3A%22Type%22%2C%22type%22%3A%22array%22%2C%22items%22%3A%5B%7B%22type%22%3A%22string%22%7D%2C%7B%22type%22%3A%22string%22%7D%5D%7D%2C%22givenName%22%3A%7B%22title%22%3A%22Given%20Name%22%2C%22type%22%3A%22string%22%7D%2C%22familyName%22%3A%7B%22title%22%3A%22Family%20Name%22%2C%22type%22%3A%22string%22%7D%2C%22lprNumber%22%3A%7B%22title%22%3A%22LPR%20Number%22%2C%22type%22%3A%22integer%22%2C%22minimum%22%3A0%7D%7D%2C%22required%22%3A%5B%5D%7D%2C%22expirationDate%22%3A%7B%22title%22%3A%22Expiration%20Date%22%2C%22type%22%3A%22string%22%7D%2C%22issuanceDate%22%3A%7B%22title%22%3A%22Issuance%20Date%22%2C%22type%22%3A%22string%22%7D%2C%22issuer%22%3A%7B%22title%22%3A%22Issuer%20DID%22%2C%22type%22%3A%22string%22%7D%7D%7D',
        type: 'JsonSchemaValidator2018',
      },
      issuanceDate: '2019-12-03T12:19:52Z',
      expirationDate: '2029-12-03T12:19:52Z',
      credentialSubject: {
        id: 'did:example:b34ca6cd37bbf23',
        type: ['PermanentResident', 'Person'],
        givenName: 'JOHN',
        familyName: 'SMITH',
        lprNumber: 1234,
      },
      issuer: 'did:dock:5EoFfpCyEz1vsBXFP7WPYdaKiFqZaBZa44D2tpFMsEkGVt6P',
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
        created: '2022-12-15T06:39:29Z',
        verificationMethod:
          'did:dock:5EoFfpCyEz1vsBXFP7WPYdaKiFqZaBZa44D2tpFMsEkGVt6P#keys-2',
        proofPurpose: 'assertionMethod',
        proofValue:
          'zVogTRy3DCBqMszawwHN25vBYJLANQjyQQbQBj8j356F8bgUEYJurDvEe4SdZVsfGNEc9Q7de6iiDKYrTtdcs4hKidUZz5FBaj5HyPSHp1mbYZ4c4VhxQnrbnpi6gYezvQuq8rBxwG5gFpqoyPqtsGXeC1',
      },
    };

    const credentials = [
      {credential, attributesToReveal: ['credentialSubject.givenName']},
    ];

    await service.deriveVCFromPresentation({
      credentials,
    });

    const bbsPresentation = new serviceCredentialUtils.Presentation();
    expect(bbsPresentation.addCredentialToPresent).toBeCalledWith(
      credential,
      expect.any(Object),
    );
    expect(bbsPresentation.addAttributeToReveal).toBeCalledWith(0, [
      'credentialSubject.givenName',
    ]);
    expect(bbsPresentation.deriveCredentials).toBeCalledWith({});
  });

  describe('BBS+ revocation', () => {
    it('should get revocation id', async () => {
      expect(
        await service.getAccumulatorId({
          credential: {
            id: 'https://creds.dock.io/ba6740d0a8db6ff8fc9ce68c402a8c14f9b541b1a52fb895008452227c88e37d',
            type: ['VerifiableCredential', 'PersonalData'],
          },
        }),
      ).toBe(null);
      expect(
        await service.getAccumulatorId({
          credential: {
            id: 'https://creds.dock.io/ba6740d0a8db6ff8fc9ce68c402a8c14f9b541b1a52fb895008452227c88e37d',
            type: ['VerifiableCredential', 'PersonalData'],
            credentialStatus: {
              id: 'dock:accumulator:0xa632a41f2fbdb681c14b33daae4fcc46af41661b90b35c4ac1545c9bebf0d7cc',
              type: 'DockVBAccumulator2022',
              revocationCheck: 'membership',
              revocationId: '7',
            },
          },
        }),
      ).toBe(
        'dock:accumulator:0xa632a41f2fbdb681c14b33daae4fcc46af41661b90b35c4ac1545c9bebf0d7cc',
      );
    });
  });

  it('should check if a credential has KVAC support', () => {
    expect(
      service.isKvacCredential({
        credential: {
          proof: {
            type: 'Bls12381BDDT16MACDock2024',
          },
        },
      }),
    ).toBe(false);

    expect(
      service.isKvacCredential({
        credential: {
          proof: {
            type: 'Bls12381BBDT16MACDock2024',
          },
        },
      }),
    ).toBe(true);
  });

  describe('acquireOIDCredential', () => {
    const mockHolderKeyDocument = {
      id: 'did:example:123#key-1',
      controller: 'did:example:123',
    };

    const mockCredential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'MyCredential'],
      issuer:
        'https://api-testnet.truvera.io/openid/issuers/7eff516f-69fb-4b9d-94dc-e88308ec0c4c',
      credentialSubject: {
        id: 'did:example:123',
        name: 'John Doe',
      },
      proof: {
        type: 'Ed25519Signature2018',
        created: '2024-03-31T12:00:00Z',
        proofPurpose: 'assertionMethod',
        verificationMethod: 'did:example:123#key-1',
        proofValue: 'mockProofValue',
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle credential_offer parameter', async () => {
      const uri =
        'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fapi-testnet.truvera.io%2Fopenid%2Fissuers%2F7eff516f-69fb-4b9d-94dc-e88308ec0c4c%22%2C%22credentials%22%3A%5B%22ldp_vc%3AMyCredential%22%5D%2C%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22AAL4MPpEpWY6daBxVxJ8Q3chxOhvc9qIV3EAyj7dvps%22%2C%22user_pin_required%22%3Afalse%7D%7D%7D';

      const mockClient = {
        credentialOffer: {
          preAuthorizedCode: 'AAL4MPpEpWY6daBxVxJ8Q3chxOhvc9qIV3EAyj7dvps',
        },
        acquireAccessToken: jest.fn(),
        acquireCredentials: jest
          .fn()
          .mockResolvedValue({credential: mockCredential}),
        getCredentialsSupported: jest
          .fn()
          .mockReturnValue([{scope: 'ldp_vc:MyCredential'}]),
      };

      jest
        .spyOn(OpenID4VCIClientV1_0_13, 'fromURI')
        .mockResolvedValue(mockClient);
      jest
        .spyOn(didService, 'createSignedJWT')
        .mockResolvedValue('mock.jwt.token');

      const result = await service.acquireOIDCredential({
        uri,
        holderKeyDocument: mockHolderKeyDocument,
      });

      expect(result).toEqual({
        credential: mockCredential,
      });
    });

    it('should handle credential_offer_uri parameter', async () => {
      const uri =
        'openid-credential-offer://?credential_offer_uri=https://api.truvera.io/openid/credential-offers/6783b6ff-b84d-4e6a-850d-f3828e2c1526';

      // Mock OpenID4VCIClientV1_0_13
      const mockClient = {
        credentialOffer: {
          preAuthorizedCode: 'AAL4MPpEpWY6daBxVxJ8Q3chxOhvc9qIV3EAyj7dvps',
        },
        acquireAccessToken: jest.fn(),
        acquireCredentials: jest
          .fn()
          .mockResolvedValue({credential: mockCredential}),
        getCredentialsSupported: jest
          .fn()
          .mockReturnValue([{scope: 'ldp_vc:MyCredential'}]),
      };

      jest
        .spyOn(OpenID4VCIClientV1_0_13, 'fromURI')
        .mockResolvedValue(mockClient);
      jest
        .spyOn(didService, 'createSignedJWT')
        .mockResolvedValue('mock.jwt.token');

      const result = await service.acquireOIDCredential({
        uri,
        holderKeyDocument: mockHolderKeyDocument,
      });

      expect(result).toEqual({
        credential: mockCredential,
      });
    });

    it('should return authorization URL when no pre-authorized code is available', async () => {
      const uri =
        'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fapi-testnet.truvera.io%2Fopenid%2Fissuers%2F7eff516f-69fb-4b9d-94dc-e88308ec0c4c%22%2C%22credentials%22%3A%5B%22ldp_vc%3AMyCredential%22%5D%7D';
      const mockClient = {
        credentialOffer: {},
        authorizationURL:
          'https://api-testnet.truvera.io/openid/authorize?response_type=code&client_id=dock.wallet&redirect_uri=dock-wallet%3A%2F%2Fcredentials%2Fcallback&scope=ldp_vc%3AMyCredential',
        getCredentialsSupported: jest
          .fn()
          .mockReturnValue([{scope: 'ldp_vc:MyCredential'}]),
      };

      jest
        .spyOn(OpenID4VCIClientV1_0_13, 'fromURI')
        .mockResolvedValue(mockClient);

      const result = await service.acquireOIDCredential({
        uri,
        holderKeyDocument: mockHolderKeyDocument,
      });

      expect(result).toEqual({
        authorizationURL: mockClient.authorizationURL,
      });
    });
  });

  describe('generatePresentationFromPex', () => {
    let generateSpy;

    const basePexRequest = {
      id: 'test-request',
      input_descriptors: [
        {
          id: 'Credential 1',
          constraints: {fields: [{path: ['$.type[*]']}]},
        },
      ],
    };

    const baseCredential = {
      id: 'https://example.com/credential/1',
      type: ['VerifiableCredential'],
      credentialSubject: {id: 'did:example:123', name: 'Test'},
      proof: {type: 'Bls12381BBS+SignatureDock2022'},
    };

    beforeEach(() => {
      generateSpy = jest.spyOn(pexUtils, 'generatePresentationFromPexRequest');
    });

    afterEach(() => {
      generateSpy.mockRestore();
    });

    it('should reject empty credentials array', async () => {
      const error = await getPromiseError(() =>
        service.generatePresentationFromPex({
          credentials: [],
          pexRequest: basePexRequest,
          challenge: 'test-challenge',
        }),
      );
      expect(error.message).toBe('no credential found');
    });

    it('should reject non-array credentials', async () => {
      const error = await getPromiseError(() =>
        service.generatePresentationFromPex({
          credentials: 'invalid',
          pexRequest: basePexRequest,
          challenge: 'test-challenge',
        }),
      );
      expect(error.message).toBe('invalid credentials');
    });

    it('should reject missing pexRequest', async () => {
      const error = await getPromiseError(() =>
        service.generatePresentationFromPex({
          credentials: [{credential: baseCredential}],
          challenge: 'test-challenge',
        }),
      );
      expect(error.message).toBe('pexRequest is required');
    });

    it('should reject missing challenge', async () => {
      const error = await getPromiseError(() =>
        service.generatePresentationFromPex({
          credentials: [{credential: baseCredential}],
          pexRequest: basePexRequest,
        }),
      );
      expect(error.message).toBe('challenge is required');
    });

    it('should call generatePresentationFromPexRequest and return presentation', async () => {
      const mockPresentation = {
        type: ['VerifiablePresentation'],
        verifiableCredential: [baseCredential],
      };

      generateSpy.mockResolvedValueOnce({
        status: pexUtils.GeneratePresentationStatus.SUCCESS,
        presentation: mockPresentation,
      });

      const result = await service.generatePresentationFromPex({
        credentials: [
          {
            credential: baseCredential,
            attributesToReveal: ['credentialSubject.name'],
          },
        ],
        pexRequest: basePexRequest,
        challenge: 'test-challenge',
        domain: 'dock.io',
        skipSigning: true,
      });

      expect(result).toEqual(mockPresentation);
      expect(pexUtils.generatePresentationFromPexRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: [baseCredential],
          pexRequest: basePexRequest,
          challenge: 'test-challenge',
          domain: 'dock.io',
          skipSigning: true,
          selectiveDisclosure: {
            credentials: [
              {
                attributes: ['credentialSubject.name', 'id'],
                witness: undefined,
              },
            ],
          },
        }),
      );
    });

    it('should throw when generation status is not SUCCESS', async () => {
      generateSpy.mockResolvedValueOnce({
        status: pexUtils.GeneratePresentationStatus.REQUIREMENTS_NOT_MET,
        error: new Error(
          'Credentials do not satisfy the presentation definition',
        ),
      });

      const error = await getPromiseError(() =>
        service.generatePresentationFromPex({
          credentials: [{credential: baseCredential}],
          pexRequest: basePexRequest,
          challenge: 'test-challenge',
          skipSigning: true,
        }),
      );

      expect(error.message).toBe(
        'Credentials do not satisfy the presentation definition',
      );
    });

    it('should throw generic error when generation fails without error object', async () => {
      generateSpy.mockResolvedValueOnce({
        status: pexUtils.GeneratePresentationStatus.REQUIREMENTS_NOT_MET,
      });

      const error = await getPromiseError(() =>
        service.generatePresentationFromPex({
          credentials: [{credential: baseCredential}],
          pexRequest: basePexRequest,
          challenge: 'test-challenge',
          skipSigning: true,
        }),
      );

      expect(error.message).toBe(
        'Presentation generation failed: requirements_not_met',
      );
    });

    it('should pass credentials without witness as undefined', async () => {
      generateSpy.mockResolvedValueOnce({
        status: pexUtils.GeneratePresentationStatus.SUCCESS,
        presentation: {type: ['VerifiablePresentation']},
      });

      await service.generatePresentationFromPex({
        credentials: [{credential: baseCredential, attributesToReveal: []}],
        pexRequest: basePexRequest,
        challenge: 'test-challenge',
        skipSigning: true,
      });

      const callArgs = generateSpy.mock.calls[0][0];
      expect(
        callArgs.selectiveDisclosure.credentials[0].witness,
      ).toBeUndefined();
    });

    it('should not include loadProvingKey when no boundCheckSnarkKey', async () => {
      generateSpy.mockResolvedValueOnce({
        status: pexUtils.GeneratePresentationStatus.SUCCESS,
        presentation: {type: ['VerifiablePresentation']},
      });

      await service.generatePresentationFromPex({
        credentials: [{credential: baseCredential}],
        pexRequest: basePexRequest,
        challenge: 'test-challenge',
        skipSigning: true,
      });

      const callArgs = generateSpy.mock.calls[0][0];
      expect(callArgs.loadProvingKey).toBeUndefined();
    });

    it('should include loadProvingKey when boundCheckSnarkKey is provided', async () => {
      generateSpy.mockResolvedValueOnce({
        status: pexUtils.GeneratePresentationStatus.SUCCESS,
        presentation: {type: ['VerifiablePresentation']},
      });

      await service.generatePresentationFromPex({
        credentials: [{credential: baseCredential}],
        pexRequest: basePexRequest,
        challenge: 'test-challenge',
        boundCheckSnarkKey: 'SGVsbG8gV29ybGQ=',
        skipSigning: true,
      });

      const callArgs = generateSpy.mock.calls[0][0];
      expect(typeof callArgs.loadProvingKey).toBe('function');
    });

    it('should always append id to attributesToReveal', async () => {
      generateSpy.mockResolvedValueOnce({
        status: pexUtils.GeneratePresentationStatus.SUCCESS,
        presentation: {type: ['VerifiablePresentation']},
      });

      await service.generatePresentationFromPex({
        credentials: [
          {
            credential: baseCredential,
            attributesToReveal: ['credentialSubject.name'],
          },
          {credential: baseCredential},
        ],
        pexRequest: basePexRequest,
        challenge: 'test-challenge',
        skipSigning: true,
      });

      const callArgs = generateSpy.mock.calls[0][0];
      expect(callArgs.selectiveDisclosure.credentials[0].attributes).toEqual([
        'credentialSubject.name',
        'id',
      ]);
      expect(callArgs.selectiveDisclosure.credentials[1].attributes).toEqual([
        'id',
      ]);
    });
  });
});
