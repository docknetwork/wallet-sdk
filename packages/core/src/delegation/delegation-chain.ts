import assert from 'assert';
import {isDelegatableCredential} from './delegation-utils';

export async function getDelegationChain(credential, wallet) {
  assert(isDelegatableCredential(credential), 'Credential is not delegatable');
  const document = await wallet.getDocumentById(`${credential.id}#delegationChain`);
  return document?.delegationChain ?? null;
}

export async function addDelegationChain(credential, delegationChain, wallet) {
  const delegationChainId = `${credential.id}#delegationChain`;
  const existingChain = await wallet.getDocumentById(delegationChainId);

  if (existingChain) {
    throw new Error('Delegation chain already exists for this credential');
  }

  const delegationChainDocument = {
    id: delegationChainId,
    type: 'DelegationChain',
    credentialId: credential.id,
    delegationChain,
  };

  await wallet.addDocument(delegationChainDocument);

  return delegationChainDocument;
}
