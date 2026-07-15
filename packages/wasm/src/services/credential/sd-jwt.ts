import {SDJwtVcInstance} from '@sd-jwt/sd-jwt-vc';
import {digest, generateSalt} from '@sd-jwt/crypto-nodejs';
import base64url from 'base64url';
// @ts-ignore - @docknetwork/credential-sdk subpath ships no type declarations
import * as vcCrypto from '@docknetwork/credential-sdk/vc/crypto';
const {
  Ed25519VerificationKey2018,
  Ed25519VerificationKey2020,
  EcdsaSecp256k1VerificationKey2019,
  EcdsaSecp256r1VerificationKey2019,
} = vcCrypto as any;
import {blockchainService} from '../blockchain/service';

// Maps a resolved DID verification-method `type` to the credential-sdk key class
// whose `.verifier().verify({data, signature})` checks the issuer signature.
const VERIFICATION_KEY_CLASSES = {
  Ed25519VerificationKey2018,
  Ed25519VerificationKey2020,
  EcdsaSecp256k1VerificationKey2019,
  EcdsaSecp256r1VerificationKey2019,
};

/**
 * Builds an SD-JWT `verifier(data, sig)` callback that checks the issuer
 * signature against the issuer's public key. The key is taken from an embedded
 * JWK (`cnf.jwk` / header `jwk`) when present, otherwise resolved from the DID
 * in `iss` — which must be the full verification method (`did:...#key-1`).
 */
async function buildIssuerVerifier(decoded) {
  const payload: any = decoded.jwt.payload;
  const header: any = decoded.jwt.header;

  const iss: string | undefined = payload.iss || payload.issuer;
  const embeddedJwk = payload?.cnf?.jwk || header?.jwk;

  const verificationMethod = embeddedJwk
    ? {type: 'JsonWebKey2020', publicKeyJwk: embeddedJwk}
    : await resolveIssuerVerificationMethod(iss);

  const KeyClass = VERIFICATION_KEY_CLASSES[verificationMethod.type];
  if (!KeyClass) {
    throw new Error(
      `Unsupported issuer key type for verification: ${verificationMethod.type}`,
    );
  }

  const {verify} = KeyClass.from(verificationMethod).verifier();

  // sd-jwt passes the signing input `data` and the base64url `sig`; the
  // credential-sdk verifier wants the raw signature bytes.
  return async (data, sig) =>
    verify({data: Buffer.from(data), signature: base64url.toBuffer(sig)});
}

/**
 * Resolves the issuer DID and returns the verification method whose `id`
 * exactly matches `iss`.
 */
async function resolveIssuerVerificationMethod(iss?: string) {
  if (!iss) {
    throw new Error('Issuer (iss) not found in SD-JWT');
  }

  const didDocument: any = await blockchainService.resolveDID(iss);
  const candidates = [
    ...(didDocument?.verificationMethod || []),
    ...(didDocument?.keyAgreement || []),
    ...(didDocument?.publicKey || []),
  ];

  const match = candidates.find(key => key.id === iss);
  if (!match) {
    throw new Error(`Cannot find issuer key document with ID: ${iss}`);
  }
  return match;
}

/**
 * Checks if a value is a decoded SD-JWT payload object — i.e. an SD-JWT VC
 * payload returned as JSON rather than the compact `header.payload.sig~...` form.
 */
export function isDecodedSDJWTPayload(value): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Array.isArray((value as any)._sd) &&
    typeof (value as any)._sd_alg === 'string'
  );
}

/**
 * Checks if a credential is an SD-JWT credential.
 * Accepts either the compact SD-JWT string or a decoded SD-JWT VC payload object.
 */
export function isSDJWTCredential(credential) {
  if (isDecodedSDJWTPayload(credential)) {
    return true;
  }

  if (typeof credential !== 'string' || !credential.includes('.')) {
    return false;
  }

  try {
    const decodedHeader = JSON.parse(base64url.decode(credential.split('.')[0]));
    return (
      decodedHeader?.typ === 'dc+sd-jwt' || decodedHeader?.typ === 'vc+sd-jwt'
    );
  } catch {
    return false;
  }
}

export async function createSDJWTPresentation({
  attributesToReveal,
  credential,
}: {
  attributesToReveal: string[];
  credential: string;
}) {
  const sdjwt = new SDJwtVcInstance({
    signAlg: 'EdDSA',
    hasher: digest,
    hashAlg: 'sha-256',
    saltGenerator: generateSalt,
  });

  // Holder defines the presentation frame to specify which claims should be presented
  // The list of presented claims must be a subset of the disclosed claims
  const presentationFrame: any = {};
  attributesToReveal.forEach(attribute => {
    presentationFrame[attribute.replace('credentialSubject.', '')] = true;
  });

  // Holder creates a presentation using the issued credential and the presentation frame
  // returns an encoded SD JWT.
  const presentation = await sdjwt.present(credential, presentationFrame);

  return presentation;
}
/**
 * Decodes an SD-JWT string into its structured format
 * @param {string} sdJwtString - The SD-JWT string to decode
 * @returns {Promise<Object>} Decoded SD-JWT structure with jwt and disclosures
 */
export async function decodeSDJWT(sdJwtString) {
  // Create SD-JWT instance with minimal configuration (no verification needed for decoding)
  const sdjwt = new SDJwtVcInstance({
    signAlg: 'EdDSA',
    hasher: digest,
    hashAlg: 'sha-256',
    saltGenerator: generateSalt,
  });

  // Decode the SD-JWT
  return await sdjwt.decode(sdJwtString);
}

/**
 * Verifies an SD-JWT credential
 * @param {string} jwt - The SD-JWT string to verify
 * @returns {Promise<Object>} Verification result with verified status and optional error
 * @returns {boolean} returns.verified - Whether the credential is valid
 * @returns {string} [returns.error] - Error message if verification failed
 */
export async function verifySDJWT(jwt) {
  try {
    // Resolve the issuer's public key (embedded JWK or DID) and build a
    // signature verifier for it.
    const decoded = await decodeSDJWT(jwt);
    const signAlg = (decoded.jwt.header?.alg as string) || 'EdDSA';
    const verifier = await buildIssuerVerifier(decoded);

    const sdjwt = new SDJwtVcInstance({
      signAlg,
      verifier,
      hasher: digest,
      hashAlg: 'sha-256',
      saltGenerator: generateSalt,
    });

    // verify() checks the issuer signature, the iat/nbf/exp dates, and that
    // every disclosure digest matches the `_sd` array. Throws on any failure.
    await sdjwt.verify(jwt);

    return {
      verified: true,
    };
  } catch (error) {
    return {
      verified: false,
      error: error.message || 'Failed to verify SD-JWT credential',
    };
  }
}

/**
 * Converts a decoded SD-JWT into W3C Verifiable Credential format
 * @param {Object} decodedSDJWT - The decoded SD-JWT object from SDJwtVcInstance.decode()
 * @param {string} [encodedSDJWT] - Optional raw encoded SD-JWT string
 * @returns {Object} W3C Verifiable Credential format with SD-JWT metadata
 */
export function sdJwtToW3C(decodedSDJWT, encodedSDJWT?) {
  const {jwt, disclosures} = decodedSDJWT;

  // The jwt object already has header and payload parsed
  const header = jwt.header;
  const payload = jwt.payload;

  // Build credential subject from disclosed claims
  const credentialSubject: any = {};

  // Process disclosures to build the credential subject
  if (disclosures && Array.isArray(disclosures)) {
    disclosures.forEach(disclosure => {
      if (disclosure && disclosure.key && disclosure.value !== undefined) {
        credentialSubject[disclosure.key] = disclosure.value;
      }
    });
  }

  // Extract issuer from payload
  const issuer = payload.iss || payload.issuer;

  // Extract subject ID if present in disclosures
  const subjectId = credentialSubject.id;

  // Build final credential subject with id if available
  const finalCredentialSubject = subjectId
    ? {id: subjectId, ...credentialSubject}
    : credentialSubject;

  // Extract credential type from vct (verifiable credential type) field
  // vct is the SD-JWT VC type claim
  const credentialType = payload.vct || 'UnknownCredential';

  // Build the W3C credential
  const w3cCredential: any = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', credentialType],
    issuer: issuer,
    credentialSubject: finalCredentialSubject,
  };

  // Add issuance date if available
  if (payload.iat) {
    w3cCredential.issuanceDate = new Date(payload.iat * 1000).toISOString();
  }

  // Add expiration date if available
  if (payload.exp) {
    w3cCredential.expirationDate = new Date(payload.exp * 1000).toISOString();
  }

  // Add credential ID if available
  if (payload.jti) {
    w3cCredential.id = payload.jti;
  }

  // Store SD-JWT metadata for unwrapping during presentation flow
  // This allows converting back to SD-JWT format when needed
  w3cCredential._sd_jwt = {
    // Raw encoded SD-JWT string
    encoded: encodedSDJWT,
  };

  return w3cCredential;
}

/**
 * Decodes an SD-JWT string and converts it to W3C credential format
 * @param {string} sdJwtString - The SD-JWT string
 * @returns {Promise<Object>} W3C Verifiable Credential format with SD-JWT metadata
 */
export async function decodeSDJWTToW3C(sdJwtString) {
  // Decode the SD-JWT using the reusable decode function
  const decoded = await decodeSDJWT(sdJwtString);

  // Convert to W3C format, passing both decoded data and raw string
  return sdJwtToW3C(decoded, sdJwtString);
}

/**
 * Converts a credential to W3C format
 * Handles both SD-JWT credentials (needs decoding) and regular W3C credentials (returns as-is)
 * @param {string|Object} credential - Either an SD-JWT string or a credential object
 * @returns {Promise<Object>} W3C Verifiable Credential format
 */
export async function credentialToW3C(credential) {
  // Decoded SD-JWT VC payload (no compact serialization available)
  if (isDecodedSDJWTPayload(credential)) {
    return sdJwtToW3C({jwt: {header: {}, payload: credential}, disclosures: []});
  }

  // If it's already an object with a type field, assume it's already W3C format
  if (typeof credential === 'object' && credential.type) {
    return credential;
  }

  // If it's a string, check if it's an SD-JWT
  if (typeof credential === 'string') {
    // First try to parse as JSON
    try {
      const parsed = JSON.parse(credential);
      if (isDecodedSDJWTPayload(parsed)) {
        return sdJwtToW3C({jwt: {header: {}, payload: parsed}, disclosures: []});
      }
      if (parsed.type) {
        return parsed;
      }
    } catch (e) {
      // Not a JSON string, might be a JWT
    }

    // Check if it's an SD-JWT
    try {
      if (isSDJWTCredential(credential)) {
        return await decodeSDJWTToW3C(credential);
      }
    } catch (e) {
      // Not a valid SD-JWT
    }
  }

  throw new Error('Unable to convert credential to W3C format');
}
