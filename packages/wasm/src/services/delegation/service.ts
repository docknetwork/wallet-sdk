// @ts-nocheck

import {issueCredential, documentLoader} from '@docknetwork/credential-sdk/vc';
import {
  computePolicyDigestHex,
  fetchDelegationPolicyJson,
} from '@docknetwork/vc-delegation-engine';

import {getKeypairFromDoc} from '@docknetwork/universal-wallet/methods/keypairs';
import {blockchainService} from '../blockchain/service';

/**
 * Prepares a key document for signing by creating a proper keypair with signer capability
 * @param keyDoc - The key document with id, controller, type, and key material
 * @returns A key document with an active signer
 */
function prepareKeyForSigning(keyDoc): any {
  const kp = getKeypairFromDoc(keyDoc);
  // Get the signer from the keypair - this returns an object with id and sign method
  const signer = kp.signer();
  // Set the id on the signer to match the verification method
  signer.id = keyDoc.id;
  return {
    ...keyDoc,
    keypair: kp,
    signer,
  };
}

/**
 * Service class for delegatable credentials operations
 */
class DelegationService {
  name = 'delegation';

  rpcMethods = [
    DelegationService.prototype.issueCredential,
    DelegationService.prototype.computePolicyDigestHex,
    DelegationService.prototype.fetchDelegationPolicyJson,
  ];

  // Move this to credentil serivce?
  async issueCredential(keyPair, credential): Promise<Credential> {
    const preparedKey = prepareKeyForSigning(keyPair);
    return issueCredential(preparedKey, credential);
  }

  async computePolicyDigestHex(policyObject): Promise<string> {
    return computePolicyDigestHex(policyObject);
  }

  async fetchDelegationPolicyJson(policyId: string): Promise<any> {
    return fetchDelegationPolicyJson(
      documentLoader(blockchainService.resolver),
      policyId,
    );
  }
}

export const delegationService = new DelegationService();
