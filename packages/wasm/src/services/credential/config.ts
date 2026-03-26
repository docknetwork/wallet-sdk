// @ts-nocheck
import assert from 'assert';

export const serviceName = 'credentials';
export const validation = {
  generateCredential: params => {
    const {subject} = params;
    if (subject) {
      assert(typeof subject === 'object', 'invalid subject');
      assert(Object.keys(subject).length > 0, 'invalid subject');
    }
  },
  verifyCredential: params => {
    const {credential} = params;
    assert(
      typeof credential === 'object' || typeof credential === 'string',
      'invalid credential',
    );
    if (typeof credential === 'object') {
      assert(Object.keys(credential).length > 0, 'invalid credential');
    }
  },
  createBBSPresentation: params => {
    const {credentials} = params;
    assert(Array.isArray(credentials), 'invalid credentials');
    assert(credentials.length > 0, 'no credential found');
  },
  deriveVCFromPresentation: params => {
    const {credentials} = params;
    assert(Array.isArray(credentials), 'invalid credentials');
    assert(credentials.length > 0, 'no credential found');
  },
  signCredential: params => {
    const {vcJson, keyDoc} = params;
    assert(typeof vcJson === 'object', 'invalid vcJson');
    assert(typeof keyDoc === 'object', 'invalid keyDoc');

    assert(
      typeof keyDoc.publicKeyBase58 === 'string',
      'publicKeyBase58 is not present',
    );
  },
  generatePresentationFromPex: params => {
    const {credentials, pexRequest, challenge} = params;
    assert(Array.isArray(credentials), 'invalid credentials');
    assert(credentials.length > 0, 'no credential found');
    assert(pexRequest, 'pexRequest is required');
    assert(challenge, 'challenge is required');
  },
  createPresentation: params => {
    const {credentials, keyDoc, challenge, id} = params;
    assert(typeof id === 'string', 'invalid id');
    assert(typeof keyDoc === 'object', 'invalid KeyDoc');
    assert(typeof challenge === 'string', 'invalid challenge');
    assert(Array.isArray(credentials), 'invalid credentials');
    assert(credentials.length > 0, 'no credential found');
    assert(
      typeof keyDoc.publicKeyBase58 === 'string',
      'publicKeyBase58 is not present',
    );
  },
};
