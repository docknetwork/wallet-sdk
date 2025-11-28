import {
  didcommCreateEncrypted,
  didcommDecrypt,
  DIDCOMM_TYPE_ISSUE_DIRECT,
  getDerivedAgreementKey,
} from '../lib/didcomm';
import {ALICE_KEY_PAIR_DOC, BOB_KEY_PAIR_DOC} from './mock-data';
import {blockchainService} from '@docknetwork/wallet-sdk-wasm/src/services/blockchain/service';
// import {ResolverRouter} from '@docknetwork/credential-sdk/resolver';

const didList = [ALICE_KEY_PAIR_DOC, BOB_KEY_PAIR_DOC];

const mockDIDResolver = {
  async resolve(did) {
    const trimmedDID = did.split('#')[0];
    const document = didList.find(
      doc => doc.controller === trimmedDID,
    )?.didResolution;

    if (!document) {
      throw new Error(`Mock document not found for did: ${trimmedDID}`);
    }

    return document;
  },
};

blockchainService.createDIDResolver = () => mockDIDResolver;
blockchainService._resolver = mockDIDResolver;

describe('DIDComm', () => {
  it('expect to decrypt didcomm message', async () => {
    blockchainService._resolver = mockDIDResolver;

    const keyAgreementKey = await getDerivedAgreementKey(ALICE_KEY_PAIR_DOC);

    const payload = {domain: 'api.dock.io', message: 'test'};
    const jwe = await didcommCreateEncrypted({
      recipientDids: [BOB_KEY_PAIR_DOC.id],
      type: DIDCOMM_TYPE_ISSUE_DIRECT,
      senderDid: ALICE_KEY_PAIR_DOC.controller,
      payload,
      keyAgreementKey,
    });

    expect(jwe.typ).toBe('application/didcomm-encrypted+json');
    expect(jwe.ciphertext).toBeDefined();

    const decrypted = await didcommDecrypt(
      jwe,
      await getDerivedAgreementKey(BOB_KEY_PAIR_DOC),
    );

    expect(decrypted.body).toStrictEqual(payload);
  });
});
