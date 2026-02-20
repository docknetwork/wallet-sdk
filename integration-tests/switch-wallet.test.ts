import {
  closeWallet,
  getCredentialProvider,
  getDocumentsByType,
  getWallet,
  setNetwork,
} from './helpers';
import {BasicCredential} from './data/credentials';

async function assertWalletData() {
  const credentials = await getDocumentsByType('VerifiableCredential');
  expect(credentials.length).toBe(1);
}

describe('Switch wallet', () => {
  beforeEach(() => getWallet());

  it('expect to maintain separate document stores when switching between networks', async () => {
    await setNetwork('testnet');
    try {
      await getCredentialProvider().addCredential(BasicCredential);
    } catch(err) {
      console.error('Credential already added');
    }

    const testnetCredentials = await getDocumentsByType('VerifiableCredential');
    expect(testnetCredentials.length).toBe(1);

    await setNetwork('mainnet');
    
    const mainnetCredentials = await getDocumentsByType('VerifiableCredential');
    expect(mainnetCredentials.length).toBe(0);
  });

  afterAll(() => closeWallet());
});
