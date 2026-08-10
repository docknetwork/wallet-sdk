# Wallet SDK Core API Documentation

## Modules

<dl>
<dt><a href="#module_biometric-provider">biometric-provider</a></dt>
<dd><p>Biometric plugin for the Truvera Wallet SDK.
This module provides functions for biometric enrollment, matching, and identity verification processes.</p></dd>
<dt><a href="#module_cloud-wallet">cloud-wallet</a></dt>
<dd><p>Cloud wallet functionality for the Truvera Wallet SDK.
This module provides the main cloud wallet creation and management functions.</p></dd>
<dt><a href="#module_credential-provider">credential-provider</a></dt>
<dd><p>Verifiable credential management functionality for the Truvera Wallet SDK.
This module provides functions for importing, verifying, storing, and managing verifiable credentials.</p></dd>
<dt><a href="#module_did-provider">did-provider</a></dt>
<dd><p>DID (Decentralized Identifier) management functionality for the Truvera Wallet SDK.
This module provides functions for creating, importing, exporting, and managing DIDs.</p></dd>
<dt><a href="#module_message-provider">message-provider</a></dt>
<dd><p>DIDComm message management functionality for the Truvera Wallet SDK.
This module provides functions for sending, receiving, and processing DIDComm messages.</p></dd>
<dt><a href="#module_wallet">wallet</a></dt>
<dd><p>Core wallet functionality for the Dock Wallet SDK.
This module provides the main wallet creation and management functions.</p></dd>
</dl>

## Classes

<dl>
<dt><a href="#DefaultQRCodeProcessor">DefaultQRCodeProcessor</a></dt>
<dd><p>Default implementation of QRCodeProcessor</p>
<p>This processor manages a registry of QR code handlers and executes them
in priority order to process scanned QR codes. It provides a flexible,
extensible system for handling various types of QR codes in a wallet application.</p></dd>
<dt><a href="#OID4VCHandler">OID4VCHandler</a></dt>
<dd><p>Built-in handler for OID4VC (OpenID for Verifiable Credentials) URIs</p>
<p>This is a generic handler that can be configured with app-specific callbacks
for importing credentials. The handler itself only handles protocol detection
and delegates the actual import logic to the configured callback.</p>
<h2>Example Usage</h2>
<pre class="prettyprint source lang-typescript"><code>import { OID4VCHandler } from '@docknetwork/wallet-sdk-core/src/qr-handlers/builtin';
import { getCredentialProvider } from '@docknetwork/wallet-sdk-react-native';

<p>const handler = new OID4VCHandler({
  onImportCredential: async (uri, context) =&gt; {
    try {
      // Use SDK to import credential
      await getCredentialProvider().importCredentialFromURI({
        uri,
        didProvider: getDIDProvider(),
        getAuthCode: async (authUrl) =&gt; {
          // App-specific auth handling
          return await showAuthWebView(authUrl);
        },
      });</p>
<pre><code>  return { success: true };
} catch (error) {
  return {
    success: false,
    error: error instanceof Error ? error : new Error(String(error)),
  };
}
</code></pre>
<p>  },
});</p>
<p>processor.registerHandler(handler);
</code></pre></p>
<h2>Handler Priority</h2>
<p>Default priority: 5 (very high)
This ensures OID4VC URIs are checked before other credential handlers.</p></dd>
</dl>

## Members

<dl>
<dt><a href="#dockDocumentNetworkResolver">dockDocumentNetworkResolver</a></dt>
<dd><p>Given an Api URL, resolve the network ID
For now it will be applied for creds and certs
It can be extended to resolve other external URLs</p></dd>
<dt><a href="#OID4VCHandler">OID4VCHandler</a> ⇒</dt>
<dd><p>Create an OID4VC handler with custom configuration</p>
<p>This is a convenience factory function for creating an OID4VC handler.</p></dd>
<dt><a href="#DefaultQRCodeProcessor">DefaultQRCodeProcessor</a> ⇒</dt>
<dd><p>Create a new QR code processor instance</p>
<p>This is a convenience factory function for creating a processor.</p></dd>
</dl>

## Constants

<dl>
<dt><a href="#DELEGATION_PROPOSAL_HANDLER">DELEGATION_PROPOSAL_HANDLER</a></dt>
<dd><p>Delegator side: handles incoming delegation request messages and emits
'delegationRequestReceived' with matching credentials.</p></dd>
<dt><a href="#DELEGATION_REVOCATION_REGISTRY_ID">DELEGATION_REVOCATION_REGISTRY_ID</a></dt>
<dd><p>Wallet document id under which the single per-wallet revocation registry is
persisted. Holds { registryId, statusListCredentialUrl, nextIndex }.</p></dd>
<dt><a href="#STATUS_LIST_MAX_INDEX">STATUS_LIST_MAX_INDEX</a></dt>
<dd><p>Valid statusListIndex range for the fixed 131,072-bit status list.</p></dd>
<dt><a href="#MessageTypes">MessageTypes</a></dt>
<dd><p>DIDComm Message helpers
Check https://identity.foundation/didcomm-messaging/spec/#out-of-band-messages for more details</p></dd>
</dl>

## Functions

<dl>
<dt><a href="#issueCredential">issueCredential(credentialData, issuerKey, delegationPolicy, delegationRoleId, rootCredentialId, revocationContext)</a></dt>
<dd><p>Issue a delegatable credential</p></dd>
<dt><a href="#validateDelegationPolicy">validateDelegationPolicy()</a></dt>
<dd><p>Validate the structural integrity of a delegation policy.</p>
<p>Throws on the first failure. Only checks invariants that downstream code
relies on or that have security implications — fields like display labels
and metadata strings are left to the type contract.</p></dd>
<dt><a href="#assertPolicyConformsToParent">assertPolicyConformsToParent()</a></dt>
<dd><p>Assert that a delegation policy is a valid narrowing of a parent policy.</p>
<p>Run after <code>validateDelegationPolicy(policy)</code> succeeds. The parent policy is
trusted to already be valid (it came from a credential we issued or accepted).</p></dd>
<dt><a href="#fetchDelegationPolicyJson">fetchDelegationPolicyJson(credential)</a> ⇒</dt>
<dd><p>Fetch the delegation policy for a given credential</p></dd>
<dt><a href="#buildDelegationPolicyAttributes">buildDelegationPolicyAttributes(delegationPolicy)</a> ⇒</dt>
<dd><p>Build delegation policy attributes
This is needed when issuing a delegatable credential, so that we can include the delegation policy ID and digest in the credential attributes</p></dd>
<dt><a href="#createDelegationRequest">createDelegationRequest()</a></dt>
<dd><p>Delegatee side: validate and persist a DelegationRequest document.</p></dd>
<dt><a href="#sendDelegationRequest">sendDelegationRequest()</a></dt>
<dd><p>Delegatee side: send the propose-credential DIDComm message to the delegator.</p></dd>
<dt><a href="#rulesetMatches">rulesetMatches()</a></dt>
<dd><p>Canonical deep-equality of two rulesets — key and array ordering don't
affect the match.</p></dd>
<dt><a href="#resolveMatchingDelegationDetails">resolveMatchingDelegationDetails()</a></dt>
<dd><p>Matcher checks for one credential against a request. Returns delegation
details on match, throws with the reason otherwise.</p></dd>
<dt><a href="#findCredentialsForDelegationRequest">findCredentialsForDelegationRequest()</a></dt>
<dd><p>Delegator side: return wallet credentials that can fulfill the request.</p></dd>
<dt><a href="#approveDelegationRequest">approveDelegationRequest()</a></dt>
<dd><p>Delegator side: re-validate, issue the delegated credential and send it to
the requester.</p></dd>
<dt><a href="#rejectDelegationRequest">rejectDelegationRequest()</a></dt>
<dd><p>Delegator side: silent rejection — no message sent.</p></dd>
<dt><a href="#signRevocationJWT">signRevocationJWT()</a></dt>
<dd><p>Resolve the issuer DID's private key doc and produce a DID-signed JWT whose
payload mirrors <code>claims</code> plus the standard aud/iss/iat/exp fields.</p></dd>
<dt><a href="#postRevocation">postRevocation()</a></dt>
<dd><p>Sign a JWT mirroring <code>body</code>, then POST the revocation control action.
Throws on any non-2xx response.</p></dd>
<dt><a href="#claimRevocationRegistry">claimRevocationRegistry(ctx, registryId)</a> ⇒</dt>
<dd><p>Claim a registry with a DID-signed <code>create</code> call. Idempotent for the owning
DID. MUST be called BEFORE issuing any credential that references it.</p></dd>
<dt><a href="#getRevocationRegistry">getRevocationRegistry(ctx)</a> ⇒</dt>
<dd><p>Get the wallet's revocation registry, creating + claiming one on first use or
when the previous registry's index counter is exhausted.</p></dd>
<dt><a href="#allocateStatusEntry">allocateStatusEntry(ctx)</a> ⇒</dt>
<dd><p>Reserve the next statusListIndex and build the StatusList2021Entry to embed at
issuance. Increments and persists nextIndex atomically with wallet state.</p></dd>
<dt><a href="#parseStatusEntry">parseStatusEntry()</a></dt>
<dd><p>Validate a credential's credentialStatus is a well-formed StatusList2021Entry
and extract the registryId + integer index. Throws with a clear message on any
malformed/missing field rather than letting a downstream TypeError or NaN leak.</p></dd>
<dt><a href="#setDelegatableCredentialRevocation">setDelegatableCredentialRevocation(credential, ctx, action)</a></dt>
<dd><p>Revoke or unrevoke a delegatable credential.</p>
<p>Extracts registryId and index from the credential's credentialStatus,
signs a DID JWT, and POSTs the control action. Handles idempotency; a 409
indicates a wallet-side counter bug and should NOT be retried blindly.</p></dd>
<dt><a href="#isDelegatableCredentialRevoked">isDelegatableCredentialRevoked(credential)</a> ⇒</dt>
<dd><p>Check whether a delegatable credential is currently revoked.</p>
<p>Public read — no auth, no sponsor key. Fetches the StatusList2021Credential
from the credential's own statusListCredential URL and reads the bit at its
statusListIndex. Verifiers do this automatically; this is for wallet-side UI.</p></dd>
<dt><a href="#revokeDelegatableCredential">revokeDelegatableCredential()</a></dt>
<dd><p>Convenience wrapper: revoke.</p></dd>
<dt><a href="#unrevokeDelegatableCredential">unrevokeDelegatableCredential()</a></dt>
<dd><p>Convenience wrapper: unrevoke.</p></dd>
<dt><a href="#buildDelegationRoleTree">buildDelegationRoleTree(policy)</a> ⇒</dt>
<dd><p>Build a tree structure representing the roles in a delegation policy, based on their parent-child relationships</p></dd>
<dt><a href="#getRemainingDelegationDepth">getRemainingDelegationDepth(policy, roleId)</a> ⇒</dt>
<dd><p>Compute how many more times the holder of <code>roleId</code> may further delegate,
based on the policy's maxDelegationDepth and the holder's depth in the tree.</p></dd>
<dt><a href="#buildVerificationFlowInviteMessage">buildVerificationFlowInviteMessage()</a> ⇒</dt>
<dd></dd>
<dt><a href="#buildRequestVerifiablePresentationMessage">buildRequestVerifiablePresentationMessage()</a></dt>
<dd><p>Sender: Verifier
OOB message to request a verifiable presentation from the holder</p></dd>
<dt><a href="#buildAckWalletToWalletVerificationMessage">buildAckWalletToWalletVerificationMessage()</a></dt>
<dd><p>Sender: Holder
Start a wallet to wallet verification flow</p></dd>
<dt><a href="#buildVerifiablePresentationMessage">buildVerifiablePresentationMessage()</a></dt>
<dd><p>Sender: Holder
Send a verifiable presentation to the verifier</p></dd>
<dt><a href="#buildVerifiablePresentationAckMessage">buildVerifiablePresentationAckMessage()</a></dt>
<dd><p>Sender: Verifier
Sends an the presentation result to the holder</p></dd>
<dt><a href="#handleBlockchainNetworkChange">handleBlockchainNetworkChange()</a></dt>
<dd><p>Update existing blockchain network connection
Compare connected blockchain connection with the current walle network
Disconnect and Establish a new connection if the network is different</p></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#BiometricsProviderConfigs">BiometricsProviderConfigs</a> : <code>Object</code></dt>
<dd><p>Configuration options for biometric provider operations</p></dd>
<dt><a href="#WalletStatus">WalletStatus</a> : <code>&#x27;closed&#x27;</code> | <code>&#x27;loading&#x27;</code> | <code>&#x27;ready&#x27;</code> | <code>&#x27;error&#x27;</code></dt>
<dd><p>Possible wallet status values</p></dd>
<dt><a href="#KeypairType">KeypairType</a> : <code>&#x27;sr25519&#x27;</code> | <code>&#x27;ed25519&#x27;</code> | <code>&#x27;ecdsa&#x27;</code></dt>
<dd><p>Supported keypair types</p></dd>
</dl>

## Interfaces

<dl>
<dt><a href="#IDIDProvider">IDIDProvider</a></dt>
<dd><p>Provides a high-level API for DID management operations</p></dd>
<dt><a href="#IMessageProvider">IMessageProvider</a></dt>
<dd><p>Provides a high-level API for DIDComm message management operations</p></dd>
<dt><a href="#ICredentialProvider">ICredentialProvider</a></dt>
<dd><p>Provides a high-level API for verifiable credential management operations</p></dd>
<dt><a href="#IDVProcessOptions">IDVProcessOptions</a></dt>
<dd><p>Callback functions for handling different stages of the identity verification process</p></dd>
<dt><a href="#BiometricPlugin">BiometricPlugin</a></dt>
<dd><p>Defines the contract for biometric enrollment and matching operations</p></dd>
<dt><a href="#IDVProvider">IDVProvider</a></dt>
<dd><p>Defines the contract for identity verification operations</p></dd>
<dt><a href="#IDVProviderFactory">IDVProviderFactory</a></dt>
<dd><p>Creates IDV provider instances with proper event handling and wallet integration</p></dd>
<dt><a href="#IBiometricProvider">IBiometricProvider</a></dt>
<dd><p>Provides a high-level API for biometric identity verification operations</p></dd>
<dt><del><a href="#IV1Wallet">IV1Wallet</a></del></dt>
<dd><p>Legacy V1 wallet interface for backward compatibility</p></dd>
<dt><a href="#IWallet">IWallet</a> ⇐ <code><a href="#IV1Wallet">IV1Wallet</a></code></dt>
<dd><p>Main wallet interface providing methods for document management, import/export, and network operations.</p></dd>
</dl>

<a name="module_biometric-provider"></a>

## biometric-provider
<p>Biometric plugin for the Truvera Wallet SDK.
This module provides functions for biometric enrollment, matching, and identity verification processes.</p>


* [biometric-provider](#module_biometric-provider)
    * [~setConfigs(configs)](#module_biometric-provider..setConfigs)
    * [~isBiometricPluginEnabled()](#module_biometric-provider..isBiometricPluginEnabled) ⇒ <code>boolean</code>
    * [~assertConfigs()](#module_biometric-provider..assertConfigs)
    * [~getBiometricConfigs()](#module_biometric-provider..getBiometricConfigs) ⇒ <code>BiometricsProviderConfigs.&lt;unknown&gt;</code>
    * [~hasProofOfBiometrics(proofRequest)](#module_biometric-provider..hasProofOfBiometrics) ⇒ <code>boolean</code>
    * [~createBiometricProvider(params)](#module_biometric-provider..createBiometricProvider) ⇒ [<code>IBiometricProvider</code>](#IBiometricProvider)

<a name="module_biometric-provider..setConfigs"></a>

### biometric-provider~setConfigs(configs)
<p>Sets the global biometric provider configurations for the SDK</p>

**Kind**: inner method of [<code>biometric-provider</code>](#module_biometric-provider)  

| Param | Type | Description |
| --- | --- | --- |
| configs | <code>BiometricsProviderConfigs.&lt;unknown&gt;</code> | <p>The biometric provider configurations to set</p> |
| configs.enrollmentCredentialType | <code>string</code> | <p>The credential type for enrollment</p> |
| configs.biometricMatchCredentialType | <code>string</code> | <p>The credential type for biometric matching</p> |
| [configs.idvProvider] | <code>any</code> | <p>Optional IDV provider configuration</p> |

**Example**  
```js
import { setConfigs } from '@docknetwork/wallet-sdk-core/biometric-provider';

setConfigs({
  enrollmentCredentialType: 'BiometricEnrollment',
  biometricMatchCredentialType: 'BiometricMatch',
  idvProvider: myIDVProviderConfig
});
```
<a name="module_biometric-provider..isBiometricPluginEnabled"></a>

### biometric-provider~isBiometricPluginEnabled() ⇒ <code>boolean</code>
<p>Checks if the biometric plugin is enabled by verifying if biometric match credential type is configured</p>

**Kind**: inner method of [<code>biometric-provider</code>](#module_biometric-provider)  
**Returns**: <code>boolean</code> - <p>True if biometric match credential type is configured, false otherwise</p>  
**Example**  
```js
import { isBiometricPluginEnabled, setConfigs } from '@docknetwork/wallet-sdk-core/biometric-provider';

// Before configuration
console.log(isBiometricPluginEnabled()); // false

// After configuration
setConfigs({
  enrollmentCredentialType: 'BiometricEnrollment',
  biometricMatchCredentialType: 'BiometricMatch'
});
console.log(isBiometricPluginEnabled()); // true
```
<a name="module_biometric-provider..assertConfigs"></a>

### biometric-provider~assertConfigs()
<p>Asserts that biometric provider configurations are available</p>

**Kind**: inner method of [<code>biometric-provider</code>](#module_biometric-provider)  
**Throws**:

- <code>Error</code> <p>If biometric provider configs are not set</p>

**Example**  
```js
import { assertConfigs } from '@docknetwork/wallet-sdk-core/biometric-provider';

try {
  assertConfigs();
  console.log('Biometric configs are available');
} catch (error) {
  console.error('Biometric configs missing:', error.message);
}
```
<a name="module_biometric-provider..getBiometricConfigs"></a>

### biometric-provider~getBiometricConfigs() ⇒ <code>BiometricsProviderConfigs.&lt;unknown&gt;</code>
<p>Gets the current biometric provider configurations</p>

**Kind**: inner method of [<code>biometric-provider</code>](#module_biometric-provider)  
**Returns**: <code>BiometricsProviderConfigs.&lt;unknown&gt;</code> - <p>The current biometric provider configurations</p>  
**Throws**:

- <code>Error</code> <p>If biometric provider configs are not set</p>

**Example**  
```js
import { getBiometricConfigs } from '@docknetwork/wallet-sdk-core/biometric-provider';

try {
  const configs = getBiometricConfigs();
  console.log('Enrollment credential type:', configs.enrollmentCredentialType);
  console.log('Match credential type:', configs.biometricMatchCredentialType);
} catch (error) {
  console.error('Failed to get configs:', error.message);
}
```
<a name="module_biometric-provider..hasProofOfBiometrics"></a>

### biometric-provider~hasProofOfBiometrics(proofRequest) ⇒ <code>boolean</code>
<p>Checks if a proof request requires biometric credentials</p>

**Kind**: inner method of [<code>biometric-provider</code>](#module_biometric-provider)  
**Returns**: <code>boolean</code> - <p>True if the proof request requires biometric credentials</p>  

| Param | Type | Description |
| --- | --- | --- |
| proofRequest | <code>any</code> | <p>The proof request to analyze</p> |

**Example**  
```js
import { hasProofOfBiometrics } from '@docknetwork/wallet-sdk-core/biometric-provider';

const proofRequest = {
  input_descriptors: [{
    constraints: {
      fields: [{
        path: ['$.credentialSubject.biometric.id']
      }, {
        path: ['$.credentialSubject.biometric.created']
      }]
    }
  }]
};

if (hasProofOfBiometrics(proofRequest)) {
  console.log('This proof request requires biometric verification');
}
```
<a name="module_biometric-provider..createBiometricProvider"></a>

### biometric-provider~createBiometricProvider(params) ⇒ [<code>IBiometricProvider</code>](#IBiometricProvider)
<p>Creates a biometric provider instance for identity verification and biometric credential management</p>

**Kind**: inner method of [<code>biometric-provider</code>](#module_biometric-provider)  
**Returns**: [<code>IBiometricProvider</code>](#IBiometricProvider) - <p>A biometric provider instance with identity verification methods</p>  
**Throws**:

- <code>Error</code> <p>If wallet or idvProviderFactory is not provided</p>

**See**: [IBiometricProvider](#IBiometricProvider) - The interface defining all available biometric provider methods  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Provider configuration</p> |
| params.wallet | [<code>IWallet</code>](#IWallet) | <p>The wallet instance to use for credential storage</p> |
| params.idvProviderFactory | [<code>IDVProviderFactory</code>](#IDVProviderFactory) | <p>Factory for creating IDV provider instances</p> |

**Example**  
```js
import { createBiometricProvider } from '@docknetwork/wallet-sdk-core';

const biometricProvider = createBiometricProvider({
  wallet,
  idvProviderFactory: myIDVFactory
});

// Start identity verification process
const result = await biometricProvider.startIDV(proofRequest);
console.log('Enrollment credential:', result.enrollmentCredential);
console.log('Match credential:', result.matchCredential);

// Listen for IDV events
biometricProvider.eventEmitter.on('onComplete', (data) => {
  console.log('IDV process completed:', data);
});
```
<a name="module_cloud-wallet"></a>

## cloud-wallet
<p>Cloud wallet functionality for the Truvera Wallet SDK.
This module provides the main cloud wallet creation and management functions.</p>


* [cloud-wallet](#module_cloud-wallet)
    * [~deriveBiometricKey(biometricData, identifier)](#module_cloud-wallet..deriveBiometricKey) ⇒
    * [~deriveKeyMappingVaultKeys(biometricData, identifier)](#module_cloud-wallet..deriveKeyMappingVaultKeys) ⇒
    * [~deriveBiometricEncryptionKey(biometricData, identifier)](#module_cloud-wallet..deriveBiometricEncryptionKey) ⇒
    * [~encryptMasterKey(masterKey, encryptionKey, iv)](#module_cloud-wallet..encryptMasterKey) ⇒
    * [~decryptMasterKey(encryptedKey, decryptionKey, iv)](#module_cloud-wallet..decryptMasterKey) ⇒
    * [~initializeKeyMappingVault(edvUrl, authKey, biometricData, identifier)](#module_cloud-wallet..initializeKeyMappingVault) ⇒
    * [~enrollUserWithBiometrics(edvUrl, authKey, biometricData, identifier)](#module_cloud-wallet..enrollUserWithBiometrics) ⇒
    * [~getKeyMappingMasterKey(keyMappingEdv, identifier, decryptionKey, iv)](#module_cloud-wallet..getKeyMappingMasterKey) ⇒
    * [~authenticateWithBiometrics(edvUrl, authKey, biometricData, identifier)](#module_cloud-wallet..authenticateWithBiometrics) ⇒
    * [~initializeCloudWalletWithBiometrics(edvUrl, authKey, biometricData, identifier, dataStore)](#module_cloud-wallet..initializeCloudWalletWithBiometrics) ⇒
    * [~derivePasskeyVaultKeys(prfOutput, identifier)](#module_cloud-wallet..derivePasskeyVaultKeys) ⇒
    * [~derivePasskeyEncryptionKey(prfOutput, identifier)](#module_cloud-wallet..derivePasskeyEncryptionKey) ⇒
    * [~initializePasskeyKeyMappingVault(edvUrl, authKey, prfOutput, identifier)](#module_cloud-wallet..initializePasskeyKeyMappingVault) ⇒
    * [~enrollUserWithPasskey(edvUrl, authKey, prfOutput, identifier)](#module_cloud-wallet..enrollUserWithPasskey) ⇒
    * [~authenticateWithPasskey(edvUrl, authKey, prfOutput, identifier)](#module_cloud-wallet..authenticateWithPasskey) ⇒
    * [~initializeCloudWalletWithPasskey(edvUrl, authKey, prfOutput, identifier, dataStore)](#module_cloud-wallet..initializeCloudWalletWithPasskey) ⇒
    * [~initializeCloudWallet(params)](#module_cloud-wallet..initializeCloudWallet)

<a name="module_cloud-wallet..deriveBiometricKey"></a>

### cloud-wallet~deriveBiometricKey(biometricData, identifier) ⇒
<p>Derives a key from biometric data using HKDF</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Derived key</p>  

| Param | Description |
| --- | --- |
| biometricData | <p>Biometric data from provider</p> |
| identifier | <p>User's identifier as salt (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..deriveKeyMappingVaultKeys"></a>

### cloud-wallet~deriveKeyMappingVaultKeys(biometricData, identifier) ⇒
<p>Derives EDV keys from biometric data for the KeyMappingVault</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Keys for accessing the KeyMappingVault</p>  

| Param | Description |
| --- | --- |
| biometricData | <p>Biometric data from the provider</p> |
| identifier | <p>User's identifier as additional entropy (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..deriveBiometricEncryptionKey"></a>

### cloud-wallet~deriveBiometricEncryptionKey(biometricData, identifier) ⇒
<p>Generates a key for encrypting/decrypting the master key</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Encryption key and IV for AES encryption</p>  

| Param | Description |
| --- | --- |
| biometricData | <p>Biometric data from provider</p> |
| identifier | <p>User's identifier as salt (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..encryptMasterKey"></a>

### cloud-wallet~encryptMasterKey(masterKey, encryptionKey, iv) ⇒
<p>Encrypts the master key using a key derived from biometric data</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Encrypted master key</p>  

| Param | Description |
| --- | --- |
| masterKey | <p>The CloudWalletVault master key to encrypt</p> |
| encryptionKey | <p>Key derived from biometric data</p> |
| iv | <p>Initialization vector</p> |

<a name="module_cloud-wallet..decryptMasterKey"></a>

### cloud-wallet~decryptMasterKey(encryptedKey, decryptionKey, iv) ⇒
<p>Decrypts the master key using biometric-derived key</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>The decrypted master key</p>  

| Param | Description |
| --- | --- |
| encryptedKey | <p>The encrypted master key</p> |
| decryptionKey | <p>Key derived from biometric data</p> |
| iv | <p>Initialization vector</p> |

<a name="module_cloud-wallet..initializeKeyMappingVault"></a>

### cloud-wallet~initializeKeyMappingVault(edvUrl, authKey, biometricData, identifier) ⇒
<p>Initializes the KeyMappingVault using biometric data</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Initialized EDV service</p>  

| Param | Description |
| --- | --- |
| edvUrl | <p>URL for the edv</p> |
| authKey | <p>Auth key for the edv</p> |
| biometricData | <p>User's biometric data</p> |
| identifier | <p>User's identifier (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..enrollUserWithBiometrics"></a>

### cloud-wallet~enrollUserWithBiometrics(edvUrl, authKey, biometricData, identifier) ⇒
<p>Enrolls a user by creating necessary vaults and keys</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>The master key and mnemonic for backup</p>  

| Param | Description |
| --- | --- |
| edvUrl | <p>URL for the edv</p> |
| authKey | <p>Auth key for the edv</p> |
| biometricData | <p>Biometric data from provider</p> |
| identifier | <p>User's identifier (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..getKeyMappingMasterKey"></a>

### cloud-wallet~getKeyMappingMasterKey(keyMappingEdv, identifier, decryptionKey, iv) ⇒
<p>Gets the master key from the key mapping vault using provided decryption keys</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>The decrypted master key for CloudWalletVault</p>  

| Param | Description |
| --- | --- |
| keyMappingEdv | <p>Initialized key mapping vault service</p> |
| identifier | <p>User's identifier (email, phone number, etc.)</p> |
| decryptionKey | <p>Key for decrypting the master key</p> |
| iv | <p>Initialization vector for decryption</p> |

<a name="module_cloud-wallet..authenticateWithBiometrics"></a>

### cloud-wallet~authenticateWithBiometrics(edvUrl, authKey, biometricData, identifier) ⇒
<p>Authenticates a user with biometric data and identifier</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>The decrypted master key for CloudWalletVault</p>  

| Param | Description |
| --- | --- |
| edvUrl | <p>URL for the edv</p> |
| authKey | <p>Auth key for the edv</p> |
| biometricData | <p>Biometric data from the provider</p> |
| identifier | <p>User's identifier (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..initializeCloudWalletWithBiometrics"></a>

### cloud-wallet~initializeCloudWalletWithBiometrics(edvUrl, authKey, biometricData, identifier, dataStore) ⇒
<p>Initializes the Cloud Wallet using biometric authentication</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Initialized cloud wallet</p>  

| Param | Description |
| --- | --- |
| edvUrl | <p>Cloud wallet vault URL</p> |
| authKey | <p>Cloud wallet auth key</p> |
| biometricData | <p>User's biometric data</p> |
| identifier | <p>User's identifier (email, phone number, etc.)</p> |
| dataStore | <p>Optional data store for the wallet</p> |

<a name="module_cloud-wallet..derivePasskeyVaultKeys"></a>

### cloud-wallet~derivePasskeyVaultKeys(prfOutput, identifier) ⇒
<p>Derives EDV keys from passkey PRF output for the KeyMappingVault</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Keys for accessing the KeyMappingVault</p>  

| Param | Description |
| --- | --- |
| prfOutput | <p>32-byte PRF output from WebAuthn assertion</p> |
| identifier | <p>User's identifier as additional entropy (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..derivePasskeyEncryptionKey"></a>

### cloud-wallet~derivePasskeyEncryptionKey(prfOutput, identifier) ⇒
<p>Generates a key for encrypting/decrypting the master key from passkey PRF output</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Encryption key and IV for AES encryption</p>  

| Param | Description |
| --- | --- |
| prfOutput | <p>32-byte PRF output from WebAuthn assertion</p> |
| identifier | <p>User's identifier as salt (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..initializePasskeyKeyMappingVault"></a>

### cloud-wallet~initializePasskeyKeyMappingVault(edvUrl, authKey, prfOutput, identifier) ⇒
<p>Initializes the KeyMappingVault using passkey PRF output</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Initialized EDV service</p>  

| Param | Description |
| --- | --- |
| edvUrl | <p>URL for the edv</p> |
| authKey | <p>Auth key for the edv</p> |
| prfOutput | <p>32-byte PRF output from WebAuthn assertion</p> |
| identifier | <p>User's identifier (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..enrollUserWithPasskey"></a>

### cloud-wallet~enrollUserWithPasskey(edvUrl, authKey, prfOutput, identifier) ⇒
<p>Enrolls a user by creating a passkey-protected master key in the KeyMappingVault</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>The master key and mnemonic for backup</p>  

| Param | Description |
| --- | --- |
| edvUrl | <p>URL for the edv</p> |
| authKey | <p>Auth key for the edv</p> |
| prfOutput | <p>32-byte PRF output from WebAuthn assertion</p> |
| identifier | <p>User's identifier (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..authenticateWithPasskey"></a>

### cloud-wallet~authenticateWithPasskey(edvUrl, authKey, prfOutput, identifier) ⇒
<p>Authenticates a user with passkey PRF output and identifier</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>The decrypted master key for CloudWalletVault</p>  

| Param | Description |
| --- | --- |
| edvUrl | <p>URL for the edv</p> |
| authKey | <p>Auth key for the edv</p> |
| prfOutput | <p>32-byte PRF output from WebAuthn assertion</p> |
| identifier | <p>User's identifier (email, phone number, etc.)</p> |

<a name="module_cloud-wallet..initializeCloudWalletWithPasskey"></a>

### cloud-wallet~initializeCloudWalletWithPasskey(edvUrl, authKey, prfOutput, identifier, dataStore) ⇒
<p>Initializes the Cloud Wallet using passkey authentication</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  
**Returns**: <p>Initialized cloud wallet</p>  

| Param | Description |
| --- | --- |
| edvUrl | <p>Cloud wallet vault URL</p> |
| authKey | <p>Cloud wallet auth key</p> |
| prfOutput | <p>32-byte PRF output from WebAuthn assertion</p> |
| identifier | <p>User's identifier (email, phone number, etc.)</p> |
| dataStore | <p>Optional data store for the wallet</p> |

<a name="module_cloud-wallet..initializeCloudWallet"></a>

### cloud-wallet~initializeCloudWallet(params)
<p>Initialize the cloud wallet EDV service.</p>
<p>Either <code>masterKey</code> or <code>mnemonic</code> must be provided. When both are supplied,
<code>masterKey</code> takes precedence since it is the derived key ready for use.</p>

**Kind**: inner method of [<code>cloud-wallet</code>](#module_cloud-wallet)  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> |  |
| [params.dataStore] | <code>DataStore</code> | <p>Optional data store</p> |
| params.edvUrl | <code>string</code> | <p>EDV service URL</p> |
| params.authKey | <code>string</code> | <p>Authentication key</p> |
| [params.masterKey] | <code>Uint8Array</code> | <p>Pre-derived master key (takes precedence over mnemonic)</p> |
| [params.mnemonic] | <code>string</code> | <p>BIP-39 mnemonic used to derive the master key</p> |

<a name="module_credential-provider"></a>

## credential-provider
<p>Verifiable credential management functionality for the Truvera Wallet SDK.
This module provides functions for importing, verifying, storing, and managing verifiable credentials.</p>


* [credential-provider](#module_credential-provider)
    * [~isValid(credential)](#module_credential-provider..isValid) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [~createCredentialProvider(params)](#module_credential-provider..createCredentialProvider) ⇒ [<code>ICredentialProvider</code>](#ICredentialProvider)

<a name="module_credential-provider..isValid"></a>

### credential-provider~isValid(credential) ⇒ <code>Promise.&lt;Object&gt;</code>
<p>Uses Dock SDK to verify a credential</p>

**Kind**: inner method of [<code>credential-provider</code>](#module_credential-provider)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - <p>Verification result with status and optional error/warning messages</p>  

| Param |
| --- |
| credential | 

<a name="module_credential-provider..createCredentialProvider"></a>

### credential-provider~createCredentialProvider(params) ⇒ [<code>ICredentialProvider</code>](#ICredentialProvider)
<p>Creates a credential provider instance bound to a wallet</p>

**Kind**: inner method of [<code>credential-provider</code>](#module_credential-provider)  
**Returns**: [<code>ICredentialProvider</code>](#ICredentialProvider) - <p>A credential provider instance with all verifiable credential management methods</p>  
**See**: [ICredentialProvider](#ICredentialProvider) - The interface defining all available credential provider methods  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Provider configuration</p> |
| params.wallet | [<code>IWallet</code>](#IWallet) | <p>The wallet instance to use for credential storage</p> |

**Example**  
```js
import { createCredentialProvider } from '@docknetwork/wallet-sdk-core';

const credentialProvider = createCredentialProvider({wallet});

// Add a credential
const addedCredential = await credentialProvider.addCredential(myCredential);

// Validate a credential
const result = await credentialProvider.isValid(credential);
if (result.status === 'verified') {
  console.log('Credential is valid');
}

// Get all credentials
const allCredentials = credentialProvider.getCredentials();

// Import from URI
await credentialProvider.importCredentialFromURI({
  uri: 'https://example.com/credential-offer',
  didProvider
});
```
<a name="module_did-provider"></a>

## did-provider
<p>DID (Decentralized Identifier) management functionality for the Truvera Wallet SDK.
This module provides functions for creating, importing, exporting, and managing DIDs.</p>

<a name="module_did-provider..createDIDProvider"></a>

### did-provider~createDIDProvider(params) ⇒ [<code>IDIDProvider</code>](#IDIDProvider)
<p>Creates a DID provider instance bound to a wallet</p>

**Kind**: inner method of [<code>did-provider</code>](#module_did-provider)  
**Returns**: [<code>IDIDProvider</code>](#IDIDProvider) - <p>A DID provider instance with all DID management methods</p>  
**See**: [IDIDProvider](#IDIDProvider) - The interface defining all available DID provider methods  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Provider configuration</p> |
| params.wallet | [<code>IWallet</code>](#IWallet) | <p>The wallet instance to bind the provider to</p> |

**Example**  
```js
import { createDIDProvider } from '@docknetwork/wallet-sdk-core';

const didProvider = createDIDProvider({wallet});

// Create a new DID
const {keyDoc, didDocumentResolution} = await didProvider.createDIDKey({
  name: 'My DID'
});

// Get all DIDs
const allDIDs = await didProvider.getAll();

// Export a DID
const exportedDID = await didProvider.exportDID({
  id: didDocumentResolution.id,
  password: 'mypassword'
});
```
<a name="module_message-provider"></a>

## message-provider
<p>DIDComm message management functionality for the Truvera Wallet SDK.
This module provides functions for sending, receiving, and processing DIDComm messages.</p>

<a name="module_message-provider..createMessageProvider"></a>

### message-provider~createMessageProvider(params) ⇒ [<code>IMessageProvider</code>](#IMessageProvider)
<p>Creates a message provider instance bound to a wallet and DID provider</p>

**Kind**: inner method of [<code>message-provider</code>](#module_message-provider)  
**Returns**: [<code>IMessageProvider</code>](#IMessageProvider) - <p>A message provider instance with all DIDComm message management methods</p>  
**See**: [IMessageProvider](#IMessageProvider) - The interface defining all available message provider methods  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Provider configuration</p> |
| params.wallet | [<code>IWallet</code>](#IWallet) | <p>The wallet instance to use for message storage</p> |
| params.didProvider | [<code>IDIDProvider</code>](#IDIDProvider) | <p>The DID provider instance to use for key management</p> |
| [params.relayService] | <code>any</code> | <p>Optional relay service implementation (defaults to built-in service)</p> |

**Example**  
```js
import { createMessageProvider } from '@docknetwork/wallet-sdk-core';

const messageProvider = createMessageProvider({
  wallet,
  didProvider
});

// Send a message
await messageProvider.sendMessage({
  did: 'did:key:sender123',
  recipientDid: 'did:key:recipient456',
  message: { hello: 'world' }
});

// Start auto-fetching messages
const stopAutoFetch = messageProvider.startAutoFetch(5000);

// Add message listener
const removeListener = messageProvider.addMessageListener((message) => {
  console.log('Received message:', message);
});
```
<a name="module_wallet"></a>

## wallet
<p>Core wallet functionality for the Dock Wallet SDK.
This module provides the main wallet creation and management functions.</p>

<a name="module_wallet..createWallet"></a>

### wallet~createWallet(props) ⇒ [<code>Promise.&lt;IWallet&gt;</code>](#IWallet)
<p>Creates a new wallet instance with the provided data store.
The wallet provides secure storage and management of DIDs, credentials, keys, and other documents.</p>

**Kind**: inner method of [<code>wallet</code>](#module_wallet)  
**Returns**: [<code>Promise.&lt;IWallet&gt;</code>](#IWallet) - <p>A promise that resolves to the created wallet instance</p>  
**Throws**:

- <code>Error</code> <p>If the data store is not properly initialized</p>

**See**: [IWallet](#IWallet) - The interface defining all available wallet methods  

| Param | Type | Description |
| --- | --- | --- |
| props | <code>CreateWalletProps</code> | <p>Configuration options for wallet creation</p> |
| props.dataStore | <code>DataStore</code> | <p>The data store implementation to use for persistence</p> |

**Example**  
```js
import { createWallet } from '@docknetwork/wallet-sdk-core';
import { createDataStore } from '@docknetwork/wallet-sdk-data-store';

const dataStore = await createDataStore();
const wallet = await createWallet({ dataStore });

// The wallet implements the IWallet interface
await wallet.addDocument(myCredential);
const documents = await wallet.getAllDocuments();
```
<a name="IDIDProvider"></a>

## IDIDProvider
<p>Provides a high-level API for DID management operations</p>

**Kind**: global interface  

* [IDIDProvider](#IDIDProvider)
    * [.importDID(params)](#IDIDProvider.importDID) ⇒ <code>Promise.&lt;Array.&lt;any&gt;&gt;</code>
    * [.createDIDKey(params)](#IDIDProvider.createDIDKey) ⇒ <code>Promise.&lt;{keyDoc: any, didDocumentResolution: any}&gt;</code>
    * [.editDID(params)](#IDIDProvider.editDID) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.deleteDID(params)](#IDIDProvider.deleteDID) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.exportDID(params)](#IDIDProvider.exportDID) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.getAll()](#IDIDProvider.getAll) ⇒ <code>Promise.&lt;Array.&lt;any&gt;&gt;</code>
    * [.getDIDKeyPairs()](#IDIDProvider.getDIDKeyPairs) ⇒ <code>Promise.&lt;Array.&lt;any&gt;&gt;</code>
    * [.ensureDID()](#IDIDProvider.ensureDID) ⇒ <code>Promise.&lt;({keyDoc: any, didDocumentResolution: any}\|void)&gt;</code>
    * [.getDefaultDID()](#IDIDProvider.getDefaultDID) ⇒ <code>Promise.&lt;(string\|undefined)&gt;</code>
    * [.createSigningKey(params)](#IDIDProvider.createSigningKey) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.signWithKeyId(params)](#IDIDProvider.signWithKeyId) ⇒ <code>Promise.&lt;Uint8Array&gt;</code>

<a name="IDIDProvider.importDID"></a>

### IDIDProvider.importDID(params) ⇒ <code>Promise.&lt;Array.&lt;any&gt;&gt;</code>
<p>Imports a DID from an encrypted wallet JSON</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Returns**: <code>Promise.&lt;Array.&lt;any&gt;&gt;</code> - <p>Array of imported documents</p>  
**Throws**:

- <code>Error</code> <p>If password is incorrect or DID already exists in wallet</p>


| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Import parameters</p> |
| params.encryptedJSONWallet | <code>any</code> | <p>The encrypted wallet JSON containing the DID</p> |
| params.password | <code>string</code> | <p>Password to decrypt the wallet</p> |

**Example**  
```js
const importedDocs = await didProvider.importDID({
  encryptedJSONWallet: encryptedBackup,
  password: 'mypassword'
});
```
<a name="IDIDProvider.createDIDKey"></a>

### IDIDProvider.createDIDKey(params) ⇒ <code>Promise.&lt;{keyDoc: any, didDocumentResolution: any}&gt;</code>
<p>Creates a new DID:key with an associated keypair</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Returns**: <code>Promise.&lt;{keyDoc: any, didDocumentResolution: any}&gt;</code> - <p>The created keypair and DID document</p>  
**Throws**:

- <code>Error</code> <p>If name is not provided</p>


| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Creation parameters</p> |
| params.name | <code>string</code> | <p>The name for the new DID</p> |
| [params.derivePath] | <code>string</code> | <p>Optional derivation path for the keypair</p> |
| [params.type] | <code>string</code> | <p>Optional key type specification</p> |

**Example**  
```js
const {keyDoc, didDocumentResolution} = await didProvider.createDIDKey({
  name: 'My Identity DID',
  derivePath: "m/44'/60'/0'/0/0"
});
```
<a name="IDIDProvider.editDID"></a>

### IDIDProvider.editDID(params) ⇒ <code>Promise.&lt;void&gt;</code>
<p>Edits a DID document's name</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Throws**:

- <code>Error</code> <p>If document ID is not set or document not found</p>


| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Edit parameters</p> |
| params.id | <code>string</code> | <p>The ID of the DID document to edit</p> |
| params.name | <code>string</code> | <p>The new name for the DID</p> |

**Example**  
```js
await didProvider.editDID({
  id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
  name: 'Updated DID Name'
});
```
<a name="IDIDProvider.deleteDID"></a>

### IDIDProvider.deleteDID(params) ⇒ <code>Promise.&lt;void&gt;</code>
<p>Deletes a DID from the wallet</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Throws**:

- <code>Error</code> <p>If document ID is not set</p>


| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Delete parameters</p> |
| params.id | <code>string</code> | <p>The ID of the DID document to delete</p> |

**Example**  
```js
await didProvider.deleteDID({
  id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
});
```
<a name="IDIDProvider.exportDID"></a>

### IDIDProvider.exportDID(params) ⇒ <code>Promise.&lt;any&gt;</code>
<p>Exports a DID and its correlated documents as an encrypted JSON</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>Encrypted wallet JSON containing the DID and correlations</p>  
**Throws**:

- <code>Error</code> <p>If DID document or keypair not found</p>


| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Export parameters</p> |
| params.id | <code>string</code> | <p>The ID of the DID document to export</p> |
| params.password | <code>string</code> | <p>Password for encryption</p> |

**Example**  
```js
const exportedDID = await didProvider.exportDID({
  id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
  password: 'mypassword'
});
```
<a name="IDIDProvider.getAll"></a>

### IDIDProvider.getAll() ⇒ <code>Promise.&lt;Array.&lt;any&gt;&gt;</code>
<p>Retrieves all DIDs stored in the wallet</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Returns**: <code>Promise.&lt;Array.&lt;any&gt;&gt;</code> - <p>Array of DID resolution response documents</p>  
**Example**  
```js
const allDIDs = await didProvider.getAll();
console.log(`Found ${allDIDs.length} DIDs in wallet`);
```
<a name="IDIDProvider.getDIDKeyPairs"></a>

### IDIDProvider.getDIDKeyPairs() ⇒ <code>Promise.&lt;Array.&lt;any&gt;&gt;</code>
<p>Retrieves all keypairs associated with DIDs in the wallet</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Returns**: <code>Promise.&lt;Array.&lt;any&gt;&gt;</code> - <p>Array of keypair documents</p>  
**Example**  
```js
const keyPairs = await didProvider.getDIDKeyPairs();
console.log(`Found ${keyPairs.length} DID keypairs`);
```
<a name="IDIDProvider.ensureDID"></a>

### IDIDProvider.ensureDID() ⇒ <code>Promise.&lt;({keyDoc: any, didDocumentResolution: any}\|void)&gt;</code>
<p>Ensures at least one DID exists in the wallet, creating a default if none exist</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Returns**: <code>Promise.&lt;({keyDoc: any, didDocumentResolution: any}\|void)&gt;</code> - <p>The created DID if one was created, undefined otherwise</p>  
**Example**  
```js
// Ensure wallet has at least one DID
await didProvider.ensureDID();
```
<a name="IDIDProvider.getDefaultDID"></a>

### IDIDProvider.getDefaultDID() ⇒ <code>Promise.&lt;(string\|undefined)&gt;</code>
<p>Gets the default DID from the wallet (first DID if exists)</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Returns**: <code>Promise.&lt;(string\|undefined)&gt;</code> - <p>The default DID identifier or undefined if no DIDs exist</p>  
**Example**  
```js
const defaultDID = await didProvider.getDefaultDID();
if (defaultDID) {
  console.log(`Default DID: ${defaultDID}`);
}
```
<a name="IDIDProvider.createSigningKey"></a>

### IDIDProvider.createSigningKey(params) ⇒ <code>Promise.&lt;any&gt;</code>
<p>Creates and stores a bare signing key document attached to an
existing DID, without minting a new did:key document.</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>The stored key document</p>  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Creation parameters</p> |
| params.controller | <code>string</code> | <p>The DID this key is attached to</p> |
| [params.name] | <code>string</code> | <p>Optional label for the stored document</p> |
| [params.type] | <code>string</code> | <p>Key type to generate (default 'secp256r1')</p> |

**Example**  
```js
const keyDoc = await didProvider.createSigningKey({
  controller: 'did:key:z6Mk...',
});
```
<a name="IDIDProvider.signWithKeyId"></a>

### IDIDProvider.signWithKeyId(params) ⇒ <code>Promise.&lt;Uint8Array&gt;</code>
<p>Signs arbitrary bytes with a previously-stored signing key document
and returns the raw signature bytes.</p>

**Kind**: static method of [<code>IDIDProvider</code>](#IDIDProvider)  
**Returns**: <code>Promise.&lt;Uint8Array&gt;</code> - <p>The raw signature bytes</p>  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Signing parameters</p> |
| params.keyId | <code>string</code> | <p>The id of the stored key document</p> |
| params.data | <code>Uint8Array</code> | <p>The bytes to sign</p> |

**Example**  
```js
const signature = await didProvider.signWithKeyId({
  keyId: keyDoc.id,
  data: signingInputBytes,
});
```
<a name="IMessageProvider"></a>

## IMessageProvider
<p>Provides a high-level API for DIDComm message management operations</p>

**Kind**: global interface  

* [IMessageProvider](#IMessageProvider)
    * [.fetchMessages](#IMessageProvider.fetchMessages) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.addMessageListener](#IMessageProvider.addMessageListener) ⇒ <code>function</code>
    * [.processDIDCommMessages](#IMessageProvider.processDIDCommMessages) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.processMessageRecurrentJob](#IMessageProvider.processMessageRecurrentJob) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.markMessageAsRead](#IMessageProvider.markMessageAsRead) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.sendMessage(params)](#IMessageProvider.sendMessage) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.waitForMessage()](#IMessageProvider.waitForMessage) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.startAutoFetch([timeout])](#IMessageProvider.startAutoFetch) ⇒ <code>function</code>
    * [.clearCache()](#IMessageProvider.clearCache) ⇒ <code>Promise.&lt;void&gt;</code>

<a name="IMessageProvider.fetchMessages"></a>

### IMessageProvider.fetchMessages ⇒ <code>Promise.&lt;void&gt;</code>
<p>Fetches new messages from the relay service</p>

**Kind**: static property of [<code>IMessageProvider</code>](#IMessageProvider)  
**Throws**:

- <code>Error</code> <p>If message fetching fails</p>

**Example**  
```js
await messageProvider.fetchMessages();
console.log('Messages fetched successfully');
```
<a name="IMessageProvider.addMessageListener"></a>

### IMessageProvider.addMessageListener ⇒ <code>function</code>
<p>Adds a listener for when messages are decrypted</p>

**Kind**: static property of [<code>IMessageProvider</code>](#IMessageProvider)  
**Returns**: <code>function</code> - <p>Function to remove the listener</p>  

| Param | Type | Description |
| --- | --- | --- |
| handler | <code>function</code> | <p>Callback function to handle decrypted messages</p> |

**Example**  
```js
const removeListener = messageProvider.addMessageListener((message) => {
  console.log('New message received:', message);
});
// Later, remove the listener
removeListener();
```
<a name="IMessageProvider.processDIDCommMessages"></a>

### IMessageProvider.processDIDCommMessages ⇒ <code>Promise.&lt;void&gt;</code>
<p>Processes stored DIDComm messages and decrypts them</p>

**Kind**: static property of [<code>IMessageProvider</code>](#IMessageProvider)  
**Throws**:

- <code>Error</code> <p>If message processing fails</p>

**Example**  
```js
await messageProvider.processDIDCommMessages();
console.log('Messages processed successfully');
```
<a name="IMessageProvider.processMessageRecurrentJob"></a>

### IMessageProvider.processMessageRecurrentJob ⇒ <code>Promise.&lt;void&gt;</code>
<p>Starts the recurrent message processing job</p>

**Kind**: static property of [<code>IMessageProvider</code>](#IMessageProvider)  
**Example**  
```js
await messageProvider.processMessageRecurrentJob();
```
<a name="IMessageProvider.markMessageAsRead"></a>

### IMessageProvider.markMessageAsRead ⇒ <code>Promise.&lt;void&gt;</code>
<p>Marks a message as read and removes it from storage</p>

**Kind**: static property of [<code>IMessageProvider</code>](#IMessageProvider)  
**Throws**:

- <code>Error</code> <p>If message is not found or not a DIDComm message</p>


| Param | Type | Description |
| --- | --- | --- |
| messageId | <code>string</code> | <p>The ID of the message to mark as read</p> |

**Example**  
```js
await messageProvider.markMessageAsRead('message-id-123');
console.log('Message marked as read');
```
<a name="IMessageProvider.sendMessage"></a>

### IMessageProvider.sendMessage(params) ⇒ <code>Promise.&lt;any&gt;</code>
<p>Sends a DIDComm message to a recipient</p>

**Kind**: static method of [<code>IMessageProvider</code>](#IMessageProvider)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>Result of sending the message</p>  
**Throws**:

- <code>Error</code> <p>If sender DID not found or message sending fails</p>


| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Message parameters</p> |
| [params.from] | <code>string</code> | <p>Sender DID identifier</p> |
| [params.to] | <code>string</code> | <p>Recipient DID identifier</p> |
| [params.message] | <code>any</code> | <p>Message payload to send</p> |
| [params.type] | <code>string</code> | <p>DIDComm message type</p> |
| [params.did] | <code>string</code> | <p>@deprecated Use 'from' instead - Sender DID identifier</p> |
| [params.recipientDid] | <code>string</code> | <p>@deprecated Use 'to' instead - Recipient DID identifier</p> |
| [params.body] | <code>any</code> | <p>@deprecated Use 'message' instead - Message payload to send</p> |

**Example**  
```js
await messageProvider.sendMessage({
  from: 'did:key:sender123',
  to: 'did:key:recipient456',
  message: { hello: 'world' },
  type: 'basic-message'
});
```
<a name="IMessageProvider.waitForMessage"></a>

### IMessageProvider.waitForMessage() ⇒ <code>Promise.&lt;any&gt;</code>
<p>Waits for the next incoming message</p>

**Kind**: static method of [<code>IMessageProvider</code>](#IMessageProvider)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>Promise that resolves with the next received message</p>  
**Example**  
```js
const nextMessage = await messageProvider.waitForMessage();
console.log('Received message:', nextMessage);
```
<a name="IMessageProvider.startAutoFetch"></a>

### IMessageProvider.startAutoFetch([timeout]) ⇒ <code>function</code>
<p>Starts automatic message fetching at regular intervals</p>

**Kind**: static method of [<code>IMessageProvider</code>](#IMessageProvider)  
**Returns**: <code>function</code> - <p>Function to stop the auto-fetch process</p>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [timeout] | <code>number</code> | <code>2000</code> | <p>Interval in milliseconds between fetch operations</p> |

**Example**  
```js
const stopAutoFetch = messageProvider.startAutoFetch(5000);
// Later, stop auto-fetching
stopAutoFetch();
```
<a name="IMessageProvider.clearCache"></a>

### IMessageProvider.clearCache() ⇒ <code>Promise.&lt;void&gt;</code>
<p>Clears all cached messages from the wallet</p>

**Kind**: static method of [<code>IMessageProvider</code>](#IMessageProvider)  
**Example**  
```js
await messageProvider.clearCache();
console.log('All messages cleared');
```
<a name="ICredentialProvider"></a>

## ICredentialProvider
<p>Provides a high-level API for verifiable credential management operations</p>

**Kind**: global interface  

* [ICredentialProvider](#ICredentialProvider)
    * [.getCredentials](#ICredentialProvider.getCredentials) ⇒ <code>Array.&lt;any&gt;</code>
    * [.isBBSPlusCredential](#ICredentialProvider.isBBSPlusCredential) ⇒ <code>boolean</code>
    * [.importCredentialFromURI(params)](#ICredentialProvider.importCredentialFromURI) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.getMembershipWitness(credentialId)](#ICredentialProvider.getMembershipWitness) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.getById(id)](#ICredentialProvider.getById) ⇒ <code>any</code>
    * [.isValid(credential, [forceFetch])](#ICredentialProvider.isValid) ⇒ <code>Promise.&lt;Object&gt;</code> \| <code>string</code> \| <code>string</code> \| <code>string</code>
    * [.getCredentialStatus(credential)](#ICredentialProvider.getCredentialStatus) ⇒ <code>Promise.&lt;Object&gt;</code> \| <code>string</code> \| <code>string</code>
    * [.syncCredentialStatus(params)](#ICredentialProvider.syncCredentialStatus) ⇒ <code>Promise.&lt;Array.&lt;any&gt;&gt;</code>
    * [.addCredential(credential)](#ICredentialProvider.addCredential) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.removeCredential(credential)](#ICredentialProvider.removeCredential) ⇒ <code>Promise.&lt;void&gt;</code>

<a name="ICredentialProvider.getCredentials"></a>

### ICredentialProvider.getCredentials ⇒ <code>Array.&lt;any&gt;</code>
<p>Retrieves credentials from the wallet, optionally filtered by type</p>

**Kind**: static property of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Returns**: <code>Array.&lt;any&gt;</code> - <p>Array of credentials matching the specified type</p>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [type] | <code>string</code> | <code>&quot;&#x27;VerifiableCredential&#x27;&quot;</code> | <p>The credential type to filter by</p> |

**Example**  
```js
const allCredentials = credentialProvider.getCredentials();
const certificates = credentialProvider.getCredentials('Certificate');
```
<a name="ICredentialProvider.isBBSPlusCredential"></a>

### ICredentialProvider.isBBSPlusCredential ⇒ <code>boolean</code>
<p>Checks if a credential uses BBS+ signature</p>

**Kind**: static property of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Returns**: <code>boolean</code> - <p>True if the credential uses BBS+ signature</p>  

| Param | Type | Description |
| --- | --- | --- |
| credential | <code>any</code> | <p>The credential to check</p> |

**Example**  
```js
const isBBS = credentialProvider.isBBSPlusCredential(credential);
if (isBBS) {
  console.log('This credential uses BBS+ signatures');
}
```
<a name="ICredentialProvider.importCredentialFromURI"></a>

### ICredentialProvider.importCredentialFromURI(params) ⇒ <code>Promise.&lt;any&gt;</code>
<p>Imports a credential from a URI (supports OpenID credential offers)</p>

**Kind**: static method of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>The imported credential</p>  
**Throws**:

- <code>Error</code> <p>If import fails</p>


| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Import parameters</p> |
| params.uri | <code>string</code> | <p>The URI containing the credential offer</p> |
| params.didProvider | <code>any</code> | <p>DID provider instance for key management</p> |
| [params.getAuthCode] | <code>function</code> | <p>Optional callback to handle authorization</p> |

**Example**  
```js
const credential = await credentialProvider.importCredentialFromURI({
  uri: 'https://issuer.example.com/credential-offer',
  didProvider,
  getAuthCode: async (url) => getUserAuthCode(url)
});
```
<a name="ICredentialProvider.getMembershipWitness"></a>

### ICredentialProvider.getMembershipWitness(credentialId) ⇒ <code>Promise.&lt;any&gt;</code>
<p>Gets the membership witness for a credential (used for BBS+ credentials)</p>

**Kind**: static method of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>The membership witness data</p>  

| Param | Type | Description |
| --- | --- | --- |
| credentialId | <code>string</code> | <p>The credential ID to get the witness for</p> |

**Example**  
```js
const witness = await credentialProvider.getMembershipWitness('credential-123');
```
<a name="ICredentialProvider.getById"></a>

### ICredentialProvider.getById(id) ⇒ <code>any</code>
<p>Retrieves a credential by its ID</p>

**Kind**: static method of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Returns**: <code>any</code> - <p>The credential document</p>  
**Throws**:

- <code>Error</code> <p>If credential is not found</p>


| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | <p>The unique identifier of the credential</p> |

**Example**  
```js
const credential = await credentialProvider.getById('credential-123');
```
<a name="ICredentialProvider.isValid"></a>

### ICredentialProvider.isValid(credential, [forceFetch]) ⇒ <code>Promise.&lt;Object&gt;</code> \| <code>string</code> \| <code>string</code> \| <code>string</code>
<p>Validates a credential by verifying its cryptographic proof and status</p>

**Kind**: static method of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - <p>Validation result</p><code>string</code> - <p>returns.status - Validation status (verified, revoked, expired, invalid, pending)</p><code>string</code> - <p>[returns.error] - Error message if validation failed</p><code>string</code> - <p>[returns.warning] - Warning message if any</p>  
**Throws**:

- <code>Error</code> <p>If validation fails</p>


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| credential | <code>any</code> |  | <p>The credential to validate</p> |
| [forceFetch] | <code>boolean</code> | <code>false</code> | <p>Whether to force refresh the credential status</p> |

**Example**  
```js
const result = await credentialProvider.isValid(credential);
if (result.status === 'verified') {
  console.log('Credential is valid');
} else if (result.status === 'revoked') {
  console.log('Credential has been revoked');
}
```
<a name="ICredentialProvider.getCredentialStatus"></a>

### ICredentialProvider.getCredentialStatus(credential) ⇒ <code>Promise.&lt;Object&gt;</code> \| <code>string</code> \| <code>string</code>
<p>Gets the current status of a credential (cached, fast operation)</p>

**Kind**: static method of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - <p>Current credential status</p><code>string</code> - <p>returns.status - Current status of the credential</p><code>string</code> - <p>[returns.error] - Error message if any</p>  

| Param | Type | Description |
| --- | --- | --- |
| credential | <code>any</code> | <p>The credential to check</p> |

**Example**  
```js
const status = await credentialProvider.getCredentialStatus(credential);
console.log(`Credential status: ${status.status}`);
```
<a name="ICredentialProvider.syncCredentialStatus"></a>

### ICredentialProvider.syncCredentialStatus(params) ⇒ <code>Promise.&lt;Array.&lt;any&gt;&gt;</code>
<p>Synchronizes credential status from the blockchain</p>

**Kind**: static method of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Returns**: <code>Promise.&lt;Array.&lt;any&gt;&gt;</code> - <p>Array of credential status documents</p>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| params | <code>Object</code> |  | <p>Sync parameters</p> |
| [params.credentialIds] | <code>Array.&lt;string&gt;</code> |  | <p>Optional list of credential IDs to sync</p> |
| [params.forceFetch] | <code>boolean</code> | <code>false</code> | <p>Whether to force refresh from blockchain</p> |

**Example**  
```js
// Sync all credentials
await credentialProvider.syncCredentialStatus({});

// Sync specific credentials
await credentialProvider.syncCredentialStatus({
  credentialIds: ['cred-1', 'cred-2'],
  forceFetch: true
});
```
<a name="ICredentialProvider.addCredential"></a>

### ICredentialProvider.addCredential(credential) ⇒ <code>Promise.&lt;any&gt;</code>
<p>Adds a credential to the wallet</p>

**Kind**: static method of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>The added credential document</p>  

| Param | Type | Description |
| --- | --- | --- |
| credential | <code>any</code> | <p>The credential to add</p> |

**Example**  
```js
const addedCredential = await credentialProvider.addCredential({
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential'],
  issuer: 'did:dock:issuer123',
  credentialSubject: { name: 'Alice' }
});
```
<a name="ICredentialProvider.removeCredential"></a>

### ICredentialProvider.removeCredential(credential) ⇒ <code>Promise.&lt;void&gt;</code>
<p>Removes a credential and all its related documents from the wallet</p>

**Kind**: static method of [<code>ICredentialProvider</code>](#ICredentialProvider)  
**Throws**:

- <code>Error</code> <p>If credential is not found</p>


| Param | Type | Description |
| --- | --- | --- |
| credential | <code>any</code> | <p>The credential to remove</p> |

**Example**  
```js
await credentialProvider.removeCredential(credential);
// Or by ID
await credentialProvider.removeCredential('credential-123');
```
<a name="IDVProcessOptions"></a>

## IDVProcessOptions
<p>Callback functions for handling different stages of the identity verification process</p>

**Kind**: global interface  
<a name="BiometricPlugin"></a>

## BiometricPlugin
<p>Defines the contract for biometric enrollment and matching operations</p>

**Kind**: global interface  
<a name="IDVProvider"></a>

## IDVProvider
<p>Defines the contract for identity verification operations</p>

**Kind**: global interface  
<a name="IDVProviderFactory"></a>

## IDVProviderFactory
<p>Creates IDV provider instances with proper event handling and wallet integration</p>

**Kind**: global interface  
<a name="IBiometricProvider"></a>

## IBiometricProvider
<p>Provides a high-level API for biometric identity verification operations</p>

**Kind**: global interface  

* [IBiometricProvider](#IBiometricProvider)
    * [.startIDV](#IBiometricProvider.startIDV)
    * [.eventEmitter](#IBiometricProvider.eventEmitter)
    * [.startIDV(proofRequest)](#IBiometricProvider.startIDV) ⇒ <code>Promise.&lt;{enrollmentCredential: Credential, matchCredential: Credential}&gt;</code>

<a name="IBiometricProvider.startIDV"></a>

### IBiometricProvider.startIDV
<p>Starts the identity verification process using biometric credentials</p>

**Kind**: static property of [<code>IBiometricProvider</code>](#IBiometricProvider)  
<a name="IBiometricProvider.eventEmitter"></a>

### IBiometricProvider.eventEmitter
<p>Event emitter for IDV process events (onDeepLink, onMessage, onError, onCancel, onComplete)</p>

**Kind**: static property of [<code>IBiometricProvider</code>](#IBiometricProvider)  
<a name="IBiometricProvider.startIDV"></a>

### IBiometricProvider.startIDV(proofRequest) ⇒ <code>Promise.&lt;{enrollmentCredential: Credential, matchCredential: Credential}&gt;</code>
<p>Starts the identity verification process using biometric credentials</p>

**Kind**: static method of [<code>IBiometricProvider</code>](#IBiometricProvider)  
**Returns**: <code>Promise.&lt;{enrollmentCredential: Credential, matchCredential: Credential}&gt;</code> - <p>The enrollment and match credentials</p>  
**Throws**:

- <code>Error</code> <p>If IDV process fails or biometric configs are missing</p>


| Param | Type | Description |
| --- | --- | --- |
| proofRequest | <code>any</code> | <p>The proof request containing biometric requirements</p> |

**Example**  
```js
const result = await biometricProvider.startIDV({
  input_descriptors: [{
    constraints: {
      fields: [{
        path: ['$.credentialSubject.biometric.id'],
        purpose: 'Biometric ID verification'
      }]
    }
  }]
});
```
<a name="IV1Wallet"></a>

## ~~IV1Wallet~~
***This interface is obsolete and should not be used for new implementations. Use IWallet instead.***

<p>Legacy V1 wallet interface for backward compatibility</p>

**Kind**: global interface  
<a name="IWallet"></a>

## IWallet ⇐ [<code>IV1Wallet</code>](#IV1Wallet)
<p>Main wallet interface providing methods for document management, import/export, and network operations.</p>

**Kind**: global interface  
**Extends**: [<code>IV1Wallet</code>](#IV1Wallet)  

* [IWallet](#IWallet) ⇐ [<code>IV1Wallet</code>](#IV1Wallet)
    * [.deleteWallet()](#IWallet.deleteWallet) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.setStatus(newStatus)](#IWallet.setStatus)
    * [.setNetwork(networkId)](#IWallet.setNetwork) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.getNetworkId()](#IWallet.getNetworkId) ⇒ <code>string</code>
    * [.getDocumentById(id)](#IWallet.getDocumentById) ⇒ <code>Promise.&lt;WalletDocument&gt;</code>
    * [.getAllDocuments()](#IWallet.getAllDocuments) ⇒ <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code>
    * [.getDocumentsById(idList)](#IWallet.getDocumentsById) ⇒ <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code>
    * [.getDocumentsByType(type)](#IWallet.getDocumentsByType) ⇒ <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code>
    * [.addDocument(json, [options])](#IWallet.addDocument) ⇒ <code>Promise.&lt;WalletDocument&gt;</code>
    * [.updateDocument(document, [options])](#IWallet.updateDocument) ⇒ <code>Promise.&lt;WalletDocument&gt;</code>
    * [.removeDocument(id, [options])](#IWallet.removeDocument) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.getDocumentCorrelations(documentId)](#IWallet.getDocumentCorrelations) ⇒ <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code>
    * [.getAccountKeyPair(accountId)](#IWallet.getAccountKeyPair) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.getDocumentsFromEncryptedWallet(json, password)](#IWallet.getDocumentsFromEncryptedWallet) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.importUniversalWalletJSON(json, password)](#IWallet.importUniversalWalletJSON) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.exportDocuments(params)](#IWallet.exportDocuments) ⇒ <code>Promise.&lt;any&gt;</code>
    * [.exportUniversalWalletJSON(password)](#IWallet.exportUniversalWalletJSON) ⇒ <code>any</code>

<a name="IWallet.deleteWallet"></a>

### IWallet.deleteWallet() ⇒ <code>Promise.&lt;void&gt;</code>
<p>Deletes the entire wallet and all its documents</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Emits**: <code>WalletEvents.event:walletDeleted</code>  
<a name="IWallet.setStatus"></a>

### IWallet.setStatus(newStatus)
<p>Sets the wallet status</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  

| Param | Type | Description |
| --- | --- | --- |
| newStatus | <code>string</code> | <p>The new status to set</p> |

<a name="IWallet.setNetwork"></a>

### IWallet.setNetwork(networkId) ⇒ <code>Promise.&lt;void&gt;</code>
<p>Sets the active network for the wallet</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Emits**: <code>WalletEvents.event:networkUpdated</code>  

| Param | Type | Description |
| --- | --- | --- |
| networkId | <code>string</code> | <p>The network identifier to switch to</p> |

<a name="IWallet.getNetworkId"></a>

### IWallet.getNetworkId() ⇒ <code>string</code>
<p>Gets the current network ID</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>string</code> - <p>The current network identifier</p>  
<a name="IWallet.getDocumentById"></a>

### IWallet.getDocumentById(id) ⇒ <code>Promise.&lt;WalletDocument&gt;</code>
<p>Retrieves a document by its ID</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;WalletDocument&gt;</code> - <p>The document with the specified ID</p>  
**Throws**:

- <code>Error</code> <p>If document is not found</p>


| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | <p>The unique identifier of the document</p> |

<a name="IWallet.getAllDocuments"></a>

### IWallet.getAllDocuments() ⇒ <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code>
<p>Retrieves all documents stored in the wallet</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code> - <p>Array of all documents in the wallet</p>  
<a name="IWallet.getDocumentsById"></a>

### IWallet.getDocumentsById(idList) ⇒ <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code>
<p>Retrieves multiple documents by their IDs</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code> - <p>Array of documents matching the provided IDs</p>  

| Param | Type | Description |
| --- | --- | --- |
| idList | <code>Array.&lt;string&gt;</code> | <p>Array of document IDs to retrieve</p> |

<a name="IWallet.getDocumentsByType"></a>

### IWallet.getDocumentsByType(type) ⇒ <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code>
<p>Retrieves all documents of a specific type</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code> - <p>Array of documents matching the specified type</p>  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | <p>The document type to filter by (e.g., 'VerifiableCredential', 'DIDDocument')</p> |

<a name="IWallet.addDocument"></a>

### IWallet.addDocument(json, [options]) ⇒ <code>Promise.&lt;WalletDocument&gt;</code>
<p>Adds a new document to the wallet</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;WalletDocument&gt;</code> - <p>The created document with generated metadata</p>  
**Emits**: <code>WalletEvents.event:documentAdded</code>  

| Param | Type | Description |
| --- | --- | --- |
| json | <code>any</code> | <p>The document to add (must have valid JSON-LD structure)</p> |
| [options] | <code>any</code> | <p>Optional parameters for document creation</p> |

**Example**  
```js
const credential = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential"],
  "issuer": "did:dock:123",
  "credentialSubject": { "name": "John Doe" }
};
const addedDoc = await wallet.addDocument(credential);
```
<a name="IWallet.updateDocument"></a>

### IWallet.updateDocument(document, [options]) ⇒ <code>Promise.&lt;WalletDocument&gt;</code>
<p>Updates an existing document</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;WalletDocument&gt;</code> - <p>The updated document</p>  
**Throws**:

- <code>Error</code> <p>If document doesn't exist</p>

**Emits**: <code>WalletEvents.event:documentUpdated</code>  

| Param | Type | Description |
| --- | --- | --- |
| document | <code>any</code> | <p>The document with updated data (must include ID)</p> |
| [options] | <code>any</code> | <p>Optional parameters for document update</p> |

<a name="IWallet.removeDocument"></a>

### IWallet.removeDocument(id, [options]) ⇒ <code>Promise.&lt;void&gt;</code>
<p>Removes a document from the wallet</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Throws**:

- <code>Error</code> <p>If document is not found</p>

**Emits**: <code>WalletEvents.event:documentRemoved</code>  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | <p>The ID of the document to remove</p> |
| [options] | <code>any</code> | <p>Optional parameters for document removal</p> |

<a name="IWallet.getDocumentCorrelations"></a>

### IWallet.getDocumentCorrelations(documentId) ⇒ <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code>
<p>Gets all documents correlated to a specific document</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;Array.&lt;WalletDocument&gt;&gt;</code> - <p>Array of correlated documents</p>  

| Param | Type | Description |
| --- | --- | --- |
| documentId | <code>string</code> | <p>The ID of the document to find correlations for</p> |

<a name="IWallet.getAccountKeyPair"></a>

### IWallet.getAccountKeyPair(accountId) ⇒ <code>Promise.&lt;any&gt;</code>
<p>Retrieves the keypair associated with an account</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>The keypair associated with the account</p>  

| Param | Type | Description |
| --- | --- | --- |
| accountId | <code>string</code> | <p>The account ID to get the keypair for</p> |

<a name="IWallet.getDocumentsFromEncryptedWallet"></a>

### IWallet.getDocumentsFromEncryptedWallet(json, password) ⇒ <code>Promise.&lt;any&gt;</code>
<p>Decrypts and retrieves documents from an encrypted wallet without importing</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>Array of decrypted documents</p>  

| Param | Type | Description |
| --- | --- | --- |
| json | <code>any</code> | <p>The encrypted wallet JSON</p> |
| password | <code>string</code> | <p>Password to decrypt the wallet</p> |

<a name="IWallet.importUniversalWalletJSON"></a>

### IWallet.importUniversalWalletJSON(json, password) ⇒ <code>Promise.&lt;void&gt;</code>
<p>Imports documents from an encrypted Universal Wallet 2020 JSON</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**See**: [https://w3c-ccg.github.io/universal-wallet-interop-spec/](https://w3c-ccg.github.io/universal-wallet-interop-spec/)  

| Param | Type | Description |
| --- | --- | --- |
| json | <code>any</code> | <p>The encrypted wallet JSON</p> |
| password | <code>string</code> | <p>Password to decrypt the wallet</p> |

**Example**  
```js
// Import from encrypted wallet backup
const walletBackup = { ... }; // encrypted wallet JSON
await wallet.importUniversalWalletJSON(walletBackup, 'mypassword');
```
<a name="IWallet.exportDocuments"></a>

### IWallet.exportDocuments(params) ⇒ <code>Promise.&lt;any&gt;</code>
<p>Exports specified documents as an encrypted JSON (test)</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>Promise.&lt;any&gt;</code> - <p>Encrypted wallet JSON</p>  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | <p>Export parameters</p> |
| params.documents | <code>Array.&lt;any&gt;</code> | <p>Documents to export</p> |
| params.password | <code>string</code> | <p>Password for encryption</p> |

<a name="IWallet.exportUniversalWalletJSON"></a>

### IWallet.exportUniversalWalletJSON(password) ⇒ <code>any</code>
<p>Exports the entire wallet as an encrypted Universal Wallet 2020 JSON</p>

**Kind**: static method of [<code>IWallet</code>](#IWallet)  
**Returns**: <code>any</code> - <p>Encrypted Universal Wallet JSON representation</p>  
**See**: [https://w3c-ccg.github.io/universal-wallet-interop-spec/](https://w3c-ccg.github.io/universal-wallet-interop-spec/)  

| Param | Type | Description |
| --- | --- | --- |
| password | <code>string</code> | <p>Password for encryption</p> |

**Example**  
```js
// Create encrypted backup of entire wallet
const backup = await wallet.exportUniversalWalletJSON('mypassword');
// Save backup to file or cloud storage
```
<a name="DefaultQRCodeProcessor"></a>

## DefaultQRCodeProcessor
<p>Default implementation of QRCodeProcessor</p>
<p>This processor manages a registry of QR code handlers and executes them
in priority order to process scanned QR codes. It provides a flexible,
extensible system for handling various types of QR codes in a wallet application.</p>

**Kind**: global class  

* [DefaultQRCodeProcessor](#DefaultQRCodeProcessor)
    * [new DefaultQRCodeProcessor()](#new_DefaultQRCodeProcessor_new)
    * [.registerHandler(handler)](#DefaultQRCodeProcessor+registerHandler)
    * [.unregisterHandler(id)](#DefaultQRCodeProcessor+unregisterHandler) ⇒
    * [.getHandlers()](#DefaultQRCodeProcessor+getHandlers) ⇒
    * [.getHandler(id)](#DefaultQRCodeProcessor+getHandler) ⇒
    * [.clearHandlers()](#DefaultQRCodeProcessor+clearHandlers)
    * [.process(data, options)](#DefaultQRCodeProcessor+process) ⇒
    * [.defaultPrepareContext(data)](#DefaultQRCodeProcessor+defaultPrepareContext) ⇒
    * [.withTimeout(promise, timeoutMs)](#DefaultQRCodeProcessor+withTimeout) ⇒

<a name="new_DefaultQRCodeProcessor_new"></a>

### new DefaultQRCodeProcessor()
**Example**  
```typescript
const processor = new DefaultQRCodeProcessor();

// Register handlers
processor.registerHandler(new OID4VCHandler());
processor.registerHandler(new CredentialHandler());

// Process QR code
const result = await processor.process(scannedData);
if (result.success) {
  console.log('QR code processed:', result.data);
} else {
  console.error('Failed to process QR code:', result.error);
}
```
<a name="DefaultQRCodeProcessor+registerHandler"></a>

### defaultQRCodeProcessor.registerHandler(handler)
<p>Register a new QR code handler</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Throws**:

- <p>Error if a handler with the same ID is already registered</p>


| Param | Description |
| --- | --- |
| handler | <p>The handler to register</p> |

<a name="DefaultQRCodeProcessor+unregisterHandler"></a>

### defaultQRCodeProcessor.unregisterHandler(id) ⇒
<p>Unregister a QR code handler by its ID</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>True if the handler was found and removed, false otherwise</p>  

| Param | Description |
| --- | --- |
| id | <p>The ID of the handler to unregister</p> |

<a name="DefaultQRCodeProcessor+getHandlers"></a>

### defaultQRCodeProcessor.getHandlers() ⇒
<p>Get all registered handlers sorted by priority</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>Array of registered handlers sorted by priority (lowest first)</p>  
<a name="DefaultQRCodeProcessor+getHandler"></a>

### defaultQRCodeProcessor.getHandler(id) ⇒
<p>Get a specific handler by its ID</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>The handler if found, undefined otherwise</p>  

| Param | Description |
| --- | --- |
| id | <p>The ID of the handler to retrieve</p> |

<a name="DefaultQRCodeProcessor+clearHandlers"></a>

### defaultQRCodeProcessor.clearHandlers()
<p>Clear all registered handlers</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
<a name="DefaultQRCodeProcessor+process"></a>

### defaultQRCodeProcessor.process(data, options) ⇒
<p>Process QR code data through registered handlers</p>
<p>This method:</p>
<ol>
<li>Prepares the context from raw QR data</li>
<li>Executes handlers in priority order</li>
<li>Returns the first successful result (or continues if stopOnFirstSuccess is false)</li>
<li>Returns an error result if no handler can process the data</li>
</ol>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>Result of the processing</p>  

| Param | Description |
| --- | --- |
| data | <p>Raw QR code data string</p> |
| options | <p>Processing options</p> |

<a name="DefaultQRCodeProcessor+defaultPrepareContext"></a>

### defaultQRCodeProcessor.defaultPrepareContext(data) ⇒
<p>Default context preparation function</p>
<p>This method attempts to parse the raw QR data as JSON or URL.
Override this by providing a custom prepareContext function in ProcessOptions.</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>Prepared context object</p>  

| Param | Description |
| --- | --- |
| data | <p>Raw QR code data string</p> |

<a name="DefaultQRCodeProcessor+withTimeout"></a>

### defaultQRCodeProcessor.withTimeout(promise, timeoutMs) ⇒
<p>Execute a promise with a timeout</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>Result of the promise</p>  
**Throws**:

- <p>Error if the promise times out</p>


| Param | Description |
| --- | --- |
| promise | <p>Promise to execute</p> |
| timeoutMs | <p>Timeout in milliseconds</p> |

<a name="dockDocumentNetworkResolver"></a>

## dockDocumentNetworkResolver
<p>Given an Api URL, resolve the network ID
For now it will be applied for creds and certs
It can be extended to resolve other external URLs</p>

**Kind**: global variable  
<a name="OID4VCHandler"></a>

## OID4VCHandler ⇒
<p>Create an OID4VC handler with custom configuration</p>
<p>This is a convenience factory function for creating an OID4VC handler.</p>

**Kind**: global variable  
**Returns**: <p>Configured OID4VC handler</p>  

| Param | Description |
| --- | --- |
| config | <p>Handler configuration</p> |

**Example**  
```typescript
const handler = createOID4VCHandler({
  onImportCredential: async (uri) => {
    // Your import logic
    return { success: true };
  },
});
```

* [OID4VCHandler](#OID4VCHandler) ⇒
    * [.canHandle(context)](#OID4VCHandler+canHandle) ⇒
    * [.handle(context)](#OID4VCHandler+handle) ⇒

<a name="OID4VCHandler+canHandle"></a>

### oiD4VCHandler.canHandle(context) ⇒
<p>Check if this is an OID4VC URI</p>
<p>Matches URIs that start with any of the configured prefixes.
By default, matches: openid-credential-offer://</p>

**Kind**: instance method of [<code>OID4VCHandler</code>](#OID4VCHandler)  
**Returns**: <p>True if this handler can process the URI</p>  

| Param | Description |
| --- | --- |
| context | <p>The QR code context</p> |

<a name="OID4VCHandler+handle"></a>

### oiD4VCHandler.handle(context) ⇒
<p>Process the OID4VC credential offer URI</p>
<p>Delegates to the configured onImportCredential callback for actual processing.
This allows apps to implement their own navigation, UI, and error handling.</p>

**Kind**: instance method of [<code>OID4VCHandler</code>](#OID4VCHandler)  
**Returns**: <p>Result of the processing</p>  

| Param | Description |
| --- | --- |
| context | <p>The QR code context</p> |

<a name="DefaultQRCodeProcessor"></a>

## DefaultQRCodeProcessor ⇒
<p>Create a new QR code processor instance</p>
<p>This is a convenience factory function for creating a processor.</p>

**Kind**: global variable  
**Returns**: <p>New processor instance with handlers registered</p>  

| Param | Description |
| --- | --- |
| handlers | <p>Optional array of handlers to register immediately</p> |

**Example**  
```typescript
const processor = createQRCodeProcessor([
  new OID4VCHandler(),
  new CredentialHandler(),
]);
```

* [DefaultQRCodeProcessor](#DefaultQRCodeProcessor) ⇒
    * [new DefaultQRCodeProcessor()](#new_DefaultQRCodeProcessor_new)
    * [.registerHandler(handler)](#DefaultQRCodeProcessor+registerHandler)
    * [.unregisterHandler(id)](#DefaultQRCodeProcessor+unregisterHandler) ⇒
    * [.getHandlers()](#DefaultQRCodeProcessor+getHandlers) ⇒
    * [.getHandler(id)](#DefaultQRCodeProcessor+getHandler) ⇒
    * [.clearHandlers()](#DefaultQRCodeProcessor+clearHandlers)
    * [.process(data, options)](#DefaultQRCodeProcessor+process) ⇒
    * [.defaultPrepareContext(data)](#DefaultQRCodeProcessor+defaultPrepareContext) ⇒
    * [.withTimeout(promise, timeoutMs)](#DefaultQRCodeProcessor+withTimeout) ⇒

<a name="new_DefaultQRCodeProcessor_new"></a>

### new DefaultQRCodeProcessor()
**Example**  
```typescript
const processor = new DefaultQRCodeProcessor();

// Register handlers
processor.registerHandler(new OID4VCHandler());
processor.registerHandler(new CredentialHandler());

// Process QR code
const result = await processor.process(scannedData);
if (result.success) {
  console.log('QR code processed:', result.data);
} else {
  console.error('Failed to process QR code:', result.error);
}
```
<a name="DefaultQRCodeProcessor+registerHandler"></a>

### defaultQRCodeProcessor.registerHandler(handler)
<p>Register a new QR code handler</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Throws**:

- <p>Error if a handler with the same ID is already registered</p>


| Param | Description |
| --- | --- |
| handler | <p>The handler to register</p> |

<a name="DefaultQRCodeProcessor+unregisterHandler"></a>

### defaultQRCodeProcessor.unregisterHandler(id) ⇒
<p>Unregister a QR code handler by its ID</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>True if the handler was found and removed, false otherwise</p>  

| Param | Description |
| --- | --- |
| id | <p>The ID of the handler to unregister</p> |

<a name="DefaultQRCodeProcessor+getHandlers"></a>

### defaultQRCodeProcessor.getHandlers() ⇒
<p>Get all registered handlers sorted by priority</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>Array of registered handlers sorted by priority (lowest first)</p>  
<a name="DefaultQRCodeProcessor+getHandler"></a>

### defaultQRCodeProcessor.getHandler(id) ⇒
<p>Get a specific handler by its ID</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>The handler if found, undefined otherwise</p>  

| Param | Description |
| --- | --- |
| id | <p>The ID of the handler to retrieve</p> |

<a name="DefaultQRCodeProcessor+clearHandlers"></a>

### defaultQRCodeProcessor.clearHandlers()
<p>Clear all registered handlers</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
<a name="DefaultQRCodeProcessor+process"></a>

### defaultQRCodeProcessor.process(data, options) ⇒
<p>Process QR code data through registered handlers</p>
<p>This method:</p>
<ol>
<li>Prepares the context from raw QR data</li>
<li>Executes handlers in priority order</li>
<li>Returns the first successful result (or continues if stopOnFirstSuccess is false)</li>
<li>Returns an error result if no handler can process the data</li>
</ol>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>Result of the processing</p>  

| Param | Description |
| --- | --- |
| data | <p>Raw QR code data string</p> |
| options | <p>Processing options</p> |

<a name="DefaultQRCodeProcessor+defaultPrepareContext"></a>

### defaultQRCodeProcessor.defaultPrepareContext(data) ⇒
<p>Default context preparation function</p>
<p>This method attempts to parse the raw QR data as JSON or URL.
Override this by providing a custom prepareContext function in ProcessOptions.</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>Prepared context object</p>  

| Param | Description |
| --- | --- |
| data | <p>Raw QR code data string</p> |

<a name="DefaultQRCodeProcessor+withTimeout"></a>

### defaultQRCodeProcessor.withTimeout(promise, timeoutMs) ⇒
<p>Execute a promise with a timeout</p>

**Kind**: instance method of [<code>DefaultQRCodeProcessor</code>](#DefaultQRCodeProcessor)  
**Returns**: <p>Result of the promise</p>  
**Throws**:

- <p>Error if the promise times out</p>


| Param | Description |
| --- | --- |
| promise | <p>Promise to execute</p> |
| timeoutMs | <p>Timeout in milliseconds</p> |

<a name="DELEGATION_PROPOSAL_HANDLER"></a>

## DELEGATION\_PROPOSAL\_HANDLER
<p>Delegator side: handles incoming delegation request messages and emits
'delegationRequestReceived' with matching credentials.</p>

**Kind**: global constant  
<a name="DELEGATION_REVOCATION_REGISTRY_ID"></a>

## DELEGATION\_REVOCATION\_REGISTRY\_ID
<p>Wallet document id under which the single per-wallet revocation registry is
persisted. Holds { registryId, statusListCredentialUrl, nextIndex }.</p>

**Kind**: global constant  
<a name="STATUS_LIST_MAX_INDEX"></a>

## STATUS\_LIST\_MAX\_INDEX
<p>Valid statusListIndex range for the fixed 131,072-bit status list.</p>

**Kind**: global constant  
<a name="MessageTypes"></a>

## MessageTypes
<p>DIDComm Message helpers
Check https://identity.foundation/didcomm-messaging/spec/#out-of-band-messages for more details</p>

**Kind**: global constant  
<a name="issueCredential"></a>

## issueCredential(credentialData, issuerKey, delegationPolicy, delegationRoleId, rootCredentialId, revocationContext)
<p>Issue a delegatable credential</p>

**Kind**: global function  

| Param | Description |
| --- | --- |
| credentialData |  |
| issuerKey |  |
| delegationPolicy |  |
| delegationRoleId |  |
| rootCredentialId |  |
| revocationContext | <p>when provided, a StatusList2021Entry is allocated and embedded automatically so the credential can be revoked later. The wallet's revocation registry index counter is incremented and persisted as a side effect.</p> |

<a name="validateDelegationPolicy"></a>

## validateDelegationPolicy()
<p>Validate the structural integrity of a delegation policy.</p>
<p>Throws on the first failure. Only checks invariants that downstream code
relies on or that have security implications — fields like display labels
and metadata strings are left to the type contract.</p>

**Kind**: global function  
<a name="assertPolicyConformsToParent"></a>

## assertPolicyConformsToParent()
<p>Assert that a delegation policy is a valid narrowing of a parent policy.</p>
<p>Run after <code>validateDelegationPolicy(policy)</code> succeeds. The parent policy is
trusted to already be valid (it came from a credential we issued or accepted).</p>

**Kind**: global function  
<a name="fetchDelegationPolicyJson"></a>

## fetchDelegationPolicyJson(credential) ⇒
<p>Fetch the delegation policy for a given credential</p>

**Kind**: global function  
**Returns**: <p>A promise that resolves to the delegation policy for the given schema ID</p>  

| Param | Description |
| --- | --- |
| credential | <p>The credential containing the delegation policy ID</p> |

<a name="buildDelegationPolicyAttributes"></a>

## buildDelegationPolicyAttributes(delegationPolicy) ⇒
<p>Build delegation policy attributes
This is needed when issuing a delegatable credential, so that we can include the delegation policy ID and digest in the credential attributes</p>

**Kind**: global function  
**Returns**: <p>An object containing the delegation policy ID and digest to be included in the credential attributes</p>  

| Param |
| --- |
| delegationPolicy | 

<a name="createDelegationRequest"></a>

## createDelegationRequest()
<p>Delegatee side: validate and persist a DelegationRequest document.</p>

**Kind**: global function  
<a name="sendDelegationRequest"></a>

## sendDelegationRequest()
<p>Delegatee side: send the propose-credential DIDComm message to the delegator.</p>

**Kind**: global function  
<a name="rulesetMatches"></a>

## rulesetMatches()
<p>Canonical deep-equality of two rulesets — key and array ordering don't
affect the match.</p>

**Kind**: global function  
<a name="resolveMatchingDelegationDetails"></a>

## resolveMatchingDelegationDetails()
<p>Matcher checks for one credential against a request. Returns delegation
details on match, throws with the reason otherwise.</p>

**Kind**: global function  
<a name="findCredentialsForDelegationRequest"></a>

## findCredentialsForDelegationRequest()
<p>Delegator side: return wallet credentials that can fulfill the request.</p>

**Kind**: global function  
<a name="approveDelegationRequest"></a>

## approveDelegationRequest()
<p>Delegator side: re-validate, issue the delegated credential and send it to
the requester.</p>

**Kind**: global function  
<a name="rejectDelegationRequest"></a>

## rejectDelegationRequest()
<p>Delegator side: silent rejection — no message sent.</p>

**Kind**: global function  
<a name="signRevocationJWT"></a>

## signRevocationJWT()
<p>Resolve the issuer DID's private key doc and produce a DID-signed JWT whose
payload mirrors <code>claims</code> plus the standard aud/iss/iat/exp fields.</p>

**Kind**: global function  
<a name="postRevocation"></a>

## postRevocation()
<p>Sign a JWT mirroring <code>body</code>, then POST the revocation control action.
Throws on any non-2xx response.</p>

**Kind**: global function  
<a name="claimRevocationRegistry"></a>

## claimRevocationRegistry(ctx, registryId) ⇒
<p>Claim a registry with a DID-signed <code>create</code> call. Idempotent for the owning
DID. MUST be called BEFORE issuing any credential that references it.</p>

**Kind**: global function  
**Returns**: <p>the statusListCredential URL from the create response</p>  

| Param | Description |
| --- | --- |
| ctx | <p>signing + api context</p> |
| registryId | <p>the id to claim</p> |

<a name="getRevocationRegistry"></a>

## getRevocationRegistry(ctx) ⇒
<p>Get the wallet's revocation registry, creating + claiming one on first use or
when the previous registry's index counter is exhausted.</p>

**Kind**: global function  
**Returns**: <p>the persisted registry state</p>  

| Param | Description |
| --- | --- |
| ctx | <p>signing + api context</p> |

<a name="allocateStatusEntry"></a>

## allocateStatusEntry(ctx) ⇒
<p>Reserve the next statusListIndex and build the StatusList2021Entry to embed at
issuance. Increments and persists nextIndex atomically with wallet state.</p>

**Kind**: global function  
**Returns**: <p>the credentialStatus entry plus the updated registry</p>  

| Param | Description |
| --- | --- |
| ctx | <p>signing + api context</p> |

<a name="parseStatusEntry"></a>

## parseStatusEntry()
<p>Validate a credential's credentialStatus is a well-formed StatusList2021Entry
and extract the registryId + integer index. Throws with a clear message on any
malformed/missing field rather than letting a downstream TypeError or NaN leak.</p>

**Kind**: global function  
<a name="setDelegatableCredentialRevocation"></a>

## setDelegatableCredentialRevocation(credential, ctx, action)
<p>Revoke or unrevoke a delegatable credential.</p>
<p>Extracts registryId and index from the credential's credentialStatus,
signs a DID JWT, and POSTs the control action. Handles idempotency; a 409
indicates a wallet-side counter bug and should NOT be retried blindly.</p>

**Kind**: global function  

| Param | Description |
| --- | --- |
| credential | <p>the delegatable credential carrying a StatusList2021Entry</p> |
| ctx | <p>signing + api context (issuerDID must own the registry)</p> |
| action | <p>'revoke' or 'unrevoke'</p> |

<a name="isDelegatableCredentialRevoked"></a>

## isDelegatableCredentialRevoked(credential) ⇒
<p>Check whether a delegatable credential is currently revoked.</p>
<p>Public read — no auth, no sponsor key. Fetches the StatusList2021Credential
from the credential's own statusListCredential URL and reads the bit at its
statusListIndex. Verifiers do this automatically; this is for wallet-side UI.</p>

**Kind**: global function  
**Returns**: <p>true if the index bit is set (revoked), false otherwise</p>  

| Param | Description |
| --- | --- |
| credential | <p>the delegatable credential carrying a StatusList2021Entry</p> |

<a name="revokeDelegatableCredential"></a>

## revokeDelegatableCredential()
<p>Convenience wrapper: revoke.</p>

**Kind**: global function  
<a name="unrevokeDelegatableCredential"></a>

## unrevokeDelegatableCredential()
<p>Convenience wrapper: unrevoke.</p>

**Kind**: global function  
<a name="buildDelegationRoleTree"></a>

## buildDelegationRoleTree(policy) ⇒
<p>Build a tree structure representing the roles in a delegation policy, based on their parent-child relationships</p>

**Kind**: global function  
**Returns**: <p>A tree structure representing the roles in the delegation policy, where each node contains the role name, roleId, level in the hierarchy, and its children roles (if any)</p>  

| Param | Description |
| --- | --- |
| policy | <p>The delegation policy containing the roles and their relationships</p> |

<a name="getRemainingDelegationDepth"></a>

## getRemainingDelegationDepth(policy, roleId) ⇒
<p>Compute how many more times the holder of <code>roleId</code> may further delegate,
based on the policy's maxDelegationDepth and the holder's depth in the tree.</p>

**Kind**: global function  
**Returns**: <p>The remaining delegation depth, or null if the role is not in the policy</p>  

| Param | Description |
| --- | --- |
| policy | <p>The delegation policy</p> |
| roleId | <p>The roleId of the holder</p> |

<a name="buildVerificationFlowInviteMessage"></a>

## buildVerificationFlowInviteMessage() ⇒
**Kind**: global function  
**Returns**: <p>OOB message to start a wallet to wallet verification flow
The holder will scan it as QR code and should have the context to start the verification flow</p>  
<a name="buildRequestVerifiablePresentationMessage"></a>

## buildRequestVerifiablePresentationMessage()
<p>Sender: Verifier
OOB message to request a verifiable presentation from the holder</p>

**Kind**: global function  
<a name="buildAckWalletToWalletVerificationMessage"></a>

## buildAckWalletToWalletVerificationMessage()
<p>Sender: Holder
Start a wallet to wallet verification flow</p>

**Kind**: global function  
<a name="buildVerifiablePresentationMessage"></a>

## buildVerifiablePresentationMessage()
<p>Sender: Holder
Send a verifiable presentation to the verifier</p>

**Kind**: global function  
<a name="buildVerifiablePresentationAckMessage"></a>

## buildVerifiablePresentationAckMessage()
<p>Sender: Verifier
Sends an the presentation result to the holder</p>

**Kind**: global function  
<a name="handleBlockchainNetworkChange"></a>

## handleBlockchainNetworkChange()
<p>Update existing blockchain network connection
Compare connected blockchain connection with the current walle network
Disconnect and Establish a new connection if the network is different</p>

**Kind**: global function  
<a name="BiometricsProviderConfigs"></a>

## BiometricsProviderConfigs : <code>Object</code>
<p>Configuration options for biometric provider operations</p>

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| enrollmentCredentialType | <code>string</code> | <p>The credential type used for biometric enrollment</p> |
| biometricMatchCredentialType | <code>string</code> | <p>The credential type used for biometric matching</p> |
| idvConfigs | <code>E</code> | <p>IDV provider-specific configuration options</p> |

<a name="WalletStatus"></a>

## WalletStatus : <code>&#x27;closed&#x27;</code> \| <code>&#x27;loading&#x27;</code> \| <code>&#x27;ready&#x27;</code> \| <code>&#x27;error&#x27;</code>
<p>Possible wallet status values</p>

**Kind**: global typedef  
<a name="KeypairType"></a>

## KeypairType : <code>&#x27;sr25519&#x27;</code> \| <code>&#x27;ed25519&#x27;</code> \| <code>&#x27;ecdsa&#x27;</code>
<p>Supported keypair types</p>

**Kind**: global typedef  
<a name="OID4VCHandler"></a>

## OID4VCHandler
<p>Built-in handler for OID4VC (OpenID for Verifiable Credentials) URIs</p>
<p>This is a generic handler that can be configured with app-specific callbacks
for importing credentials. The handler itself only handles protocol detection
and delegates the actual import logic to the configured callback.</p>
<h2>Example Usage</h2>
<pre class="prettyprint source lang-typescript"><code>import { OID4VCHandler } from '@docknetwork/wallet-sdk-core/src/qr-handlers/builtin';
import { getCredentialProvider } from '@docknetwork/wallet-sdk-react-native';

const handler = new OID4VCHandler({
  onImportCredential: async (uri, context) => {
    try {
      // Use SDK to import credential
      await getCredentialProvider().importCredentialFromURI({
        uri,
        didProvider: getDIDProvider(),
        getAuthCode: async (authUrl) => {
          // App-specific auth handling
          return await showAuthWebView(authUrl);
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },
});

processor.registerHandler(handler);
</code></pre>
<h2>Handler Priority</h2>
<p>Default priority: 5 (very high)
This ensures OID4VC URIs are checked before other credential handlers.</p>

**Kind**: global class  
**Category**: Built-in Handlers  

* [OID4VCHandler](#OID4VCHandler)
    * [.canHandle(context)](#OID4VCHandler+canHandle) ⇒
    * [.handle(context)](#OID4VCHandler+handle) ⇒

<a name="OID4VCHandler+canHandle"></a>

### oiD4VCHandler.canHandle(context) ⇒
<p>Check if this is an OID4VC URI</p>
<p>Matches URIs that start with any of the configured prefixes.
By default, matches: openid-credential-offer://</p>

**Kind**: instance method of [<code>OID4VCHandler</code>](#OID4VCHandler)  
**Returns**: <p>True if this handler can process the URI</p>  

| Param | Description |
| --- | --- |
| context | <p>The QR code context</p> |

<a name="OID4VCHandler+handle"></a>

### oiD4VCHandler.handle(context) ⇒
<p>Process the OID4VC credential offer URI</p>
<p>Delegates to the configured onImportCredential callback for actual processing.
This allows apps to implement their own navigation, UI, and error handling.</p>

**Kind**: instance method of [<code>OID4VCHandler</code>](#OID4VCHandler)  
**Returns**: <p>Result of the processing</p>  

| Param | Description |
| --- | --- |
| context | <p>The QR code context</p> |

