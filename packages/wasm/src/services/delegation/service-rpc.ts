import {RpcService} from '../rpc-service-client';
/**
 *
 */
export class DelegationServiceRpc extends RpcService {
  constructor() {
    super('delegation');
  }

  async issueCredential(keyPair, credential) {
    return this.call('issueCredential', keyPair, credential);
  }

  async computePolicyDigestHex(policyObject) {
    return this.call('computePolicyDigestHex', policyObject);
  }

  async fetchDelegationPolicyJson(policyId) {
    return this.call('fetchDelegationPolicyJson', policyId);
  }
}
