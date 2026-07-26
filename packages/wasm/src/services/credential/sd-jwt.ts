// @ts-nocheck
import {
  decodeSdJwt,
  isSDJWTCredential as isCompactSDJWTCredential,
  verifySDJWTCredential,
} from '@docknetwork/crypto-utils';
import {SDJwtVcInstance} from '@sd-jwt/sd-jwt-vc';
import {digest, generateSalt} from '@sd-jwt/crypto-nodejs';

export {verifySDJWTCredential};

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

  return isCompactSDJWTCredential(credential);
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
  return decodeSdJwt(sdJwtString);
}

/**
 * Verifies an SD-JWT credential
 * @param {string|{jwt: string}} jwt - The SD-JWT string (or `{jwt}`) to verify
 * @param {string[]} [requiredAttribs] - Required disclosed claim keys
 * @param {object} [options]
 * @param {function} [options.keyResolver] async (issOrKid) => verification key
 * @param {function} [options.documentLoader] (uri) => Promise<{document}>
 * @param {{supports: function, resolve: function}} [options.resolver]
 * @param {string[]} [options.algorithms]
 * @returns {Promise<Object>} Verification result
 */
export async function verifySDJWT(jwt, requiredAttribs?, options = {}) {
  try {
    return await verifySDJWTCredential(jwt, requiredAttribs, options);
  } catch (error) {
    return {
      verified: false,
      error: error?.message || 'Failed to verify SD-JWT credential',
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
