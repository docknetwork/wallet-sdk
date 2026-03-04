// CryptoKey is available globally in Node.js 15+ but TypeScript needs
// the DOM lib to recognize it. Declare it here to avoid pulling in all DOM types.
type CryptoKey = import('crypto').webcrypto.CryptoKey;
