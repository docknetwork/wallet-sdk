// Browser-compatible shim for @sd-jwt/crypto-nodejs
// Uses Web Crypto API instead of Node.js crypto

const generateSalt = (length) => {
  if (length <= 0) return '';
  const array = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(array);
  const hex = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  return hex.substring(0, length);
};

const toWebCryptoAlg = (hashAlg) => hashAlg.toLowerCase();

const digest = async (data, algorithm = 'sha-256') => {
  const encoder = new TextEncoder();
  const encoded = typeof data === 'string' ? encoder.encode(data) : data;
  const hashBuffer = await crypto.subtle.digest(toWebCryptoAlg(algorithm), encoded);
  return new Uint8Array(hashBuffer);
};

const ES256 = {
  alg: 'ES256',
  async generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    return { publicKey: publicKeyJWK, privateKey: privateKeyJWK };
  },
  async getSigner(privateKeyJWK) {
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      privateKeyJWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign'],
    );
    return async (data) => {
      const encoder = new TextEncoder();
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        privateKey,
        encoder.encode(data),
      );
      return btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    };
  },
  async getVerifier(publicKeyJWK) {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      publicKeyJWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify'],
    );
    return async (data, signatureBase64url) => {
      const encoder = new TextEncoder();
      const signature = Uint8Array.from(
        atob(signatureBase64url.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      );
      return crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        publicKey,
        signature,
        encoder.encode(data),
      );
    };
  },
};

module.exports = { ES256, digest, generateSalt };
