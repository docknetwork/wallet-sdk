import {getPexRequiredAttributes, pexToBounds, MAX_NUMBER} from './pex-helpers';

describe('pex helpers', () => {
  describe('getPexRequiredAttributes', () => {
    it('should reveal expiredDate and subject.id', () => {
      const result = getPexRequiredAttributes(
        {
          id: '1cf6a349-f1d3-42f7-b751-8de7fb5fde6c',
          input_descriptors: [
            {
              id: 'Credential 1',
              name: 'Basic Credential (Biometrics)',
              purpose: 'Basic Credential with proof of biometrics',
              constraints: {
                fields: [
                  {
                    path: ['$.credentialSubject.id'],
                  },
                  {
                    path: ['$.expirationDate'],
                  },
                ],
              },
            },
          ],
        },
        [
          {
            expirationDate: '2021-01-01',
            credentialSubject: {
              id: '123',
            },
          },
        ],
      )[0];

      expect(result).toEqual(['credentialSubject.id', 'expirationDate']);
    });

    it('should not reveal range proof fields', () => {
      const result = getPexRequiredAttributes(
        {
          id: '1cf6a349-f1d3-42f7-b751-8de7fb5fde6c',
          input_descriptors: [
            {
              id: 'Credential 1',
              name: 'Basic Credential (Biometrics)',
              purpose: 'Basic Credential with proof of biometrics',
              constraints: {
                fields: [
                  {
                    path: ['$.credentialSubject.id'],
                  },
                  {
                    path: ['$.expirationDate'],
                    filter: {
                      type: 'range',
                      max: 100,
                      min: 0,
                    },
                  },
                ],
              },
            },
          ],
        },
        [
          {
            expirationDate: '2021-01-01',
            credentialSubject: {
              id: '123',
            },
          },
        ],
      )[0];

      expect(result).toEqual(['credentialSubject.id']);
    });

    it('should work for multi credential request', () => {
      const result = getPexRequiredAttributes(
        {
          id: '0ed327d6-bea4-4524-a620-7ad2550c5625',
          input_descriptors: [
            {
              id: 'Credential 2',
              name: 'Quotient Loan Verification - Bank Identity, Biometrics, and Credit Score',
              group: ['A'],
              purpose:
                'Quotient wants to verify the ownership of - Bank Identity, Biometrics and Credit Score Credentials.',
              constraints: {
                fields: [
                  {
                    path: ['$.credentialSubject.id'],
                  },
                  {
                    path: ['$.type[*]'],
                  },
                  {
                    path: ['$.type[*]'],
                    filter: {
                      const: 'ForSurBiometric',
                    },
                    predicate: 'required',
                  },
                  {
                    path: ['$.credentialSubject.biometric.id'],
                  },
                  {
                    path: ['$.credentialSubject.biometric.created'],
                  },
                  {
                    path: ['$.credentialSubject.biometric.data'],
                  },
                ],
              },
            },
            {
              id: 'Credential 1',
              name: 'Quotient Loan Verification - Bank Identity, Biometrics, and Credit Score',
              group: ['A'],
              purpose:
                'Quotient wants to verify the ownership of - Bank Identity, Biometrics and Credit Score Credentials.',
              constraints: {
                fields: [
                  {
                    path: ['$.credentialSubject.id'],
                  },
                  {
                    path: ['$.type[*]'],
                  },
                  {
                    path: ['$.type[*]'],
                    filter: {
                      const: 'QuotientBankIdentity',
                    },
                    predicate: 'required',
                  },
                ],
              },
            },
            {
              id: 'Credential 3',
              name: 'Quotient Loan Verification - Bank Identity, Biometrics, and Credit Score',
              group: ['A'],
              purpose:
                'Quotient wants to verify the ownership of - Bank Identity, Biometrics and Credit Score Credentials.',
              constraints: {
                fields: [
                  {
                    path: ['$.credentialSubject.id'],
                  },
                  {
                    path: ['$.type[*]'],
                  },
                  {
                    path: ['$.type[*]'],
                    filter: {
                      const: 'EquiNetCreditScore',
                    },
                    predicate: 'required',
                  },
                ],
              },
            },
          ],
          submission_requirements: [
            {
              from: 'A',
              name: 'Multi Credential Request',
              rule: 'pick',
              count: 1,
            },
          ],
        },
        [
          {
            expirationDate: '2021-01-01',
            credentialSubject: {
              id: 'someId',
              biometric: {
                created: '2021-01-01',
                data: '123',
                id: '123',
              },
            },
          },
        ],
      );

      expect(result[0]).toStrictEqual([
        'credentialSubject.id',
        'credentialSubject.biometric.id',
        'credentialSubject.biometric.created',
        'credentialSubject.biometric.data',
      ]);
      expect(result.length).toBe(1);
    });

    it('should not include fields marked as optional', () => {
      const result = getPexRequiredAttributes(
        {
          id: 'test-optional',
          input_descriptors: [
            {
              id: 'Credential Optional',
              constraints: {
                fields: [
                  {
                    path: ['$.credentialSubject.id'],
                  },
                  {
                    path: ['$.credentialSubject.optionalField'],
                    optional: true,
                  },
                ],
              },
            },
          ],
        },
        [
          {
            credentialSubject: {
              id: 'abc',
              optionalField: 'shouldNotAppear',
            },
          },
        ],
      )[0];

      expect(result).toEqual(['credentialSubject.id']);
    });

    it('should skip issuanceDate', () => {
      const result = getPexRequiredAttributes(
        {
          id: 'test-issuanceDate',
          input_descriptors: [
            {
              constraints: {
                fields: [
                  {
                    path: ['$.issuanceDate'],
                  },
                ],
              },
            },
          ],
        },
        [
          {
            issuanceDate: '2021-01-01',
          },
        ],
      );
      expect(result).toEqual([]);
    });
  });

  describe('pexToBounds', () => {
    it('should convert pexRequest to bounds with default values', () => {
      const pexRequest = {
        input_descriptors: [
          {
            constraints: {
              fields: [
                {
                  filter: {
                    type: 'number',
                    minimum: 0,
                  },
                  path: ['$.credentialSubject.age'],
                },
                {
                  filter: {
                    format: 'date',
                    minimum: '2021-01-01',
                  },
                  path: ['$.credentialSubject.dateOfBirth'],
                },
              ],
            },
          },
        ],
      };

      const bounds = pexToBounds(pexRequest, [
        {
          credentialSubject: {
            age: 10000000000,
          },
        },
        {
          credentialSubject: {
            dateOfBirth: '2021-01-01',
          },
        },
      ]);

      expect(bounds).toEqual([
        [
          {
            attributeName: 'credentialSubject.age',
            min: 0,
            max: MAX_NUMBER,
            proofRequestMax: undefined,
            proofRequestMin: 0,
            format: undefined,
            type: 'number',
          },
          {
            attributeName: 'credentialSubject.dateOfBirth',
            min: new Date('2021-01-01'),
            max: new Date(884541351600000),
            proofRequestMax: undefined,
            proofRequestMin: '2021-01-01',
            format: 'date',
            type: undefined,
          },
        ],
      ]);
    });

    it('should convert pexRequest to bounds with raw boundaries enabled', () => {
      const pexRequest = {
        input_descriptors: [
          {
            constraints: {
              fields: [
                {
                  filter: {
                    type: 'number',
                    minimum: 0,
                  },
                  path: ['$.credentialSubject.age'],
                },
              ],
            },
          },
        ],
      };

      const bounds = pexToBounds(
        pexRequest,
        [
          {
            credentialSubject: {
              age: 2,
            },
          },
        ],
        true,
      );

      expect(bounds).toEqual([
        [
          {
            attributeName: 'credentialSubject.age',
            min: 0,
            max: MAX_NUMBER,
            proofRequestMax: undefined,
            proofRequestMin: 0,
            format: undefined,
            type: 'number',
          },
        ],
      ]);
    });
    it('should convert pexRequest to bounds for date-time format', () => {
      const pexRequest = {
        input_descriptors: [
          {
            constraints: {
              fields: [
                {
                  filter: {
                    format: 'date-time',
                    maximum: '2022-01-01T00:00:00Z',
                    minimum: '2021-01-01T00:00:00Z',
                  },
                  path: ['$.expirationDate'],
                },
              ],
            },
          },
        ],
      };

      const bounds = pexToBounds(pexRequest, [
        {
          expirationDate: '2021-01-01',
        },
      ]);

      expect(bounds).toEqual([
        [
          {
            attributeName: 'expirationDate',
            min: new Date('2021-01-01T00:00:00Z'),
            max: new Date('2022-01-01T00:00:00Z'),
            proofRequestMax: '2022-01-01T00:00:00Z',
            proofRequestMin: '2021-01-01T00:00:00Z',
            format: 'date-time',
            type: undefined,
          },
        ],
      ]);
    });

    it('should convert pexRequest to bounds for number format', () => {
      const pexRequest = {
        input_descriptors: [
          {
            constraints: {
              fields: [
                {
                  filter: {
                    type: 'number',
                    maximum: 100,
                    minimum: 0,
                  },
                  path: ['$.amount'],
                },
              ],
            },
          },
        ],
      };

      const bounds = pexToBounds(pexRequest, [
        {
          amount: 10,
        },
      ]);

      expect(bounds).toEqual([
        [
          {
            attributeName: 'amount',
            min: 0,
            max: 100,
            proofRequestMax: 100,
            proofRequestMin: 0,
            format: undefined,
            type: 'number',
          },
        ],
      ]);
    });

    it('should convert pexRequest to bounds for multiple fields', () => {
      const pexRequest = {
        input_descriptors: [
          {
            constraints: {
              fields: [
                {
                  filter: {
                    format: 'date',
                    maximum: '2022-01-01',
                    minimum: '2021-01-01',
                  },
                  path: ['$.startDate'],
                },
                {
                  filter: {
                    type: 'number',
                    maximum: 100,
                    minimum: 0,
                  },
                  path: ['$.amount'],
                },
              ],
            },
          },
        ],
      };

      const bounds = pexToBounds(pexRequest, [
        {
          amount: 10,
          date: '2021-01-01',
        },
      ]);

      expect(bounds).toEqual([
        [
          {
            attributeName: 'startDate',
            min: new Date('2021-01-01'),
            max: new Date('2022-01-01'),
            proofRequestMax: '2022-01-01',
            proofRequestMin: '2021-01-01',
            format: 'date',
            type: undefined,
          },
          {
            attributeName: 'amount',
            min: 0,
            max: 100,
            proofRequestMax: 100,
            proofRequestMin: 0,
            format: undefined,
            type: 'number',
          },
        ],
      ]);
    });

    it('should handle empty pexRequest', () => {
      const pexRequest = {
        input_descriptors: [],
      };

      const bounds = pexToBounds(pexRequest);

      expect(bounds).toEqual([]);
    });

    it('should preserve original proof request values in new metadata fields', () => {
      const pexRequest = {
        input_descriptors: [
          {
            constraints: {
              fields: [
                {
                  filter: {
                    type: 'number',
                    minimum: 18,
                    maximum: 65,
                  },
                  path: ['$.credentialSubject.age'],
                },
                {
                  filter: {
                    format: 'date',
                    formatMinimum: '2020-01-01',
                    formatMaximum: '2025-12-31',
                  },
                  path: ['$.credentialSubject.graduationDate'],
                },
              ],
            },
          },
        ],
      };

      const bounds = pexToBounds(pexRequest, [
        {
          credentialSubject: {
            age: 25,
            graduationDate: '2023-06-15',
          },
        },
      ]);

      expect(bounds).toEqual([
        [
          {
            attributeName: 'credentialSubject.age',
            min: 18,
            max: 65,
            proofRequestMax: 65,
            proofRequestMin: 18,
            format: undefined,
            type: 'number',
          },
          {
            attributeName: 'credentialSubject.graduationDate',
            min: new Date('2020-01-01'),
            max: new Date('2025-12-31'),
            proofRequestMax: '2025-12-31',
            proofRequestMin: '2020-01-01',
            format: 'date',
            type: undefined,
          },
        ],
      ]);
    });

    it('should not have undefined attributeNames, exclude not found bounds', () => {
      const pexRequest = {
        id: '3cb2c1db-54d7-427a-a6a2-4b8f73a33700',
        input_descriptors: [
          {
            id: 'Credential 1',
            name: 'Mortgage Application Qualification',
            group: ['A'],
            purpose:
              'Proof of assets (>100k), employment, and credit score (>800)',
            constraints: {
              fields: [
                {
                  path: ['$.credentialSubject.id'],
                  optional: true,
                },
                {
                  path: ['$.credentialSchema.id'],
                  filter: {
                    const:
                      'https://schema.dock.io/ProofOfEmployment-V1-1703767227542.json',
                  },
                },
                {
                  path: ['$.expirationDate', '$.vc.expirationDate'],
                  filter: {
                    type: 'string',
                    format: 'date-time',
                    formatMinimum: '2024-12-10T00:00:00.000Z',
                  },
                  optional: true,
                  predicate: 'required',
                },
              ],
            },
          },
          {
            id: 'Credential 2',
            name: 'Mortgage Application Qualification',
            group: ['A'],
            purpose:
              'Proof of assets (>100k), employment, and credit score (>800)',
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
                      'https://schema.dock.io/CreditScore-V1-1732907844039.json',
                  },
                },
                {
                  path: ['$.credentialSubject.creditScore'],
                  filter: {
                    type: 'number',
                    minimum: 800,
                  },
                  predicate: 'required',
                },
              ],
            },
          },
          {
            id: 'Credential 3',
            name: 'Mortgage Application Qualification',
            group: ['A'],
            purpose:
              'Proof of assets (>100k), employment, and credit score (>800)',
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
                      'https://schema.dock.io/ProofOfAssets-V1-1733843536548.json',
                  },
                },
                {
                  path: ['$.credentialSubject.sIN'],
                  optional: true,
                },
                {
                  path: ['$.credentialSubject.name'],
                  optional: true,
                },
                {
                  path: ['$.credentialSubject.propertiesOwned'],
                  filter: {
                    type: 'number',
                    minimum: 1,
                  },
                  predicate: 'required',
                },
                {
                  path: ['$.credentialSubject.totalPropertyAssetValue'],
                  filter: {
                    type: 'number',
                    minimum: 100000,
                  },
                  predicate: 'required',
                },
              ],
            },
          },
        ],
        submission_requirements: [
          {
            from: 'A',
            name: 'Multi Credential Request',
            rule: 'pick',
            count: 1,
          },
        ],
      };

      const bounds = pexToBounds(pexRequest, [
        {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://ld.dock.io/credentials/extensions-v1',
            'https://ld.dock.io/security/bbs23/v1',
            {
              CreditScore: 'dk:CreditScore',
              bankruptcies: 'dk:bankruptcies',
              creditScore: 'dk:creditScore',
              dk: 'https://ld.dock.io/credentials#',
            },
          ],
          credentialStatus: {
            id: 'dock:accumulator:0xb803980eb9433bb5d5d433f60c08fcd17e82eb2eb8ae3ac88fef79a3fb2f5fd9',
            type: 'DockVBAccumulator2022',
            revocationCheck: 'membership',
            revocationId: '7',
          },
          id: 'https://creds-testnet.dock.io/15ca3b92504514756671ab5377ef23f7407f1c26c692b60363c97ba4775abab3',
          type: ['VerifiableCredential', 'CreditScore'],
          credentialSubject: {
            name: 'tester',
            creditScore: 800,
            bankruptcies: 0,
          },
          issuanceDate: '2024-12-13T12:43:20.925Z',
          issuer: {
            name: 'CIBC',
            description: 'CIBC - a bank',
            logo: 'https://img.dock.io/e5715cbf78f2222924f5fe4e109d76a5',
            id: 'did:dock:5CwdfTvda68vfdLu4yxNRFHuhdiXDzqLxw5TkoMfX6sC784a',
          },
          credentialSchema: {
            id: 'https://schema.dock.io/CreditScore-V1-1732907844039.json',
            type: 'JsonSchemaValidator2018',
            details:
              '{"jsonSchema":{"$id":"https://schema.dock.io/CreditScore-V1-1732907844039.json","$schema":"http://json-schema.org/draft-07/schema#","additionalProperties":true,"description":"Proof of Credit","name":"Credit Score","properties":{"@context":{"type":"string"},"credentialSchema":{"properties":{"details":{"type":"string"},"id":{"type":"string"},"type":{"type":"string"},"version":{"type":"string"}},"type":"object"},"credentialStatus":{"properties":{"id":{"type":"string"},"revocationCheck":{"type":"string"},"revocationId":{"type":"string"},"type":{"type":"string"}},"type":"object"},"credentialSubject":{"properties":{"bankruptcies":{"description":"How many times have you declared bankruptcy","title":"Bankruptcies","type":"integer"},"creditScore":{"description":"","title":"Credit Score","type":"number"},"name":{"description":"Name of individual","title":"Name","type":"string"}},"required":["creditScore","bankruptcies","name"],"type":"object"},"cryptoVersion":{"type":"string"},"id":{"type":"string"},"issuanceDate":{"format":"date-time","type":"string"},"issuer":{"properties":{"description":{"type":"string"},"id":{"type":"string"},"logo":{"type":"string"},"name":{"type":"string"}},"type":"object"},"name":{"type":"string"},"proof":{"properties":{"@context":{"items":[{"properties":{"proof":{"properties":{"@container":{"type":"string"},"@id":{"type":"string"},"@type":{"type":"string"}},"type":"object"},"sec":{"type":"string"}},"type":"object"},{"type":"string"}],"type":"array"},"created":{"format":"date-time","type":"string"},"proofPurpose":{"type":"string"},"type":{"type":"string"},"verificationMethod":{"type":"string"}},"type":"object"},"type":{"type":"string"}},"type":"object"},"parsingOptions":{"defaultDecimalPlaces":4,"defaultMinimumDate":-17592186044415,"defaultMinimumInteger":-4294967295,"useDefaults":true}}',
            version: '0.4.0',
          },
          name: 'Credit Score',
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
            created: '2024-12-13T12:43:42Z',
            verificationMethod:
              'did:dock:5CwdfTvda68vfdLu4yxNRFHuhdiXDzqLxw5TkoMfX6sC784a#keys-2',
            proofPurpose: 'assertionMethod',
            proofValue:
              'z2PyUbLtaHuMbrdJagELMtFqroKXSoxtMaKLshc3PvT7VXpCHWWeeDMkvGf8MoKjjhNfwGPEXn9zYZuyZv7JGETWXs2TU2aSaKAHkvcmnVXcu8D',
          },
        },
      ]);

      bounds.forEach(() => {
        expect(
          bounds[0].every(bound => bound.attributeName !== undefined),
        ).toBe(true);
      });
    });
  });
});
