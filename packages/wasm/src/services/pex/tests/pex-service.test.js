import {pexService, removeOptionalAttribute} from '../service';

describe('Pex Examples', () => {
  it('expect to filter credentials based on a minimum value numeric filter', () => {
    const credentials = [
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          {
            dk: 'https://ld.dock.io/credentials#',
            product1: 'dk:product1',
            price: 'dk:price',
            product2: 'dk:product2',
            product3: 'dk:product3',
            logo: 'dk:logo',
          },
        ],
        id: 'https://creds-testnet.dock.io/b2d23ad1236d41d953148d30e167af38d3099368bdcc36505485dc07f48b330d',
        type: ['VerifiableCredential', 'CommercialInvoiceSchema'],
        credentialSubject: {
          product1: {
            price: 200,
          },
          product2: {},
          product3: {},
        },
        issuanceDate: '2023-04-03T17:33:04.679Z',
        name: 'Should be included',
        issuer: {
          name: 'Test-Issuer',
          description: '',
          logo: '',
          id: 'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX',
        },
        proof: {
          type: 'Ed25519Signature2018',
          created: '2023-05-19T18:19:17Z',
          verificationMethod:
            'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX#keys-1',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..wa8fFgdM-MHVCz1pG0Zfvg5mgy0zOU0v8g0i9kn2IPJcLZpMBTBbQlG0tuL01eYriF4mK6cBLXEMF6lbLtLwCg',
        },
      },
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          {
            dk: 'https://ld.dock.io/credentials#',
            product1: 'dk:product1',
            price: 'dk:price',
            product2: 'dk:product2',
            product3: 'dk:product3',
            logo: 'dk:logo',
          },
        ],
        id: 'https://creds-testnet.dock.io/b2d23ad1236d41d953148d30e167af38d3099368bdcc36505485dc07f48b330d',
        type: ['VerifiableCredential', 'CommercialInvoiceSchema'],
        credentialSubject: {
          product1: {
            price: 50,
          },
          product2: {},
          product3: {},
        },
        issuanceDate: '2023-04-03T17:33:04.679Z',
        name: 'Should be excluded',
        issuer: {
          name: 'Test-Issuer',
          description: '',
          logo: '',
          id: 'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX',
        },
        proof: {
          type: 'Ed25519Signature2018',
          created: '2023-05-19T18:19:17Z',
          verificationMethod:
            'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX#keys-1',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..wa8fFgdM-MHVCz1pG0Zfvg5mgy0zOU0v8g0i9kn2IPJcLZpMBTBbQlG0tuL01eYriF4mK6cBLXEMF6lbLtLwCg',
        },
      },
    ];

    const presentationDefinition = {
      id: 'income_test',
      input_descriptors: [
        {
          id: 'ProofIncome-Merit-7',
          name: 'Test price over 100',
          purpose: 'Provedegree',
          constraints: {
            fields: [
              {
                path: ['$.credentialSubject.product1.price'],
                filter: {
                  type: 'number',
                  minimum: 100,
                },
              },
            ],
          },
        },
      ],
    };

    const results = pexService.filterCredentials({
      credentials,
      presentationDefinition,
    });

    expect(results.verifiableCredential).toBeTruthy();
    expect(results.verifiableCredential.length).toBe(1);
  });
  it('expect to filter credentials based on a date range filter', () => {
    const credentials = [
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          {
            dk: 'https://ld.dock.io/credentials#',
            product1: 'dk:product1',
            price: 'dk:price',
            product2: 'dk:product2',
            product3: 'dk:product3',
            logo: 'dk:logo',
          },
        ],
        id: 'https://creds-testnet.dock.io/b2d23ad1236d41d953148d30e167af38d3099368bdcc36505485dc07f48b330d',
        type: ['VerifiableCredential', 'CommercialInvoiceSchema'],
        credentialSubject: {
          product1: {
            price: 200,
            release_date: '2000-07-29',
          },
          product2: {},
          product3: {},
        },
        issuanceDate: '2023-04-03T17:33:04.679Z',
        name: 'Should be included',
        issuer: {
          name: 'Test-Issuer',
          description: '',
          logo: '',
          id: 'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX',
        },
        proof: {
          type: 'Ed25519Signature2018',
          created: '2023-05-19T18:19:17Z',
          verificationMethod:
            'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX#keys-1',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..wa8fFgdM-MHVCz1pG0Zfvg5mgy0zOU0v8g0i9kn2IPJcLZpMBTBbQlG0tuL01eYriF4mK6cBLXEMF6lbLtLwCg',
        },
      },
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          {
            dk: 'https://ld.dock.io/credentials#',
            product1: 'dk:product1',
            price: 'dk:price',
            product2: 'dk:product2',
            product3: 'dk:product3',
            logo: 'dk:logo',
          },
        ],
        id: 'https://creds-testnet.dock.io/b2d23ad1236d41d953148d30e167af38d3099368bdcc36505485dc07f48b330d',
        type: ['VerifiableCredential', 'CommercialInvoiceSchema'],
        credentialSubject: {
          product1: {
            price: 200,
            release_date: '2010-11-21',
          },
          product2: {},
          product3: {},
        },
        issuanceDate: '2023-04-03T17:33:04.679Z',
        name: 'Should be included',
        issuer: {
          name: 'Test-Issuer',
          description: '',
          logo: '',
          id: 'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX',
        },
        proof: {
          type: 'Ed25519Signature2018',
          created: '2023-05-19T18:19:17Z',
          verificationMethod:
            'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX#keys-1',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..wa8fFgdM-MHVCz1pG0Zfvg5mgy0zOU0v8g0i9kn2IPJcLZpMBTBbQlG0tuL01eYriF4mK6cBLXEMF6lbLtLwCg',
        },
      },
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          {
            dk: 'https://ld.dock.io/credentials#',
            product1: 'dk:product1',
            price: 'dk:price',
            product2: 'dk:product2',
            product3: 'dk:product3',
            logo: 'dk:logo',
          },
        ],
        id: 'https://creds-testnet.dock.io/b2d23ad1236d41d953148d30e167af38d3099368bdcc36505485dc07f48b330d',
        type: ['VerifiableCredential', 'CommercialInvoiceSchema'],
        credentialSubject: {
          product1: {
            price: 50,
            release_date: '1990-03-19',
          },
          product2: {},
          product3: {},
        },
        issuanceDate: '2023-04-03T17:33:04.679Z',
        name: 'Should be excluded',
        issuer: {
          name: 'Test-Issuer',
          description: '',
          logo: '',
          id: 'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX',
        },
        proof: {
          type: 'Ed25519Signature2018',
          created: '2023-05-19T18:19:17Z',
          verificationMethod:
            'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX#keys-1',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..wa8fFgdM-MHVCz1pG0Zfvg5mgy0zOU0v8g0i9kn2IPJcLZpMBTBbQlG0tuL01eYriF4mK6cBLXEMF6lbLtLwCg',
        },
      },
    ];

    const presentationDefinition = {
      id: 'income_test',
      input_descriptors: [
        {
          id: 'ProofIncome-Merit-7',
          name: 'Test - released between 1995 and 2005',
          purpose: 'Filter credentials based released date',
          constraints: {
            fields: [
              {
                path: ['$.credentialSubject.product1.release_date'],
                filter: {
                  type: 'string',
                  format: 'date',
                  formatMinimum: '1995-01-01',
                  formatMaximum: '2005-12-31',
                },
              },
            ],
          },
        },
      ],
    };

    const results = pexService.filterCredentials({
      credentials,
      presentationDefinition,
    });

    expect(results.verifiableCredential).toBeTruthy();
    expect(results.verifiableCredential.length).toBe(1);
  });

  it('should fix PEX bug related to optional attributes', () => {
    const credentials = [
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          {
            dk: 'https://ld.dock.io/credentials#',
            product1: 'dk:product1',
            price: 'dk:price',
            product2: 'dk:product2',
            product3: 'dk:product3',
            logo: 'dk:logo',
          },
        ],
        id: 'https://creds-testnet.dock.io/b2d23ad1236d41d953148d30e167af38d3099368bdcc36505485dc07f48b330d',
        type: ['VerifiableCredential', 'CommercialInvoiceSchema'],
        credentialSubject: {
          product1: {
            price: 200,
            release_date: '2000-07-29',
          },
          product2: {},
          product3: {},
        },
        issuanceDate: '2023-04-03T17:33:04.679Z',
        name: 'Should be included',
        issuer: {
          name: 'Test-Issuer',
          description: '',
          logo: '',
          id: 'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX',
        },
        proof: {
          type: 'Ed25519Signature2018',
          created: '2023-05-19T18:19:17Z',
          verificationMethod:
            'did:dock:5H3jLBStH3zPH7ZfWFpfNHY8DMMTbVgqyTnsdQDk3v9xyXsX#keys-1',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..wa8fFgdM-MHVCz1pG0Zfvg5mgy0zOU0v8g0i9kn2IPJcLZpMBTBbQlG0tuL01eYriF4mK6cBLXEMF6lbLtLwCg',
        },
      },
    ];

    let presentationDefinition = {
      id: 'income_test',
      input_descriptors: [
        {
          id: 'Credential 1',
          name: 'optional field',
          purpose: 'optional field',
          constraints: {
            fields: [
              {
                path: ['$.credentialSubject.id'],
              },
              {
                path: ['$.type[*]'],
                filter: {
                  const: '',
                },
                optional: true,
              },
              {
                path: ['$.expirationDate'],
                optional: false,
              },
            ],
          },
        },
      ],
    };

    let results = pexService.filterCredentials({
      credentials,
      presentationDefinition,
    });

    expect(results.verifiableCredential).toBeTruthy();

    presentationDefinition = {
      id: '4970377a-6283-46d8-b95e-db99b011e48c',
      input_descriptors: [
        {
          id: 'Credential 1',
          name: 'Credential type exists',
          purpose: 'optional field',
          constraints: {
            fields: [
              {
                path: ['$.type[*]'],
                optional: true,
              },
            ],
          },
        },
      ],
    };

    results = pexService.filterCredentials({
      credentials,
      presentationDefinition,
    });

    expect(results.verifiableCredential).toBeTruthy();
  });

  it('should handle DID format filter', () => {
    const presentationDefinition = {
      id: 'df3d2615-7955-4f9d-b2df-ef5c6202bdaf',
      input_descriptors: [
        {
          id: 'Credential 1',
          name: 'Validate Test Credential',
          purpose: 'verify Test credential',
          constraints: {
            fields: [
              {
                path: [
                  '$.issuer.id',
                  '$.issuer',
                  '$.vc.issuer.id',
                  '$.vc.issuer',
                  '$.iss',
                ],
                filter: {
                  const:
                    'did:dock:5HPb8aoNXNQv5XxbupZRorHyc7CdBUYWFFxeczHxqVgeGPjT',
                  format: 'did',
                },
                optional: false,
                predicate: 'required',
              },
            ],
          },
        },
      ],
    };

    const credentials = [
      {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://ld.dock.io/credentials/extensions-v1',
          'https://ld.dock.io/security/bbs23/v1',
          {
            age: 'dk:age',
            dk: 'https://ld.dock.io/credentials#',
            grade: 'dk:grade',
            graduated: 'dk:graduated',
          },
        ],
        credentialStatus: {
          id: 'dock:accumulator:0xfa7403ff3a3f3546a1fe443bf08a094492e08fa8c358c8abdda334598f68b52c',
          type: 'DockVBAccumulator2022',
          revocationCheck: 'membership',
          revocationId: '17',
        },
        id: 'https://creds-testnet.dock.io/74c3a74fbad2fea4f7bb991092165a29de9fc7fb556ee71074755f7804bfaf0e',
        type: ['VerifiableCredential', 'UniversityDegree'],
        credentialSubject: {
          graduated: true,
          grade: 12,
          age: 31,
        },
        issuanceDate: '2024-11-29T11:39:01.959Z',
        issuer: {
          name: 'Test',
          description: '  ',
          logo: 'https://img.dock.io/b1026229cdb6a2fbd59605ba7228db0a',
          id: 'did:dock:5HPb8aoNXNQv5XxbupZRorHyc7CdBUYWFFxeczHxqVgeGPjT',
        },
        credentialSchema: {
          id: 'https://schema.dock.io/Test-V2-1731009346611.json',
          type: 'JsonSchemaValidator2018',
          details:
            '{"jsonSchema":{"$id":"https://schema.dock.io/Test-V2-1731009346611.json","$schema":"http://json-schema.org/draft-07/schema#","additionalProperties":true,"description":"","name":"test University Degree","properties":{"@context":{"type":"string"},"credentialSchema":{"properties":{"details":{"type":"string"},"id":{"type":"string"},"type":{"type":"string"},"version":{"type":"string"}},"type":"object"},"credentialStatus":{"properties":{"id":{"type":"string"},"revocationCheck":{"type":"string"},"revocationId":{"type":"string"},"type":{"type":"string"}},"type":"object"},"credentialSubject":{"properties":{"age":{"description":"","title":"Age","type":"number"},"grade":{"title":"Grade","type":"number"},"graduated":{"default":false,"title":"Graduated","type":"boolean"}},"required":["graduated","age"],"type":"object"},"cryptoVersion":{"type":"string"},"id":{"type":"string"},"issuanceDate":{"format":"date-time","type":"string"},"issuer":{"properties":{"description":{"type":"string"},"id":{"type":"string"},"logo":{"type":"string"},"name":{"type":"string"}},"type":"object"},"name":{"type":"string"},"proof":{"properties":{"@context":{"items":[{"properties":{"proof":{"properties":{"@container":{"type":"string"},"@id":{"type":"string"},"@type":{"type":"string"}},"type":"object"},"sec":{"type":"string"}},"type":"object"},{"type":"string"}],"type":"array"},"created":{"format":"date-time","type":"string"},"proofPurpose":{"type":"string"},"type":{"type":"string"},"verificationMethod":{"type":"string"}},"type":"object"},"type":{"type":"string"}},"type":"object"},"parsingOptions":{"defaultDecimalPlaces":4,"defaultMinimumDate":-17592186044415,"defaultMinimumInteger":-4294967295,"useDefaults":true}}',
          version: '0.4.0',
        },
        name: 'Test University Degree',
        cryptoVersion: '0.6.0',
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
            'https://ld.dock.io/security/bbs23/v1',
          ],
          type: 'Bls12381BBSSignatureDock2023',
          created: '2024-11-29T11:39:15Z',
          verificationMethod:
            'did:dock:5HPb8aoNXNQv5XxbupZRorHyc7CdBUYWFFxeczHxqVgeGPjT#keys-2',
          proofPurpose: 'assertionMethod',
          proofValue:
            'z2e9knFyNq7RPasmUbAASyQ5uALQHHdQsVTXQuLvQTRao6RNbkcyjTcAVBVpMTAZvdm2rW8qZFTCr8ATA1HMuAbZGJD2EM9gtyPFzXHfRUssKuo',
        },
        $$accum__witness$$:
          '{"blockNo":9950875,"witness":"0x975eb3fa6bb302f0679103f187aa6cdb6732739eda6b0254b9a37573a684a5a1c27230f9b1a7a9b472db547b5a180ac7"}',
      },
    ];

    const results = pexService.filterCredentials({
      credentials,
      presentationDefinition,
    });

    expect(results.verifiableCredential).toBeTruthy();
    expect(results.verifiableCredential.length).toBe(1);
  });

  describe('removeOptionalAttribute', () => {
    const getFieldsWithOptionalAttributes = template => {
      return template.input_descriptors[0].constraints.fields.filter(
        field => field.optional !== undefined,
      ).length;
    };

    it('should remove optional attributes', () => {
      let template = {
        id: 'income_test',
        input_descriptors: [
          {
            id: 'Credential 1',
            name: 'optional field',
            purpose: 'optional field',
            constraints: {
              fields: [
                {
                  path: ['$.type[*]'],
                  filter: {
                    const: '',
                  },
                  optional: true,
                },
                {
                  path: ['$.expirationDate'],
                  optional: false,
                },
              ],
            },
          },
        ],
      };

      expect(getFieldsWithOptionalAttributes(template)).toBe(2);

      let result = removeOptionalAttribute(template);
      expect(getFieldsWithOptionalAttributes(result)).toBe(0);
      expect(result.input_descriptors[0].constraints.fields.length).toBe(1);
      expect(result).not.toBe(template); // Ensure immutability
      expect(template.input_descriptors[0].constraints.fields.length).toBe(2); // Original remains unchanged
    });

    it('should handle fields with unsupported formats', () => {
      let template = {
        id: 'income_test',
        input_descriptors: [
          {
            id: 'Credential 1',
            name: 'optional field',
            purpose: 'optional field',
            constraints: {
              fields: [
                {
                  path: ['$.credentialSubject.id'],
                  filter: {
                    format: 'did',
                  },
                },
                {
                  path: ['$.type[*]'],
                  filter: {
                    const: '',
                  },
                  optional: true,
                },
              ],
            },
          },
        ],
      };

      expect(getFieldsWithOptionalAttributes(template)).toBe(1);

      let result = removeOptionalAttribute(template);
      expect(getFieldsWithOptionalAttributes(result)).toBe(0);
      expect(result.input_descriptors[0].constraints.fields.length).toBe(1);
      expect(
        result.input_descriptors[0].constraints.fields[0].filter?.format,
      ).toBeUndefined();
      expect(result).not.toBe(template); // Ensure immutability
    });

    it('should handle templates with no optional attributes', () => {
      let template = {
        id: 'income_test',
        input_descriptors: [
          {
            id: 'Credential 1',
            name: 'optional field',
            purpose: 'optional field',
            constraints: {
              fields: [
                {
                  path: ['$.credentialSubject.id'],
                },
              ],
            },
          },
        ],
      };

      expect(getFieldsWithOptionalAttributes(template)).toBe(0);

      let result = removeOptionalAttribute(template);
      expect(getFieldsWithOptionalAttributes(result)).toBe(0);
      expect(result.input_descriptors[0].constraints.fields.length).toBe(1);
      // Ensure immutability
      expect(result).not.toBe(template);
    });

    it('should handle templates where all fields are optional', () => {
      let template = {
        id: 'income_test',
        input_descriptors: [
          {
            id: 'Credential 1',
            name: 'optional field',
            purpose: 'optional field',
            constraints: {
              fields: [
                {
                  path: ['$.credentialSubject.id'],
                  optional: true,
                },
              ],
            },
          },
        ],
      };

      expect(getFieldsWithOptionalAttributes(template)).toBe(1);

      let result = removeOptionalAttribute(template);
      expect(getFieldsWithOptionalAttributes(result)).toBe(0);
      expect(result.input_descriptors[0].constraints.fields.length).toBe(1);
      expect(result.input_descriptors[0].constraints.fields[0].path).toEqual([
        '$.id',
      ]);
      expect(result).not.toBe(template); // Ensure immutability
    });

    it('should add a placeholder field if all fields are removed', () => {
      let template = {
        id: 'income_test',
        input_descriptors: [
          {
            id: 'Credential 1',
            constraints: {
              fields: [
                {
                  path: ['$.type[*]'],
                  optional: true,
                },
              ],
            },
          },
        ],
      };

      let result = removeOptionalAttribute(template);
      expect(result.input_descriptors[0].constraints.fields.length).toBe(1);
      expect(result.input_descriptors[0].constraints.fields[0].path).toEqual([
        '$.id',
      ]);
      expect(result).not.toBe(template); // Ensure immutability
    });
  });

  describe('isCredentialSelectionValid', () => {
    const presentationDefinition = {
      id: 'b4a4bcf5-56a6-4e1c-810f-f2161c295b27',
      input_descriptors: [
        {
          id: 'Credential 1',
          name: 'api test',
          group: ['1'],
          purpose: 'blah blah',
          constraints: {
            fields: [
              {
                path: ['$.credentialSubject.id'],
                optional: true,
              },
              {
                path: ['$.expirationDate'],
                optional: true,
              },
              {
                path: ['$.credentialSchema.id'],
                filter: {
                  const:
                    'https://schema.truvera.io/BasicCredential-V2-1703777584571.json',
                },
              },
            ],
          },
        },
        {
          id: 'Credential 2',
          name: 'api test',
          group: ['2'],
          purpose: 'blah blah',
          constraints: {
            fields: [
              {
                path: ['$.credentialSubject.id'],
                optional: true,
              },
              {
                path: ['$.expirationDate'],
                optional: true,
              },
              {
                path: ['$.credentialSchema.id'],
                filter: {
                  const:
                    'https://schema.truvera.io/UniversityDegree-V1-1703767509472.json',
                },
              },
            ],
          },
        },
      ],
      submission_requirements: [
        {
          from: '1',
          name: 'Multi Credential Request',
          rule: 'pick',
          count: 1,
        },
        {
          from: '2',
          name: 'Multi Credential Request',
          rule: 'pick',
          count: 1,
        },
      ],
    };

    const basicCredential1 = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://ld.truvera.io/credentials/extensions-v1',
        {
          BasicCredential: 'dk:BasicCredential',
          dk: 'https://ld.truvera.io/credentials#',
        },
        'https://ld.truvera.io/credentials/prettyvc',
      ],
      id: 'https://creds-staging.truvera.io/29224c9c87c87c5edfcbace893d99d009513a0548e855bcb793ea30e1c5f8ce8',
      type: [
        'VerifiableCredential',
        'BasicCredential',
        'PrettyVerifiableCredential',
      ],
      credentialSubject: {
        id: 'did:key:z6Mktpass177BSFLMuCpNJzCyrLeAUs16XUmg15VLHCQsnhk',
        name: 'Another Cred',
      },
      issuanceDate: '2025-11-25T13:44:36.365Z',
      issuer: 'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7',
      credentialSchema: {
        id: 'https://schema.truvera.io/BasicCredential-V2-1703777584571.json',
        type: 'JsonSchemaValidator2018',
      },
      name: 'Another Cred',
      proof: {
        type: 'Ed25519Signature2018',
        created: '2025-11-25T13:45:06Z',
        verificationMethod:
          'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1',
        proofPurpose: 'assertionMethod',
        jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..x1EjlAHJwJFwKfXtbAegJ8xOycY5m47yvvOQm-0sLzzuvSjbSKerIkphQ8w5J0_MJONb-j1-UE0NWZ9quM4CAQ',
      },
    };

    const basicCredential2 = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://ld.truvera.io/credentials/extensions-v1',
        {
          BasicCredential: 'dk:BasicCredential',
          dk: 'https://ld.truvera.io/credentials#',
        },
        'https://ld.truvera.io/credentials/prettyvc',
      ],
      id: 'https://creds-staging.truvera.io/86bdd6cc4d4915939bc2c11a0f8c7ebd64ef0872da02627ab9d7e6866fe2effb',
      type: [
        'VerifiableCredential',
        'BasicCredential',
        'PrettyVerifiableCredential',
      ],
      credentialSubject: {
        name: 'test',
      },
      issuanceDate: '2025-11-25T13:42:02.877Z',
      issuer: 'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7',
      credentialSchema: {
        id: 'https://schema.truvera.io/BasicCredential-V2-1703777584571.json',
        type: 'JsonSchemaValidator2018',
      },
      name: 'test',
      proof: {
        type: 'Ed25519Signature2018',
        created: '2025-11-25T13:42:42Z',
        verificationMethod:
          'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1',
        proofPurpose: 'assertionMethod',
        jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..R-cJhQlBr3TJS6ArSIBwLjLcQO-yuPZ5FUY5zGe6TYIJNm0teHFvgFHjg_-Y9VeuhLZprVNufXyqLoPSkTC7CQ',
      },
    };

    const universityDegreeCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://ld.truvera.io/credentials/extensions-v1',
        {
          UniversityDegree: 'dk:UniversityDegree',
          additionalDistinctions: 'dk:additionalDistinctions',
          awardedDate: 'dk:awardedDate',
          dateOfBirth: 'dk:dateOfBirth',
          degreeName: 'dk:degreeName',
          degreeType: 'dk:degreeType',
          dk: 'https://ld.truvera.io/credentials#',
        },
        'https://ld.truvera.io/credentials/prettyvc',
      ],
      id: 'https://creds-staging.truvera.io/4343d71719d56e2a3461f24a522229f2c89a3bef68ad2664e1f48d70002034c4',
      type: [
        'VerifiableCredential',
        'UniversityDegree',
        'PrettyVerifiableCredential',
      ],
      credentialSubject: {
        id: 'did:key:z6Mktpass177BSFLMuCpNJzCyrLeAUs16XUmg15VLHCQsnhk',
        degreeName: 'testing',
        degreeType: 'testing',
        name: 'Tester',
        awardedDate: '2025-11-20',
        dateOfBirth: '2025-11-20',
        additionalDistinctions: 'test',
      },
      issuanceDate: '2025-11-25T13:45:25.699Z',
      issuer: 'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7',
      credentialSchema: {
        id: 'https://schema.truvera.io/UniversityDegree-V1-1703767509472.json',
        type: 'JsonSchemaValidator2018',
      },
      name: 'University Degree',
      proof: {
        type: 'Ed25519Signature2018',
        created: '2025-11-25T13:46:09Z',
        verificationMethod:
          'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1',
        proofPurpose: 'assertionMethod',
        jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..lb0SOlbNGZAEnGOqnaFg-fTSSOp-EWCMdMtKkjVasRkPjwAVSSK4VZmjis3Czdacbhl8VL0q3f6Ow4rge3eHDQ',
      },
    };

    it('should return true if the credential selection is valid', () => {
      expect(
        pexService.isCredentialSelectionValid({
          credentials: [basicCredential1, universityDegreeCredential],
          presentationDefinition: presentationDefinition,
        }),
      ).toBe(true);
    });

    it('should return false if the credential selection is invalid', () => {
      expect(
        pexService.isCredentialSelectionValid({
          credentials: [basicCredential1, basicCredential2],
          presentationDefinition: presentationDefinition,
        }),
      ).toBe(false);
    });
  });
});
