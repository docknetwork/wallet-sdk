import {
  BasicCredential,
  PolygonIDCredential,
  UniversityDegreeCredential,
  UniversityDegreeCredentialBBS,
} from './data/credentials';
import {
  cleanup,
  closeWallet,
  getCredentialProvider,
  getWallet,
} from './helpers';
import axios from 'axios';
import {CheqdRevocationCredential} from './data/credentials/cheqd-credentials';

const allCredentials = [
  BasicCredential,
  UniversityDegreeCredential,
  UniversityDegreeCredentialBBS,
  PolygonIDCredential,
];

describe('Credentials', () => {
  let wallet;
  beforeAll(async () => {
    await cleanup();
    wallet = await getWallet();
  });

  it('expect to import credentials', async () => {
    for (const credentialJSON of allCredentials) {
      try {
        await getCredentialProvider().addCredential(credentialJSON);
      } catch(err) {
        console.error('Credential already added');
      }
      const credential = await getCredentialProvider().getById(
        credentialJSON.id,
      );
      expect(credential).toBeDefined();
    }
  });

  describe('credential status', () => {
    it('should get status of bbs revokable credential - dock issuer', async () => {
      const credentialUrl =
        'https://creds-testnet.truvera.io/84b3cbe48c2e2e487c0c896615566b81b2e2e41ab818d3de3956cf1895ec4815';
      const password = 'test';
      const {data: credential} = await axios.get(
        `${credentialUrl}?p=${btoa(password)}`,
      );

      try {
        await getCredentialProvider().addCredential(credential);
      } catch(err) {
        console.error('Credential already added');
      }

      const result: any = await getCredentialProvider().isValid(credential);

      expect(result.status).toBe('verified');
    });

    it('should get status of bbs revokable credential - cheqd issuer', async () => {
      try {
        await getCredentialProvider().addCredential(CheqdRevocationCredential);
      } catch(err) {
        console.error('Credential already added');
      }

      const result: any = await getCredentialProvider().isValid(
        CheqdRevocationCredential,
      );

      expect(result.status).toBe('verified');
    });
  });

  afterAll(() => closeWallet());
});
