/**
 * @module passkey
 * @description Low-level WebAuthn passkey helpers for the Truvera Wallet SDK.
 *
 * These functions handle the browser-side WebAuthn ceremonies for registering passkeys
 * and extracting deterministic key material via the PRF (Pseudo-Random Function) extension.
 * The PRF output is a 32-byte secret derived from the passkey's internal key and a
 * deterministic salt — same passkey + same salt always produces the same bytes.
 *
 * For most use cases, prefer the high-level `initialize({ passkey: true })` API in
 * the main SDK module. Use these helpers directly only when you need full control
 * over the WebAuthn ceremony flow.
 *
 * Browser requirements:
 * - Chrome 116+ (PRF supported during both create and get)
 * - Safari 18+ / macOS Sequoia / iOS 18 (PRF supported during get only)
 * - Edge 116+ (Chromium-based, same as Chrome)
 *
 * @see {@link module:@docknetwork/wallet-sdk-web} for the high-level passkey API
 */

/**
 * Checks if the browser supports WebAuthn.
 * PRF support cannot be determined until a credential ceremony is performed,
 * so it is reported as `'unknown'` here and confirmed during registration/assertion.
 * @returns {Promise<{webauthn: boolean, prf: boolean|'unknown'}>}
 */
export async function checkPasskeySupport() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return {webauthn: false, prf: false};
  }

  // PRF support is confirmed during registration via getClientExtensionResults().prf.enabled
  // We can only report WebAuthn availability at detection time
  return {webauthn: true, prf: 'unknown'};
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
  // Use chunked encoding to avoid call stack overflow on large credential IDs
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }

  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]/g, '');
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
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
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
        // WebAuthn spec requires user.id to be max 64 bytes; hash to ensure compliance
        id: new Uint8Array(
          await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(identifier),
          ),
        ),
        name: identifier,
        displayName: identifier,
      },
      pubKeyCredParams: [
        {alg: -7, type: 'public-key'}, // ES256
        {alg: -257, type: 'public-key'}, // RS256
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
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !window.PublicKeyCredential ||
    !navigator.credentials
  ) {
    throw new Error(
      'WebAuthn APIs are unavailable in this environment. ' +
        'Passkey operations require a browser with PublicKeyCredential and navigator.credentials support.',
    );
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
    const id =
      options.credentialId instanceof ArrayBuffer
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
        'Passkey-based wallet access requires Chrome 116+ or Safari 18+.',
    );
  }

  return {
    prfOutput: new Uint8Array(prfResults.first),
    credentialId: new Uint8Array(assertion.rawId),
  };
}
