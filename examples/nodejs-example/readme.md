# Wallet SDK NodeJS examples
This example illustrates how to install the Truvera Wallet SDK in a Node.js application.

## Installation steps

```bash
npm install
```

## OID4VC example

In this example, we will show how to use OID4VC to import credentials and then list them using the Wallet SDK.
You can read more about OID4VC in [our docs](https://docs.dock.io/developer-documentation/key-standards/interoperability-with-openid/openid-issuance-and-verification-integration-guide)

### Step 1: Generate an OpenID issuer and credential offer

To get started, define your environment variables to access the Truvera API:

```bash
export CERTS_API_KEY=<Your Truvera API Key>
export CERTS_API_URL=https://api.truvera.io
export ISSUER_DID=<Issuer DID>
```
Note: 
* API keys can be defined on the [API Keys](https://truvera.io/keys) page in Truvera Workspace
* Issuer DIDs can be viewed on the [Organization Profiles](https://truvera.io/dids) page in Truvera Workspace 

Next, generate the OpenID issuer and the credential offer by running the following command:

```bash
node generate-oid4vc-offer.js
```

The output should look like this:

```bash
OpenID issuer 89fedd04-8eab-4c38-9c6c-625643bf6931 was created.
OID4VC offer undefined was created.
Copy your OID4VC URL: openid-credential-offer://?credential_offer=%7B%......
```

### Step 2: Import the credential into the wallet

Now that you have an OID4VC URL, you can import it into the wallet using the Wallet SDK.

First, define the credential offer URL as an environment variable so our script can access it:

```bash
export CREDENTIAL_OFFER_URL=<Paste_your_credential_offer_URL_here>
```

In a real-world scenario, this credential offer URL would typically be rendered as a QR code for the user to scan with their wallet app.

Now you can run the Wallet SDK example to import the credential into the wallet:

```bash
npm run oid4vc-example <OID4VC_URL>
```

The example above creates an instance of the Wallet SDK, imports the credential into the wallet, and then logs the list of credentials available in the user database. Note that the imported credential is stored locally on the device, and in this Node.js example, it uses SQLite for storage.

## Storage location in Node.js

Wallet documents are stored via the data store (SQLite in this example). Separately, the WASM package keeps some data in `localStorage` (e.g. the DID resolution cache). In Node.js there is no native `localStorage`, so the SDK falls back to [`node-localstorage`](https://www.npmjs.com/package/node-localstorage), which persists to a `./local-storage` directory relative to the current working directory.

To store it elsewhere, set the `LOCAL_STORAGE_PATH` environment variable:

```bash
export LOCAL_STORAGE_PATH=/path/to/local-storage
```

## Verification example

We provide two examples for credential verification using the SDK.

``` bash
npm run verification-submission-example
```

``` bash
npm run verification-evaluation-example
```

## ⚠️ Experimental ESM Compatibility

The `wallet-sdk` can be made to work in ESM-based environments, but **full ESM support is not yet official**. Only basic functionalities have been tested, and the current setup relies on temporary patches and dependency overrides.

For now, **ESM usage is experimental and not encouraged for production**.

## ESM Setup (Temporary Workarounds)

To run the SDK in an ESM environment, the following changes were required:

### 1. Patch: `@docknetwork/cheqd-blockchain-api`

A patch (via `patch-package`) is needed to replace dynamic CommonJS `require()` calls with native ESM `import()` statements.

File: `patches/@docknetwork+cheqd-blockchain-api+4.0.3.patch`

Core change:

```javascript
diff --git a/node_modules/@docknetwork/cheqd-blockchain-api/dist/cjs/api/index.cjs b/node_modules/@docknetwork/cheqd-blockchain-api/dist/cjs/api/index.cjs
index 798767a..75b1d5a 100644
--- a/node_modules/@docknetwork/cheqd-blockchain-api/dist/cjs/api/index.cjs
+++ b/node_modules/@docknetwork/cheqd-blockchain-api/dist/cjs/api/index.cjs
@@ -191,10 +188,10 @@ class CheqdAPI extends common.AbstractApiProvider {
       MsgCreateDidDocPayload,
       MsgUpdateDidDocPayload,
       MsgDeactivateDidDocPayload,
-    } = await Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('@cheqd/ts-proto/cheqd/did/v2/index.js')); });
-    const { MsgCreateResourcePayload } = await Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require(
+    } = await import('@cheqd/ts-proto/cheqd/did/v2/index.js');
+    const { MsgCreateResourcePayload } = await import(
       '@cheqd/ts-proto/cheqd/resource/v2/index.js'
-    )); });
+    );

     this.Payloads = api_typeUrl.buildTypeUrlObject(
       [types.CheqdDIDDocument, MsgCreateDidDocPayload],
```

### 2. Required package.json Overrides
```json
  "overrides": {
    "did-jwt-cjs": {
      "@scure/base": "1.2.6"
    },
    "p-limit": "2.3.0"
  }
```
These overrides resolve mismatched dependency versions that break ESM resolution.

### 3. Additional Dependency Required

Install ky manually:
```bash
npm install ky@^0.25.1
```

### Status

These steps allow the SDK to operate in an ESM environment for basic use cases, but:
- They rely on unsupported patches
- They may break with future releases
- Not all features have been validated in ESM

**Until full ESM support is implemented, CommonJS remains the recommended environment.**
