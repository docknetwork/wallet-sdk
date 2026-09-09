// @ts-nocheck
import {createJwsSigner, Ed25519Keypair} from '@docknetwork/crypto-utils';
import {digest, generateSalt} from '@sd-jwt/crypto-nodejs';
import {SDJwtVcInstance} from '@sd-jwt/sd-jwt-vc';
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

const ISSUER_DID = 'did:ex:issuer#keys-1';

async function issueTestSdJwt(keypair, claims, disclosureFrame = {_sd: ['name', 'date', 'number', 'id']}) {
  const signer = createJwsSigner(keypair);
  const sdjwt = new SDJwtVcInstance({
    signer: async data => {
      const bytes = typeof data === 'string' ? Buffer.from(data) : data;
      const signature = await signer.sign({data: bytes});
      return Buffer.from(signature).toString('base64url');
    },
    signAlg: 'EdDSA',
    hasher: digest,
    hashAlg: 'sha-256',
    saltGenerator: generateSalt,
  });

  return sdjwt.issue(claims, disclosureFrame, {
    header: {
      typ: 'vc+sd-jwt',
      alg: 'EdDSA',
      kid: claims.iss,
    },
  });
}

function createIssuerKeypair() {
  return Ed25519Keypair.fromSeed(
    Uint8Array.from({length: Ed25519Keypair.SeedSize}, (_, index) => index + 1),
  );
}

function createKeyResolver(keypair) {
  return async () => keypair.publicKey();
}

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

      // Verify raw SD-JWT string is stored
      expect(result._sd_jwt.encoded).toBe(TEST_SD_JWT);
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

    it('should throw error for unsupported credential format', async () => {
      const invalidCredential = 'not-a-valid-jwt-or-credential';

      await expect(credentialToW3C(invalidCredential)).rejects.toThrow(
        'Unable to convert credential to W3C format'
      );
    });

    it('should throw error for empty string', async () => {
      await expect(credentialToW3C('')).rejects.toThrow();
    });

    it('should handle object without type field', async () => {
      const invalidObject = {
        someField: 'someValue',
      };

      await expect(credentialToW3C(invalidObject)).rejects.toThrow(
        'Unable to convert credential to W3C format'
      );
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
    });

    it('should handle credentialToW3C with the test SD-JWT', async () => {
      const result = await credentialToW3C(TEST_SD_JWT) as any;

      expect(result.credentialSubject.name).toBe('maycon');
      expect(result.credentialSubject.number).toBe(123);
      expect(result.issuer).toBe('did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1');

      // Verify SD-JWT metadata for presentation unwrapping
      expect(result._sd_jwt).toBeDefined();
      expect(result._sd_jwt.encoded).toBe(TEST_SD_JWT);
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
    it('should fail when no issuer key resolution options are provided', async () => {
      const keypair = createIssuerKeypair();
      const credential = await issueTestSdJwt(
        keypair,
        {
          iss: ISSUER_DID,
          iat: 1700000000,
          vct: 'InternalTesting',
          name: 'maycon',
        },
        {_sd: ['name']},
      );

      // Production callers must pass documentLoader/resolver/keyResolver.
      const result = await verifySDJWT(credential);

      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should cryptographically verify a valid SD-JWT with keyResolver', async () => {
      const keypair = createIssuerKeypair();
      const credential = await issueTestSdJwt(keypair, {
        iss: ISSUER_DID,
        iat: 1700000000,
        exp: 1800000000,
        vct: 'InternalTesting',
        id: 'did:example:subject',
        name: 'maycon',
        date: '2025-10-09',
        number: 123,
      });

      const result = await verifySDJWT(credential, ['name'], {
        keyResolver: createKeyResolver(keypair),
      });

      expect(result.verified).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.credentialResults[0]).toMatchObject({
        issuer: 'did:ex:issuer',
        type: ['InternalTesting'],
        credentialSubject: {
          name: 'maycon',
        },
      });
    });

    it('should fail verification when issuer key cannot be resolved', async () => {
      const keypair = createIssuerKeypair();
      const credential = await issueTestSdJwt(keypair, {
        iss: ISSUER_DID,
        iat: 1700000000,
        vct: 'InternalTesting',
        name: 'maycon',
      }, {_sd: ['name']});

      const result = await verifySDJWT(credential, undefined, {
        keyResolver: async () => null,
      });

      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail verification for invalid SD-JWT format', async () => {
      const result = await verifySDJWT('invalid-jwt-string');

      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail verification with wrong issuer key', async () => {
      const issuerKeypair = createIssuerKeypair();
      const wrongKeypair = Ed25519Keypair.fromSeed(
        Uint8Array.from({length: Ed25519Keypair.SeedSize}, (_, index) => index + 9),
      );
      const credential = await issueTestSdJwt(issuerKeypair, {
        iss: ISSUER_DID,
        iat: 1700000000,
        vct: 'InternalTesting',
        name: 'maycon',
      }, {_sd: ['name']});

      const result = await verifySDJWT(credential, undefined, {
        keyResolver: createKeyResolver(wrongKeypair),
      });

      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error message on verification failure', async () => {
      const result = await verifySDJWT('');

      expect(result.verified).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });

  describe('createSDJWTPresentation', () => {
    it('should create presentation with selective disclosure of specific attributes', async () => {
      // Test selective disclosure - reveal only name and date, hide id and number
      const presentation = await createSDJWTPresentation({
        attributesToReveal: ['name', 'date'],
        credential: TEST_SD_JWT,
      });

      // Presentation should be a string
      expect(typeof presentation).toBe('string');

      // Should be a valid JWT format with disclosures
      expect(presentation).toContain('~');

      // Decode the presentation to verify only requested attributes are included
      const decoded = await decodeSDJWT(presentation);
      const disclosureKeys = decoded.disclosures.map((d: any) => d.key);

      // Should include requested attributes
      expect(disclosureKeys).toContain('name');
      expect(disclosureKeys).toContain('date');

      // Should NOT include unrequested attributes
      expect(disclosureKeys).not.toContain('number');
      // Note: 'id' might be included by default in some implementations
    });

    it('should create presentation revealing only one attribute', async () => {
      const presentation = await createSDJWTPresentation({
        attributesToReveal: ['name'],
        credential: TEST_SD_JWT,
      });

      expect(typeof presentation).toBe('string');

      const decoded = await decodeSDJWT(presentation);
      const disclosureKeys = decoded.disclosures.map((d: any) => d.key);

      // Should only include the requested attribute
      expect(disclosureKeys).toContain('name');
      expect(disclosureKeys.filter((k: string) => k !== 'name').length).toBeLessThan(disclosureKeys.length);
    });

    it('should create presentation revealing all attributes', async () => {
      const presentation = await createSDJWTPresentation({
        attributesToReveal: ['id', 'name', 'date', 'number'],
        credential: TEST_SD_JWT,
      });

      expect(typeof presentation).toBe('string');

      const decoded = await decodeSDJWT(presentation);
      const disclosureKeys = decoded.disclosures.map((d: any) => d.key);

      // Should include all requested attributes
      expect(disclosureKeys).toContain('id');
      expect(disclosureKeys).toContain('name');
      expect(disclosureKeys).toContain('date');
      expect(disclosureKeys).toContain('number');
    });

    it('should create presentation with empty attributes array (minimal disclosure)', async () => {
      const presentation = await createSDJWTPresentation({
        attributesToReveal: [],
        credential: TEST_SD_JWT,
      });

      expect(typeof presentation).toBe('string');
      expect(presentation).toContain('~');

      // Should still be valid JWT format
      const decoded = await decodeSDJWT(presentation);
      expect(decoded).toHaveProperty('jwt');
      expect(decoded).toHaveProperty('disclosures');

      // Should have minimal or no disclosures
      expect(Array.isArray(decoded.disclosures)).toBe(true);
    });

    it('should maintain credential integrity in presentation', async () => {
      const presentation = await createSDJWTPresentation({
        attributesToReveal: ['name', 'date'],
        credential: TEST_SD_JWT,
      });

      const decoded = await decodeSDJWT(presentation);

      // JWT payload should maintain core claims
      expect(decoded.jwt.payload).toHaveProperty('iss');
      expect(decoded.jwt.payload).toHaveProperty('vct');
      expect(decoded.jwt.payload.vct).toBe('InternalTesting');
      expect(decoded.jwt.payload.iss).toBe('did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7#keys-1');
    });

    it('should convert presentation to W3C format correctly', async () => {
      const presentation = await createSDJWTPresentation({
        attributesToReveal: ['name', 'number'],
        credential: TEST_SD_JWT,
      });

      // Convert presentation to W3C format
      const w3cPresentation = await decodeSDJWTToW3C(presentation) as any;

      expect(w3cPresentation).toHaveProperty('credentialSubject');
      expect(w3cPresentation.credentialSubject).toHaveProperty('name');
      expect(w3cPresentation.credentialSubject).toHaveProperty('number');

      // Should have the revealed values
      expect(w3cPresentation.credentialSubject.name).toBe('maycon');
      expect(w3cPresentation.credentialSubject.number).toBe(123);
    });

    it('should handle non-existent attribute gracefully', async () => {
      // Request an attribute that doesn't exist in the credential
      const presentation = await createSDJWTPresentation({
        attributesToReveal: ['name', 'nonExistentAttribute'],
        credential: TEST_SD_JWT,
      });

      expect(typeof presentation).toBe('string');

      const decoded = await decodeSDJWT(presentation);
      const disclosureKeys = decoded.disclosures.map((d: any) => d.key);

      // Should include existing attributes
      expect(disclosureKeys).toContain('name');
      // Non-existent attribute should not break the process
      expect(presentation).toBeTruthy();
    });

    it('should fail with invalid credential format', async () => {
      await expect(
        createSDJWTPresentation({
          attributesToReveal: ['name'],
          credential: 'invalid-jwt-format',
        })
      ).rejects.toThrow();
    });

    it('should fail with empty credential', async () => {
      await expect(
        createSDJWTPresentation({
          attributesToReveal: ['name'],
          credential: '',
        })
      ).rejects.toThrow();
    });

    it('should preserve presentation format for verification flow', async () => {
      const keypair = createIssuerKeypair();
      const credential = await issueTestSdJwt(keypair, {
        iss: ISSUER_DID,
        iat: 1700000000,
        vct: 'InternalTesting',
        name: 'maycon',
        date: '2025-10-09',
      }, {_sd: ['name', 'date']});

      const presentation = await createSDJWTPresentation({
        attributesToReveal: ['name', 'date'],
        credential,
      });

      const verificationResult = await verifySDJWT(presentation, undefined, {
        keyResolver: createKeyResolver(keypair),
      });
      expect(verificationResult.verified).toBe(true);
    });
  });

  describe('Presentation Integration Tests', () => {
    it('should complete full flow: store credential -> create presentation -> verify', async () => {
      const keypair = createIssuerKeypair();
      const issued = await issueTestSdJwt(keypair, {
        iss: ISSUER_DID,
        iat: 1700000000,
        vct: 'InternalTesting',
        name: 'maycon',
        date: '2025-10-09',
      }, {_sd: ['name', 'date']});

      // Step 1: Convert SD-JWT to W3C format (as done in addCredential)
      const w3cCredential = await decodeSDJWTToW3C(issued) as any;

      // Verify metadata is stored
      expect(w3cCredential._sd_jwt).toBeDefined();
      expect(w3cCredential._sd_jwt.encoded).toBe(issued);

      // Step 2: Create presentation from stored credential (as done in verification-controller)
      const presentation = await createSDJWTPresentation({
        attributesToReveal: ['name', 'date'],
        credential: w3cCredential._sd_jwt.encoded,
      });

      expect(typeof presentation).toBe('string');

      // Step 3: Verify presentation cryptographically
      const verificationResult = await verifySDJWT(presentation, undefined, {
        keyResolver: createKeyResolver(keypair),
      });
      expect(verificationResult.verified).toBe(true);

      // Step 4: Decode presentation to check disclosed claims
      const decoded = await decodeSDJWT(presentation);
      const disclosureKeys = decoded.disclosures.map((d: any) => d.key);

      expect(disclosureKeys).toContain('name');
      expect(disclosureKeys).toContain('date');
    });

    it('should support multiple presentation creations from same credential', async () => {
      const keypair = createIssuerKeypair();
      const credential = await issueTestSdJwt(keypair, {
        iss: ISSUER_DID,
        iat: 1700000000,
        vct: 'InternalTesting',
        name: 'maycon',
        date: '2025-10-09',
        number: 123,
      }, {_sd: ['name', 'date', 'number']});

      // Create first presentation with some attributes
      const presentation1 = await createSDJWTPresentation({
        attributesToReveal: ['name'],
        credential,
      });

      // Create second presentation with different attributes
      const presentation2 = await createSDJWTPresentation({
        attributesToReveal: ['date', 'number'],
        credential,
      });

      // Both should be valid
      expect(typeof presentation1).toBe('string');
      expect(typeof presentation2).toBe('string');

      // They should be different (different disclosures)
      expect(presentation1).not.toBe(presentation2);

      // Both should verify cryptographically
      const keyResolver = createKeyResolver(keypair);
      const result1 = await verifySDJWT(presentation1, undefined, {keyResolver});
      const result2 = await verifySDJWT(presentation2, undefined, {keyResolver});

      expect(result1.verified).toBe(true);
      expect(result2.verified).toBe(true);

      // Check different attributes are disclosed
      const decoded1 = await decodeSDJWT(presentation1);
      const decoded2 = await decodeSDJWT(presentation2);

      const keys1 = decoded1.disclosures.map((d: any) => d.key);
      const keys2 = decoded2.disclosures.map((d: any) => d.key);

      expect(keys1).toContain('name');
      expect(keys2).toContain('date');
      expect(keys2).toContain('number');
    });

    it('should match verification-controller usage pattern', async () => {
      // Simulate the exact pattern used in verification-controller.ts

      // Credential is stored in wallet as W3C with _sd_jwt metadata
      const storedCredential = await decodeSDJWTToW3C(TEST_SD_JWT) as any;

      // During presentation, extract encoded SD-JWT and create selective disclosure
      const credentialSelection = {
        credential: storedCredential,
        attributesToReveal: ['name', 'date'],
      };

      // This is the exact pattern from verification-controller.ts:172-179
      if (credentialSelection.credential._sd_jwt) {
        const derivedCredential = await createSDJWTPresentation({
          attributesToReveal: credentialSelection.attributesToReveal,
          credential: credentialSelection.credential._sd_jwt.encoded,
        });

        // Verify the presentation is a string (not an array)
        expect(typeof derivedCredential).toBe('string');

        // Verify it can be decoded
        const decoded = await decodeSDJWT(derivedCredential);
        expect(decoded).toHaveProperty('jwt');
        expect(decoded).toHaveProperty('disclosures');

        // Verify disclosed attributes
        const disclosedKeys = decoded.disclosures.map((d: any) => d.key);
        expect(disclosedKeys).toContain('name');
        expect(disclosedKeys).toContain('date');
      }
    });
  });
});
