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

The SDK exposes a global variable `TruveraWebWallet` when loaded in the browser.

### Initialization

```javascript
const wallet = await TruveraWebWallet.initialize({
    edvUrl: 'https://edv.dock.io',
    edvAuthKey: '<your-auth-key>',
    networkId: 'testnet',
    mnemonic: 'original there settle romance crazy fringe session wage despair medal bleak need',
});

const credentials = await wallet.getCredentials();

console.log(credentials);
```

