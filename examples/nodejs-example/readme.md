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

## Verification example

We provide two examples for credential verification using the SDK.

``` bash
npm run verification-submission-example
```

``` bash
npm run verification-evaluation-example
```

