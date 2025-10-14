import {
  isSDJWTCredential,
  sdJwtToW3C,
  decodeSDJWTToW3C,
  credentialToW3C,
  verifySDJWT,
  decodeSDJWT,
  createSDJWTPresentation,
} from './sd-jwt';

// Test SD-JWT credential provided by the user
const TEST_SD_JWT = 'eyJ0eXAiOiJ2YytzZC1qd3QiLCJraWQiOiJkaWQ6Y2hlcWQ6dGVzdG5ldDpjMDg5MGYxYy1jN2JiLTRlYTYtYmU3YS04YzMxNDA0NzQzYjcja2V5cy0xIiwiYWxnIjoiRWREU0EifQ.eyJpYXQiOjE3NTk0MTQzOTQsImlzcyI6ImRpZDpjaGVxZDp0ZXN0bmV0OmMwODkwZjFjLWM3YmItNGVhNi1iZTdhLThjMzE0MDQ3NDNiNyNrZXlzLTEiLCJ2Y3QiOiJJbnRlcm5hbFRlc3RpbmciLCJfc2QiOlsiM3JVUGt1Mk5XckFFeTV3ZE9uVms5TkJBa0haMWE4RDB6Y2liMFNQdmthWSIsIkhjNHAxMnZTTWNMQ0piNVRYVlFrdFFMR2xjM0J3SDNWN2ltakV5ZDdvdzAiLCJNZWNNZEd6NjAxY3kwTTdvanRtSjR1LUI5LTJxSXAya1RvbFpDUm1GZ1pFIiwiZmo4WHdBb0lERmRsWmpEa0NTVzVpeXBPYUZBcVplTWZDRncwTWd3cHhOQSJdLCJfc2RfYWxnIjoic2hhLTI1NiJ9.FcYvNrldceL5BTNmoIaS4Mub8a5NcbiseUeSmmvUpOW8SUom-bchV5AEefrH1VMECbdc2whhk2sW4_jmZo7_Dw~WyI1YTRkZWY1MTAzYjRiYjc0IiwiaWQiLCJkaWQ6a2V5Ono2TWt1OVI4emRBOExENmhjRlhrbjQ3akxuZmNLWk5HbXdhVHJEbmFDQmtTYjhVbiJd~WyJiZDUyMjQ5ZjAyNjk3NWRkIiwiZGF0ZSIsIjIwMjUtMTAtMDkiXQ~WyJlMjcxNzExNzVkODdlMWE1IiwibmFtZSIsIm1heWNvbiJd~WyIwZDFiOTBlNTlhNmMyNDNiIiwibnVtYmVyIiwxMjNd~';

// Regular JWT (not SD-JWT) for testing
const REGULAR_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// Regular JWT with dc+sd-jwt type
const DC_SD_JWT = 'eyJ0eXAiOiJkYytzZC1qd3QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// Sample W3C credential for testing
const W3C_CREDENTIAL = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential', 'TestCredential'],
  issuer: 'did:example:issuer',
  credentialSubject: {
    id: 'did:example:subject',
    name: 'Test Subject',
  },
};

describe('SD-JWT Service', () => {
  describe('isSDJWTCredential', () => {
    it('should return true for vc+sd-jwt credential', () => {
      const result = isSDJWTCredential(TEST_SD_JWT);
      expect(result).toBe(true);
    });

    it('should return true for dc+sd-jwt credential', () => {
      const result = isSDJWTCredential(DC_SD_JWT);
      expect(result).toBe(true);
    });

    it('should return false for regular JWT', () => {
      const result = isSDJWTCredential(REGULAR_JWT);
      expect(result).toBe(false);
    });

    it('should handle JWT without typ field', () => {
      const jwtWithoutTyp = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = isSDJWTCredential(jwtWithoutTyp);
      expect(result).toBe(false);
    });
  });

  describe('sdJwtToW3C', () => {
    it('should convert decoded SD-JWT to W3C format with all fields', () => {
      const decodedSDJWT = {
        jwt: {
          header: {
            typ: 'vc+sd-jwt',
            alg: 'EdDSA',
          },
          payload: {
            iss: 'did:example:issuer',
            vct: 'TestCredential',
            iat: 1609459200, // 2021-01-01T00:00:00.000Z
            exp: 1640995200, // 2022-01-01T00:00:00.000Z
            jti: 'credential-id-123',
          },
        },
        disclosures: [
          { key: 'id', value: 'did:example:subject' },
          { key: 'name', value: 'John Doe' },
          { key: 'age', value: 30 },
        ],
      };

      const result = sdJwtToW3C(decodedSDJWT);

      expect(result).toEqual({
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'TestCredential'],
        issuer: 'did:example:issuer',
        credentialSubject: {
          id: 'did:example:subject',
          name: 'John Doe',
          age: 30,
        },
        issuanceDate: '2021-01-01T00:00:00.000Z',
        expirationDate: '2022-01-01T00:00:00.000Z',
        id: 'credential-id-123',
        _sd_jwt: {
          encoded: undefined,
          decoded: decodedSDJWT,
        },
      });
    });

    it('should store raw encoded SD-JWT when provided', () => {
      const decodedSDJWT = {
        jwt: {
          header: {
            typ: 'vc+sd-jwt',
            alg: 'EdDSA',
          },
          payload: {
            iss: 'did:example:issuer',
            vct: 'TestCredential',
          },
        },
        disclosures: [
          { key: 'name', value: 'Jane Doe' },
        ],
      };

      const encodedSDJWT = 'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkaWQ6ZXhhbXBsZTppc3N1ZXIifQ.signature~disclosure1~disclosure2~';
      const result = sdJwtToW3C(decodedSDJWT, encodedSDJWT);

      expect(result._sd_jwt).toBeDefined();
      expect(result._sd_jwt.encoded).toBe(encodedSDJWT);
      expect(result._sd_jwt.decoded).toEqual(decodedSDJWT);
    });

    it('should handle minimal SD-JWT without optional fields', () => {
      const decodedSDJWT = {
        jwt: {
          header: {
            typ: 'vc+sd-jwt',
            alg: 'EdDSA',
          },
          payload: {
            iss: 'did:example:issuer',
            vct: 'TestCredential',
          },
        },
        disclosures: [
          { key: 'name', value: 'Jane Doe' },
        ],
      };

      const result = sdJwtToW3C(decodedSDJWT);

      expect(result).toEqual({
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'TestCredential'],
        issuer: 'did:example:issuer',
        credentialSubject: {
          name: 'Jane Doe',
        },
        _sd_jwt: {
          encoded: undefined,
          decoded: decodedSDJWT,
        },
      });
    });

    it('should handle empty disclosures array', () => {
      const decodedSDJWT = {
        jwt: {
          header: {
            typ: 'vc+sd-jwt',
            alg: 'EdDSA',
          },
          payload: {
            iss: 'did:example:issuer',
            vct: 'TestCredential',
          },
        },
        disclosures: [],
      };

      const result = sdJwtToW3C(decodedSDJWT);

      expect(result.credentialSubject).toEqual({});
    });

    it('should use issuer field from payload if iss is not present', () => {
      const decodedSDJWT = {
        jwt: {
          header: {
            typ: 'vc+sd-jwt',
            alg: 'EdDSA',
          },
          payload: {
            issuer: 'did:example:issuer-from-issuer-field',
            vct: 'TestCredential',
          },
        },
        disclosures: [],
      };

      const result = sdJwtToW3C(decodedSDJWT);

      expect(result.issuer).toBe('did:example:issuer-from-issuer-field');
    });

    it('should handle disclosures without key (malformed)', () => {
      const decodedSDJWT = {
        jwt: {
          header: {
            typ: 'vc+sd-jwt',
            alg: 'EdDSA',
          },
          payload: {
            iss: 'did:example:issuer',
            vct: 'TestCredential',
          },
        },
        disclosures: [
          { key: 'name', value: 'Valid' },
          { value: 'Invalid' }, // Missing key
          null, // Null disclosure
        ],
      };

      const result = sdJwtToW3C(decodedSDJWT);

      expect(result.credentialSubject).toEqual({
        name: 'Valid',
      });
    });

    it('should use UnknownCredential when vct is missing', () => {
      const decodedSDJWT = {
        jwt: {
          header: {
            typ: 'vc+sd-jwt',
            alg: 'EdDSA',
          },
          payload: {
            iss: 'did:example:issuer',
          },
        },
        disclosures: [],
      };

      const result = sdJwtToW3C(decodedSDJWT);

      expect(result.type).toEqual(['VerifiableCredential', 'UnknownCredential']);
    });
  });

  describe('decodeSDJWTToW3C', () => {
    it('should decode the provided test SD-JWT and convert to W3C format', async () => {
      const result = await decodeSDJWTToW3C(TEST_SD_JWT) as any;

      // Verify the structure
      expect(result).toHaveProperty('@context');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('issuer');
      expect(result).toHaveProperty('credentialSubject');
      expect(result).toHaveProperty('issuanceDate');

      // Verify specific values from the test SD-JWT
      expect(result.type).toEqual(['VerifiableCredential', 'InternalTesting']);
      expect(result.issuer).toBe('did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1');

      // Verify credential subject has disclosed claims
      expect(result.credentialSubject).toHaveProperty('id');
      expect(result.credentialSubject).toHaveProperty('name');
      expect(result.credentialSubject).toHaveProperty('date');
      expect(result.credentialSubject).toHaveProperty('number');

      // Verify disclosed values
      expect(result.credentialSubject.id).toBe('did:key:z6Mku9R8zdA8LD6hcFXkn47jLnfcKZNGmwaTrDnaCBkSb8Un');
      expect(result.credentialSubject.name).toBe('maycon');
      expect(result.credentialSubject.date).toBe('2025-10-09');
      expect(result.credentialSubject.number).toBe(123);

      // Verify issuance date
      expect(result.issuanceDate).toBe(new Date(1759414394 * 1000).toISOString());
    });

    it('should store raw encoded SD-JWT and decoded structure in metadata', async () => {
      const result = await decodeSDJWTToW3C(TEST_SD_JWT) as any;

      // Verify _sd_jwt metadata is present
      expect(result).toHaveProperty('_sd_jwt');
      expect(result._sd_jwt).toHaveProperty('encoded');
      expect(result._sd_jwt).toHaveProperty('decoded');

      // Verify raw SD-JWT string is stored
      expect(result._sd_jwt.encoded).toBe(TEST_SD_JWT);

      // Verify decoded structure contains expected fields
      expect(result._sd_jwt.decoded).toHaveProperty('jwt');
      expect(result._sd_jwt.decoded).toHaveProperty('disclosures');
      expect(result._sd_jwt.decoded.jwt).toHaveProperty('header');
      expect(result._sd_jwt.decoded.jwt).toHaveProperty('payload');

      // Verify we can access disclosure information
      expect(Array.isArray(result._sd_jwt.decoded.disclosures)).toBe(true);
      expect(result._sd_jwt.decoded.disclosures.length).toBeGreaterThan(0);
    });

    it('should handle SD-JWT with minimal disclosures', async () => {
      // This test would need a valid minimal SD-JWT
      // For now, we'll just test that the function is async and can be called
      await expect(decodeSDJWTToW3C(TEST_SD_JWT)).resolves.toBeDefined();
    });
  });

  describe('credentialToW3C', () => {
    it('should return W3C credential as-is when passed an object with type', async () => {
      const result = await credentialToW3C(W3C_CREDENTIAL);
      expect(result).toEqual(W3C_CREDENTIAL);
    });

    it('should decode SD-JWT string to W3C format', async () => {
      const result = await credentialToW3C(TEST_SD_JWT);

      expect(result).toHaveProperty('@context');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('issuer');
      expect(result).toHaveProperty('credentialSubject');
      expect(result.type).toEqual(['VerifiableCredential', 'InternalTesting']);
    });

    it('should parse JSON string containing W3C credential', async () => {
      const jsonString = JSON.stringify(W3C_CREDENTIAL);
      const result = await credentialToW3C(jsonString);
      expect(result).toEqual(W3C_CREDENTIAL);
    });

    it('should handle credential object with data field', async () => {
      const credentialWrapper = {
        data: W3C_CREDENTIAL,
      };
      const result = await credentialToW3C(credentialWrapper);
      expect(result).toEqual(W3C_CREDENTIAL);
    });

    it('should handle nested credential object with SD-JWT in data field', async () => {
      const credentialWrapper = {
        data: TEST_SD_JWT,
      };
      const result = await credentialToW3C(credentialWrapper);

      expect(result).toHaveProperty('@context');
      expect(result).toHaveProperty('type');
      expect(result.type).toEqual(['VerifiableCredential', 'InternalTesting']);
    });

    it('should throw error for unsupported credential format', async () => {
      const invalidCredential = 'not-a-valid-jwt-or-credential';

      await expect(credentialToW3C(invalidCredential)).rejects.toThrow(
        'Unable to convert credential to W3C format'
      );
    });

    it('should throw error for empty string', async () => {
      await expect(credentialToW3C('')).rejects.toThrow();
    });

    it('should handle object without type or data field', async () => {
      const invalidObject = {
        someField: 'someValue',
      };

      await expect(credentialToW3C(invalidObject)).rejects.toThrow(
        'Unable to convert credential to W3C format'
      );
    });

    it('should parse JSON string containing credential with data field', async () => {
      const jsonString = JSON.stringify({
        data: W3C_CREDENTIAL,
      });
      const parsedObject = JSON.parse(jsonString);
      const result = await credentialToW3C(parsedObject);
      expect(result).toEqual(W3C_CREDENTIAL);
    });

    it('should handle regular JWT (not SD-JWT)', async () => {
      await expect(credentialToW3C(REGULAR_JWT)).rejects.toThrow(
        'Unable to convert credential to W3C format'
      );
    });
  });

  describe('Integration tests', () => {
    it('should properly decode and convert complete SD-JWT flow', async () => {
      // Test the complete flow: check if SD-JWT -> decode -> convert to W3C
      const isSDJWT = isSDJWTCredential(TEST_SD_JWT);
      expect(isSDJWT).toBe(true);

      const w3cCredential = await decodeSDJWTToW3C(TEST_SD_JWT) as any;

      // Verify complete structure
      expect(w3cCredential).toMatchObject({
        '@context': expect.arrayContaining(['https://www.w3.org/2018/credentials/v1']),
        type: expect.arrayContaining(['VerifiableCredential', 'InternalTesting']),
        issuer: 'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1',
        credentialSubject: {
          id: 'did:key:z6Mku9R8zdA8LD6hcFXkn47jLnfcKZNGmwaTrDnaCBkSb8Un',
          name: 'maycon',
          date: '2025-10-09',
          number: 123,
        },
      });

      // Verify SD-JWT metadata is stored for unwrapping
      expect(w3cCredential._sd_jwt).toBeDefined();
      expect(w3cCredential._sd_jwt.encoded).toBe(TEST_SD_JWT);
      expect(w3cCredential._sd_jwt.decoded).toBeDefined();
    });

    it('should handle credentialToW3C with the test SD-JWT', async () => {
      const result = await credentialToW3C(TEST_SD_JWT) as any;

      expect(result.credentialSubject.name).toBe('maycon');
      expect(result.credentialSubject.number).toBe(123);
      expect(result.issuer).toBe('did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1');

      // Verify SD-JWT metadata for presentation unwrapping
      expect(result._sd_jwt).toBeDefined();
      expect(result._sd_jwt.encoded).toBe(TEST_SD_JWT);
      expect(result._sd_jwt.decoded).toBeDefined();
    });
  });

  describe('decodeSDJWT', () => {
    it('should decode SD-JWT into structured format', async () => {
      const decoded = await decodeSDJWT(TEST_SD_JWT);

      expect(decoded).toHaveProperty('jwt');
      expect(decoded).toHaveProperty('disclosures');
      expect(decoded.jwt).toHaveProperty('header');
      expect(decoded.jwt).toHaveProperty('payload');
      expect(Array.isArray(decoded.disclosures)).toBe(true);
    });

    it('should decode header and payload correctly', async () => {
      const decoded = await decodeSDJWT(TEST_SD_JWT);

      expect(decoded.jwt.header.typ).toBe('vc+sd-jwt');
      expect(decoded.jwt.header.alg).toBe('EdDSA');
      expect(decoded.jwt.payload.iss).toBe('did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1');
      expect(decoded.jwt.payload.vct).toBe('InternalTesting');
    });

    it('should throw error for invalid SD-JWT', async () => {
      await expect(decodeSDJWT('invalid-jwt-string')).rejects.toThrow();
    });
  });

  describe('verifySDJWT', () => {
    it('should verify valid SD-JWT successfully', async () => {
      const result = await verifySDJWT(TEST_SD_JWT);

      expect(result).toHaveProperty('verified');
      expect(result.verified).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail verification for expired SD-JWT', async () => {
      // Create an expired SD-JWT (exp in the past)
      const expiredJWT = 'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkaWQ6ZXhhbXBsZTppc3N1ZXIiLCJ2Y3QiOiJUZXN0Q3JlZGVudGlhbCIsImV4cCI6MTYwOTQ1OTIwMCwiaWF0IjoxNjA5NDU5MjAwfQ.signature~';

      const result = await verifySDJWT(expiredJWT);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should fail verification for not-yet-valid SD-JWT', async () => {
      // Create an SD-JWT with nbf in the future
      const futureJWT = 'eyJ0eXAiOiJ2YytzZC1qd3QiLCJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkaWQ6ZXhhbXBsZTppc3N1ZXIiLCJ2Y3QiOiJUZXN0Q3JlZGVudGlhbCIsIm5iZiI6OTk5OTk5OTk5OSwiaWF0IjoxNjA5NDU5MjAwfQ.signature~';

      const result = await verifySDJWT(futureJWT);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('not yet valid');
    });

    it('should fail verification for invalid SD-JWT format', async () => {
      const result = await verifySDJWT('invalid-jwt-string');

      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should verify SD-JWT without expiration date', async () => {
      // The TEST_SD_JWT doesn't have an expiration date, so it should verify
      const result = await verifySDJWT(TEST_SD_JWT);

      expect(result.verified).toBe(true);
    });

    it('should return error message on verification failure', async () => {
      const result = await verifySDJWT('');

      expect(result.verified).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });
});
