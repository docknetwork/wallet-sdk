# Truvera Web Wallet SDK

A browser-ready wallet SDK for interacting with the Truvera platform

## Installation

```bash
npm install @docknetwork/wallet-sdk-web
```

or via CDN:

```html
<script src="https://unpkg.com/@docknetwork/wallet-sdk-web/dist/wallet-sdk-web.iife.js"></script>
```

## Usage

The SDK can be used via a global variable (Script Tag) or imported as an ES Module (Bundlers).

### 1. Script Tag (Global)

When loaded via `<script>`, the SDK exposes a global variable `TruveraWebWallet`.

```html
<script src="https://unpkg.com/@docknetwork/wallet-sdk-web/dist/wallet-sdk-web.iife.js"></script>
<script>
  window.addEventListener('load', async () => {
    const wallet = await TruveraWebWallet.initialize({ ... });
  });
</script>
```

### 2. ES Module (Vite, Webpack, etc.)

You can import the SDK in your modern web application.

```javascript
// Default import (same API as global)
import TruveraWebWallet from '@docknetwork/wallet-sdk-web';

// OR Named imports
import { initialize, createWallet } from '@docknetwork/wallet-sdk-web';

async function main() {
  const wallet = await TruveraWebWallet.initialize({ ... });
  // or
  const wallet2 = await initialize({ ... });
}
```

### Key Generation (Optional)

If you don't have a mnemonic, you can generate a new master key/mnemonic pair using the SDK:

```javascript
const { masterKey, mnemonic } = await TruveraWebWallet.generateCloudWalletMasterKey();

console.log('Mnemonic:', mnemonic);
console.log('Master Key:', masterKey);
```

### Initialization

```javascript
const wallet = await TruveraWebWallet.initialize({
    edvUrl: 'https://edv.dock.io',
    edvAuthKey: '<your-auth-key>',
    networkId: 'testnet',
    // Use the mnemonic from generation or your existing one
    mnemonic: mnemonic, // or use masterKey: masterKey
});

const credentials = await wallet.getCredentials();

console.log(credentials);
```


## API Reference

The `initialize` method returns a `wallet` object with the following simplified methods:

### `getCredentials`

Get the list of credentials stored in the wallet.

```javascript
const credentials = await wallet.getCredentials();
```

**Returns**: `Promise<Array<Object>>` - Array of credential objects.

---

### `addCredential`

Import a credential using an offer URI.

```javascript
const credential = await wallet.addCredential('openid-credential-offer://...');
```

**Parameters**:
-   `uri` (string): The credential offer URI.

**Returns**: `Promise<Object>` - The imported credential.

---

### `getDID`

Get the default Decentralized Identifier (DID) associated with the wallet.

```javascript
const did = await wallet.getDID();
```

**Returns**: `Promise<object>` - The DID document.

---

### `submitPresentation`

Submit a presentation for specific credentials to a proof request URL.

```javascript
const response = await wallet.submitPresentation({
  credentials: {
    'credential-id-1': { attributesToReveal: ['name', 'email'] }
  },
  proofRequestUrl: 'https://verifier.example.com/proof-request'
});
```

**Parameters**:
-   `credentials` (Object): Map of credential IDs to configuration (e.g., `attributesToReveal`).
-   `proofRequestUrl` (string): The URL of the proof request template.

**Returns**: `Promise<Object>` - The verification response.
