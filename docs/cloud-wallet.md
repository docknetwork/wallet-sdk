# Cloud Wallet documentation

The Truvera Cloud Wallet provides SaaS hosted secure storage of a user's identity data. The contents of an individual cloud wallet are accessed through a wallet application. The Truvera Cloud Wallet APIs support synchronization between the cloud storage and local storage of a wallet application. In addition to standard mobile or web wallet applications, the Cloud Wallet also allows credentials to be used in existing web sites through embedded widgets. The Cloud Wallet is especially useful for non-human identity use cases, such as organizational identity wallets and wallets for AI agents.

The implementation is in:
`@docknetwork/wallet-sdk-core/src/cloud-wallet`

## Feature overview

The Truvera Cloud Wallet service hosts individual wallets for each user. The user's wallet stores encrypted documents that usually contain verifiable credentials. The service includes an [Encrypted Data Vault (EDV)](https://digitalbazaar.github.io/encrypted-data-vaults/) to securely store, sync, and manage documents. The Truvera Platform includes an EDV instance that can be used as part of a Truvera solution, but you can also deploy an EDV instance within your infrastructure if you prefer to host the encrypted user data. In most solutions, documents should be encrypted by the wallet application before being stored in a cloud wallet so that it cannot be read by the organization hosting the EDV.

Once initialized, the Cloud Wallet service automatically synchronizes documents between the EDV and the wallet application, allowing you to add, update, and remove credentials without dealing with the synchronization logic.

Each holder's individual cloud wallet is accessed using a key in the holder's possession. This key can be stored in the local storage of a wallet application, or derived from a biometric of the holder's. A recovery mnemonic can be used to recover a lost master key.

## Usage example

The example below demonstrates how to initialize and use the Cloud Wallet for managing documents.

### Step 1: Initialize the data store

First, you need to create local data storage to connect to the credential wallet.

#### For mobile and Node.js

```ts
import {createDataStore} from '@docknetwork/wallet-sdk-data-store-typeorm/lib';

const dataStore = await createDataStore({
  databasePath: 'dock-wallet',
  dbType: 'sqlite',
  defaultNetwork: 'testnet',
});
```

#### For browser

```ts
import {createDataStore} from '@docknetwork/wallet-sdk-data-store-web/lib';

const dataStore = await createDataStore({
  databasePath: 'dock-wallet',
  defaultNetwork: 'testnet',
});
```

### Step 2: Generate wallet key and mnemonic

Next, we generate a key and mnemonic for interacting with a cloud wallet. Use the same cloud wallet key across multiple devices to access the same documents. These keys are used to encrypt, decrypt, and locate documents in the EDV.

```ts
import {generateCloudWalletMasterKey} from '@docknetwork/wallet-sdk-core/lib/cloud-wallet';

const {masterKey, mnemonic} = await generateCloudWalletMasterKey();
```

The `masterKey` is used to derive encryption keys for the EDV, while the `mnemonic` is used to recover the master key.

**Note:** Encryption keys can be derived from biometric data through a third-party service, offering enhanced security by linking the keys to a user's unique biometric profile.

If the master key is lost, the mnemonic can be used to recover it. Store the mnemonic securely and do not share it with anyone.
```ts
import {recoverCloudWalletMasterKey} from '@docknetwork/wallet-sdk-core/lib/cloud-wallet';

const masterKey = await recoverCloudWalletMasterKey(mnemonic);
```

### Step 3: Initialize the cloud storage

After setting up the data store and generating keys, initialize the cloud storage and connect it to the local data storage. This ensures continuous synchronization between the EDV and the wallet.

```ts
import {initializeCloudWallet} from '@docknetwork/wallet-sdk-core/lib/cloud-wallet';

const {pullDocuments} = await initializeCloudWallet({
  dataStore,
  edvUrl: EDV_URL, 
  authKey: EDV_AUTH_KEY,
  masterKey,
});

// Pull documents from the EDV and sync with the wallet
await pullDocuments();
```
**The EDV auth key will need to be obtained from the Truvera support team via support@truvera.io**

The `pullDocuments` function synchronizes the EDV and the wallet by comparing documents and updating the data store accordingly. Documents can be credentials or messages.

### Step 4: Create a new wallet

Now, create a credential wallet inside of the data storage. This will allow you to add, update, and remove documents.

```ts
import {createWallet} from '@docknetwork/wallet-sdk-core/lib/wallet';

const wallet = await createWallet({
  dataStore,
});
```

### Step 5: Add a document to the wallet

You can add a document to the wallet using the following code:

```ts
const document = {
  id: 'document-id',
  type: 'document-type',
  someData: 'any-data-you-want',
};

await wallet.addDocument(document);
```

### Issuing credentials to a cloud wallet

You can issue credentials directly to a cloud wallet using the Truvera Workspace or the Truvera API. The credential will be automatically distributed to the holder's cloud wallet through the DIDComm protocol, eliminating the need for direct API calls or manual credential handling.

#### Important requirement

For the DIDComm automatic distribution to work properly, the **subject ID of the credential must be set to the holder's DID** when issuing the credential. This enables the system to route the credential to the correct wallet.

#### Receiving credentials in a cloud wallet

After a credential has been issued to a holder's DID, the cloud wallet only needs to fetch and process DIDComm messages to receive it:

```ts
import {createDIDProvider} from '@docknetwork/wallet-sdk-core/lib/did-provider';
import {createMessageProvider} from '@docknetwork/wallet-sdk-core/lib/message-provider';

const didProvider = createDIDProvider({ wallet });

const messageProvider = createMessageProvider({
  wallet,
  didProvider,
});

// This will process the messages for all the DIDs in the wallet
await messageProvider.fetchMessages();
await messageProvider.processDIDCommMessages();
```

### Full example

```ts
import {createDataStore} from '@docknetwork/wallet-sdk-data-store-web/lib';
import {initializeCloudWallet} from '@docknetwork/wallet-sdk-core/lib/cloud-wallet';
import {createWallet} from '@docknetwork/wallet-sdk-core/lib/wallet';


async function example() {
  const dataStore = await createDataStore({
    databasePath: 'dock-wallet',
    defaultNetwork: 'testnet',
  });


  const {pullDocuments} = await initializeCloudWallet({
    dataStore,
    edvUrl: EDV_URL, 
    authKey: EDV_AUTH_KEY,
    masterKey,
  });

  // Pull documents from the EDV and sync with the wallet
  await pullDocuments();

  const wallet = await createWallet({
    dataStore,
  });

  const document = {
    id: 'document-id',
    type: 'document-type',
    someData: 'any-data-you-want',
  };

  await wallet.addDocument(document);
}


example();

```

## Multi-key authentication

The Truvera Cloud Wallet supports multiple authentication methods to unlock the same wallet, providing both security and convenience.

### Available authentication methods

1. **Mnemonic-based authentication**: The traditional recovery phrase approach
2. **Biometric authentication**: Using fingerprints, facial recognition, or other biometric data
3. **Future extensions**: Can be extended to support passkeys and other authentication methods

### How multi-key authentication works

The Cloud Wallet uses a key mapping system that allows a secondary key (e.g. derived from biometrics) to unlock the same master key that was originally derived from a mnemonic phrase.

The system uses a two-vault architecture:
- KeyMappingVault: Stores encrypted master keys that can only be accessed with proper authentication
- CloudWalletVault: The main vault containing wallet documents, secured by the master key

We will provide an example of how this two-vault architecture can be used to allow biometric authentication to the cloud wallet.

Note that the biometric sample used to authenticate to a cloud wallet could also be provided to a [biometric service](https://github.com/docknetwork/wallet-sdk/blob/master/docs/biometric-plugin.md) in order to issue a new biometric check credential as described in [biometric bound credentials](https://docs.truvera.io/solutions/biometric-bound-credentials).

#### Step 1: Enroll user with biometric data

To set up biometric authentication, enroll the user with their biometric data and identifier:

```ts
import { enrollUserWithBiometrics } from '@docknetwork/wallet-sdk-core/lib/cloud-wallet';

// Biometric data would come from platform-specific biometric APIs
const biometricData = await getPlatformBiometricData();
const userEmail = 'user@example.com';

// Enroll user and get master key + recovery mnemonic
const { masterKey, mnemonic } = await enrollUserWithBiometrics(
  EDV_URL,
  EDV_AUTH_KEY,
  biometricData,
  userEmail
);

// IMPORTANT: Store the mnemonic securely for recovery purposes
```
The enrollment process:
1. Creates a unique master key and mnemonic
2. Generates encryption keys from the biometric data
3. Encrypts the master key with the biometric-derived keys
4. Stores the encrypted master key in the KeyMappingVault, indexed by the user's email

In this example, the user email address is provided as a unique identifier to look up the biometric template for highly secure one-to-one biometric matching. The identifier is not shared with issuers or verifiers and any identifier may be used so long as it is convenient for the holder to remember. Phone numbers are another common choice. Biometric solutions that support one-to-n matching might be sufficient for many scenarios and would allow the user to avoid having to remember and provide an identifier. If you use an identifier, remember to verify that the user is actually in control of the identifier or an attacker could register the identifier and prevent the legitimate holder from accessing the service.

#### Step 2: Authenticate with biometrics

Next, when the user wants to access their wallet, they can authenticate with their biometric data:

```ts
import {
  authenticateWithBiometrics,
  initializeCloudWalletWithBiometrics
} from '@docknetwork/wallet-sdk-core/lib/cloud-wallet';

// Get current biometric data from platform APIs
const biometricData = await getPlatformBiometricData();
const userEmail = 'user@example.com';

// Method 1: Get the master key directly
const masterKey = await authenticateWithBiometrics(
  EDV_URL,
  EDV_AUTH_KEY,
  biometricData,
  userEmail
);

// Method 2: Initialize cloud wallet in one step
const cloudWallet = await initializeCloudWalletWithBiometrics(
  EDV_URL,
  EDV_AUTH_KEY,
  biometricData,
  userEmail,
  dataStore
);
```
The authentication process:
1. Uses biometric data and email to access the KeyMappingVault
2. Finds the encrypted master key associated with the user's email
3. Derives decryption keys from the provided biometric data
4. Decrypts the master key
5. Uses the master key to access the CloudWalletVault

### Wallet recovery

This architecture allows solution developers to design the recovery mechanism that makes sense for your use case.

If only a master key is used, then the mnemonic should also be provided to the user so that they can regenerate the master key if necessary.

Alternatively, one or more recovery keys can be stored in the KeyMappingVault. As they are used, old keys can be removed and new keys can be added.

If a biometrically derived key can no longer be generated, then a recovery key should be used to enroll a new biometric. Any biometric-bound credentials will need to be reissued with the new biometric.


## Organizational wallets

Verifiable credentials can help automate many processes that include organization identity, such as credit worthiness or Know-Your-Business (KYB) checks. Organization information that originates with a third party and then must be privately shared with a relying party is well suited to verifiable credentials.

By storing organizational credentials in a cloud wallet, multiple members of the organization can access the wallet to present the credentials as needed. The multi-key authentication described above allows for integration with a variety of authentication and authorization systems.

* Keys to the organization's cloud wallet can be stored in a corporate secrets vault or password manager, through which access can be granted to authorized employees.
* Staff can authenticate with the corporate IAM system. If they are authorized to use the cloud wallet, then the key stored in the IAM system can be used for the cloud wallet.
