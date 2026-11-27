import {normalizeDIDDocument} from './normalize-did-document';

const did = 'did:cheqd:testnet:c0890f1c-c7bb-4ea6-be7a-8c31404743b7';
const ed25519Key = {
  id: `${did}#keys-1`,
  type: 'Ed25519VerificationKey2018',
  controller: did,
  publicKeyBase58: 'ed25519PublicKey',
};
const bbsKey = {
  id: `${did}#keys-2`,
  type: 'Bls12381BBSVerificationKeyDock2023',
  controller: did,
  publicKeyBase58: 'bbsPublicKey',
};

describe('normalizeDIDDocument', () => {
  it('lifts embedded verification method objects into verificationMethod', () => {
    // Shape returned by DIF's hosted universal resolver for cheqd BBS+ keys.
    const doc = normalizeDIDDocument({
      id: did,
      verificationMethod: [ed25519Key],
      assertionMethod: [ed25519Key.id, {...bbsKey}],
      authentication: [ed25519Key.id],
    });

    expect(doc.verificationMethod).toEqual([ed25519Key, bbsKey]);
    expect(doc.assertionMethod).toEqual([ed25519Key.id, bbsKey.id]);
    expect(doc.authentication).toEqual([ed25519Key.id]);
  });

  it('lifts double-JSON-stringified verification methods', () => {
    const doc = normalizeDIDDocument({
      id: did,
      verificationMethod: [ed25519Key],
      assertionMethod: [ed25519Key.id, JSON.stringify(JSON.stringify(bbsKey))],
    });

    expect(doc.verificationMethod).toEqual([ed25519Key, bbsKey]);
    expect(doc.assertionMethod).toEqual([ed25519Key.id, bbsKey.id]);
  });

  it('lifts single-JSON-stringified verification methods', () => {
    const doc = normalizeDIDDocument({
      id: did,
      assertionMethod: [JSON.stringify(bbsKey)],
    });

    expect(doc.verificationMethod).toEqual([bbsKey]);
    expect(doc.assertionMethod).toEqual([bbsKey.id]);
  });

  it('does not duplicate a method already in verificationMethod', () => {
    const doc = normalizeDIDDocument({
      id: did,
      verificationMethod: [ed25519Key, bbsKey],
      assertionMethod: [{...bbsKey}],
      capabilityInvocation: [JSON.stringify(bbsKey)],
    });

    expect(doc.verificationMethod).toEqual([ed25519Key, bbsKey]);
    expect(doc.assertionMethod).toEqual([bbsKey.id]);
    expect(doc.capabilityInvocation).toEqual([bbsKey.id]);
  });

  it('adds a method embedded in several relationships only once', () => {
    const doc = normalizeDIDDocument({
      id: did,
      assertionMethod: [{...bbsKey}],
      authentication: [{...bbsKey}],
    });

    expect(doc.verificationMethod).toEqual([bbsKey]);
    expect(doc.assertionMethod).toEqual([bbsKey.id]);
    expect(doc.authentication).toEqual([bbsKey.id]);
  });

  it('leaves plain references and unrecognised entries untouched', () => {
    const notAMethod = {foo: 'bar'};
    const doc = normalizeDIDDocument({
      id: did,
      verificationMethod: [ed25519Key],
      assertionMethod: [ed25519Key.id, 'not json', notAMethod],
    });

    expect(doc.verificationMethod).toEqual([ed25519Key]);
    expect(doc.assertionMethod).toEqual([ed25519Key.id, 'not json', notAMethod]);
  });

  it('keeps embedded keyAgreement objects in place while lifting them', () => {
    const x25519Key = {
      id: `${did}#keys-3`,
      type: 'X25519KeyAgreementKey2019',
      controller: did,
      publicKeyBase58: 'x25519PublicKey',
    };
    const doc = normalizeDIDDocument({
      id: did,
      keyAgreement: [{...x25519Key}],
    });

    expect(doc.verificationMethod).toEqual([x25519Key]);
    expect(doc.keyAgreement).toEqual([x25519Key]);
  });

  it('parses stringified keyAgreement entries into objects', () => {
    const x25519Key = {
      id: `${did}#keys-3`,
      type: 'X25519KeyAgreementKey2019',
      controller: did,
      publicKeyBase58: 'x25519PublicKey',
    };
    const doc = normalizeDIDDocument({
      id: did,
      keyAgreement: [JSON.stringify(JSON.stringify(x25519Key))],
    });

    expect(doc.verificationMethod).toEqual([x25519Key]);
    expect(doc.keyAgreement).toEqual([x25519Key]);
  });

  it('keeps a singleton verificationMethod object when lifting', () => {
    const doc = normalizeDIDDocument({
      id: did,
      verificationMethod: ed25519Key,
      assertionMethod: [{...bbsKey}],
    });

    expect(doc.verificationMethod).toEqual([ed25519Key, bbsKey]);
    expect(doc.assertionMethod).toEqual([bbsKey.id]);
  });

  it('is idempotent', () => {
    const input = {
      id: did,
      verificationMethod: [ed25519Key],
      assertionMethod: [{...bbsKey}],
    };
    const once = normalizeDIDDocument(JSON.parse(JSON.stringify(input)));
    const twice = normalizeDIDDocument(JSON.parse(JSON.stringify(once)));

    expect(twice).toEqual(once);
  });

  it('returns non-object input as is', () => {
    expect(normalizeDIDDocument(null)).toBeNull();
    expect(normalizeDIDDocument(undefined)).toBeUndefined();
    expect(normalizeDIDDocument('did:example:123')).toEqual('did:example:123');
  });
});
