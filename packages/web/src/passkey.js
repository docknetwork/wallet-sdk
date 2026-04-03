/**
 * @module passkey
 * @description WebAuthn passkey helpers for deriving wallet keys using the PRF extension.
 * Provides browser-side functions for registering passkeys and extracting deterministic
 * key material via the WebAuthn PRF extension (Chrome 116+, Safari 18+).
 */

/**
 * Checks if the browser supports WebAuthn and the PRF extension.
 * Note: PRF support can only be fully confirmed during credential creation.
 * @returns {Promise<{webauthn: boolean, prf: boolean}>}
 */
export async function checkPasskeySupport() {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential
  ) {
    return {webauthn: false, prf: false};
  }

  // PRF support is confirmed during registration via getClientExtensionResults().prf.enabled
  // We can only report WebAuthn availability at detection time
  return {webauthn: true, prf: true};
}

/**
 * Computes a deterministic PRF salt from an identifier.
 * @param {string} identifier - User's identifier (email, phone number, etc.)
 * @returns {Promise<Uint8Array>} 32-byte SHA-256 hash to use as PRF salt
 */
async function computePRFSalt(identifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`truvera-wallet-prf-salt:${identifier}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Converts a Uint8Array to a base64url string for storage.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function credentialIdToBase64url(bytes) {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Converts a base64url string back to a Uint8Array.
 * @param {string} base64url
 * @returns {Uint8Array}
 */
export function base64urlToCredentialId(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/**
 * Registers a new passkey credential with PRF extension support.
 * Safari 18 does not support PRF during creation, so PRF output is only
 * available during subsequent authentication assertions.
 *
 * @param {string} identifier - User's identifier (email, phone number, etc.)
 * @param {string} [rpName='Truvera Wallet'] - Relying party display name
 * @param {string} [rpId] - Relying party ID (defaults to current hostname)
 * @returns {Promise<{credentialId: Uint8Array, prfSupported: boolean}>}
 * @throws {Error} If WebAuthn is not supported or user cancels
 */
export async function registerPasskey(identifier, rpName, rpId) {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: {
        name: rpName || 'Truvera Wallet',
        id: rpId || window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(identifier),
        name: identifier,
        displayName: identifier,
      },
      pubKeyCredParams: [
        {alg: -7, type: 'public-key'},   // ES256
        {alg: -257, type: 'public-key'},  // RS256
      ],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      extensions: {
        prf: {},
      },
    },
  });

  const extensionResults = credential.getClientExtensionResults();
  const prfSupported = extensionResults.prf?.enabled === true;

  return {
    credentialId: new Uint8Array(credential.rawId),
    prfSupported,
  };
}

/**
 * Performs a WebAuthn assertion with the PRF extension to extract deterministic
 * key material from the passkey.
 *
 * When credentialId is provided, the browser uses it directly (no picker shown).
 * When omitted, the browser shows a passkey picker for discoverable credentials,
 * enabling cross-device usage (e.g., same passkey synced via iCloud Keychain).
 *
 * @param {string} identifier - User's identifier (email, phone number, etc.)
 * @param {Object} [options] - Optional parameters
 * @param {Uint8Array} [options.credentialId] - The credential ID from registration (omit to show passkey picker)
 * @param {string} [options.rpId] - Relying party ID (defaults to current hostname)
 * @returns {Promise<{prfOutput: Uint8Array, credentialId: Uint8Array}>} PRF output and the credential ID used
 * @throws {Error} If PRF extension is not supported or returns no result
 */
export async function getPasskeyPRFKey(identifier, options = {}) {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const salt = await computePRFSalt(identifier);

  const publicKeyOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rpId: options.rpId || window.location.hostname,
    userVerification: 'required',
    extensions: {
      prf: {
        eval: {
          first: salt,
        },
      },
    },
  };

  // When credentialId is provided, skip the passkey picker
  // When omitted, browser shows discoverable credential picker (cross-device friendly)
  if (options.credentialId) {
    // Ensure credentialId is a proper ArrayBuffer (WebAuthn requires BufferSource)
    const id = options.credentialId instanceof ArrayBuffer
      ? options.credentialId
      : new Uint8Array(options.credentialId).buffer;

    publicKeyOptions.allowCredentials = [
      {
        id,
        type: 'public-key',
      },
    ];
  }

  const assertion = await navigator.credentials.get({
    publicKey: publicKeyOptions,
  });

  const prfResults = assertion.getClientExtensionResults().prf?.results;

  if (!prfResults || !prfResults.first) {
    throw new Error(
      'PRF extension not supported by this authenticator. ' +
      'Passkey-based wallet access requires Chrome 116+ or Safari 18+.'
    );
  }

  return {
    prfOutput: new Uint8Array(prfResults.first),
    credentialId: new Uint8Array(assertion.rawId),
  };
}
