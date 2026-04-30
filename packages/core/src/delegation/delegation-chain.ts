import assert from 'assert';
import {isDelegatableCredential} from './delegation-policy';
import {DelegationPolicy} from './delegation-types';

function buildDelegationChainId(credentialId) {
  return `${credentialId}#delegationChain`;
}
/**
 * Return the list of credentials that are part of the delegation chain for a given credential.
 * @param credential
 * @param wallet
 * @returns
 */
export async function getDelegationChain(credential, wallet) {
  // assert credential is delegatable
  assert(isDelegatableCredential(credential), 'Credential is not delegatable');

  const delegationChainId = buildDelegationChainId(credential.id);
  return wallet.getDocument(delegationChainId);
}

type DelegationDetails = {
  yourRole: string;
  expires: Date;
  maxDelegationDepth: number;
  currentDelegationDepth: number;
  capabilities;
};

export async function addDelegationChain(credential, delegationChain, wallet) {
  // check if delegation chain exists
  const delegationChainId = buildDelegationChainId(credential.id);
  const existingChain = await wallet.getDocument(delegationChainId);

  if (existingChain) {
    throw new Error('Delegation chain already exists for this credential');
  }

  // store delegation chain in the wallet
  const delegationChainDocument = {
    id: `${credential.id}#delegationChain`,
    type: 'DelegationChain',
    credentialId: credential.id,
    delegationChain,
  };

  await wallet.addDocument(delegationChainDocument);

  return delegationChainDocument;
}
