import { createDataStore } from '@docknetwork/wallet-sdk-data-store-web/src/index';
import { initializeCloudWallet, generateCloudWalletMasterKey, recoverCloudWalletMasterKey } from '@docknetwork/wallet-sdk-core/src/cloud-wallet';
import { createWallet } from '@docknetwork/wallet-sdk-core/src/wallet';
import { createCredentialProvider } from '@docknetwork/wallet-sdk-core/src/credential-provider';
import { createDIDProvider } from '@docknetwork/wallet-sdk-core/src/did-provider';
import { createMessageProvider } from '@docknetwork/wallet-sdk-core/src/message-provider';
import { createVerificationController } from '@docknetwork/wallet-sdk-core/src/verification-controller';

async function initialize({
  edvUrl,
  edvAuthKey,
  networkId,
  masterKey,
  mnemonic
}) {

  if (!masterKey && !mnemonic) {
    throw new Error('Master key or mnemonic is required');
  }

  if (masterKey && mnemonic) {
    throw new Error('Master key and mnemonic cannot be used together');
  }

  if (!edvUrl) {
    throw new Error('EDV URL is required');
  }

  if (!edvAuthKey) {
    throw new Error('EDV Auth Key is required');
  }

  if (!networkId) {
    throw new Error('Network ID is required');
  }

  const dataStore = await createDataStore({
    databasePath: 'dock-wallet',
    defaultNetwork: networkId || 'testnet',
  });
  console.log('Data store created');

  const wallet = await createWallet({ dataStore });
  console.log('Wallet created');

  const didProvider = createDIDProvider({ wallet });
  console.log('DID provider created');

  const credentialProvider = await createCredentialProvider({
    wallet,
  });
  console.log('Credential provider created');

  const messageProvider = createMessageProvider({ wallet, didProvider });
  console.log('Message provider created');

  if (mnemonic) {
    masterKey = await recoverCloudWalletMasterKey(mnemonic);
  } else if (masterKey) {
    masterKey = masterKey;
  } else {
    throw new Error('Master key or mnemonic is required');
  }

  const cloudWallet = await initializeCloudWallet({
    dataStore: dataStore,
    edvUrl: edvUrl,
    masterKey: masterKey,
    authKey: edvAuthKey,
  });
  console.log('Cloud wallet created');

  console.log(credentialProvider);

  try {
    const documents = await cloudWallet.pullDocuments();
  } catch (err) {
    console.error('Error pulling documents', err);
  }

  return {
    // Simplified API for common use cases
    wallet,
    /**
     * Get the list of credentials
     * @returns 
     */
    getCredentials: async () => {
      return await credentialProvider.getCredentials();
    },
    /**
     * Import credential using an offer URI
     * @param {*} uri 
     * @returns 
     */
    addCredential: async (uri) => {
      return await credentialProvider.importCredentialFromURI({ uri, didProvider });
    },
    /**
     * Get default DID
     * @returns 
     */
    getDID: async () => {
      return await didProvider.getDefaultDID();
    },
    /**
     * Submit a presentation for the given credentials and proof request URL
     * @param {*} param0 
     * @param {Object} param0.credentials - Map of credential id with attributesToReveal object
     * @param {string} param0.proofRequestUrl - Proof request URL should be a valid URL to a proof request template
     * 
     * @example
     * const presentation = await cloudWallet.createPresentation({
     *   credentials: {
     *     'credentialId': { attributesToReveal: ['attribute1', 'attribute2'] },
     *   },
     *   proofRequestUrl: 'https://example.com/proof-request',
     * });
     * @returns 
     */
    submitPresentation: async ({
      // Map of credential id with attributesToReveal object
      credentials,
      // Proof request URL should be a valid URL to a proof request template
      proofRequestUrl,
    }) => {
      const verificationController = createVerificationController({
        wallet,
        credentialProvider,
        didProvider,
      });

      await verificationController.start({ template: proofRequestUrl });
      for (const credential of credentials) {
        verificationController.selectedCredentials.set(credential.id, {
          credential: credential,
          attributesToReveal: credentials[credential.id].attributesToReveal,
        });
      }
      const presentation = await verificationController.createPresentation();

      return await verificationController.submitPresentation(presentation);
    }
  }

}

export default {
  initialize,
  createDataStore,
  createWallet,
  createCredentialProvider,
  createDIDProvider,
  createMessageProvider,
  initializeCloudWallet,
  generateCloudWalletMasterKey,
  recoverCloudWalletMasterKey,
  createVerificationController,
};
