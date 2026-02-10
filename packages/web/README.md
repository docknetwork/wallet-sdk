# Truvera Web Wallet SDK

A simplified, browser-ready wrapper for the Wallet SDK, specialized for cloud wallet functionality.

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

> [!IMPORTANT]
> This SDK is designed for **browser-side use only**.

1.  **Client-Side Only**: Your wallet keys (mnemonic/master key) decrypt your data locally in the browser. **Never** send these keys to a server or store them where they can be accessed by third parties.
2.  **No Server-Side Operations**: Do not use this SDK to initialize wallets or process keys on a backend server. Server-side handling of user keys creates significant security risks and breaks the non-custodial model.
3.  **End-to-End Encryption**: User data stored in the Cloud Wallet (EDV) is fully encrypted. The decryption key exists *only* in the user's browser session.
4.  **Authentication vs Encryption**: The `edvAuthKey` is strictly for authenticating the client with the storage server. It does **not** grant access to the encrypted data content; only the user's keys can do that. You can request an `edvAuthKey` by contacting Truvera support at [docs.truvera.io/support](https://docs.truvera.io/support).

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
// Default import
import TruveraWebWallet from '@docknetwork/wallet-sdk-web';

async function main() {
  const wallet = await TruveraWebWallet.initialize({ ... });
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
  credentials: [
    {
      id: 'https://creds-testnet.truvera.io/c7f3e722287d1ea98c136ad5df8066209c5e9b44c6251af0860d62e9a3a21a76',
      attributesToReveal: ['credentialSubject.fullName', 'credentialSubject.age']
    },
  ],
  proofRequestUrl: 'https://creds-staging.truvera.io/proof/77ae2c67-678e-4cb6-8c5d-a4dd4a1a19f1'
});
```

**Parameters**:
-   `credentials` (Array<Object>): Array of credential objects to include in the presentation.
    -   `credentials[].id` (string): The credential ID.
    -   `credentials[].attributesToReveal` (Array<string>): Array of attribute names to reveal from this credential.
-   `proofRequestUrl` (string): The URL of the proof request template from the verifier.

**Returns**: `Promise<Object>` - The submission response from the verifier.
