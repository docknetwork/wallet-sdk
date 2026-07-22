import {RpcService} from '../rpc-service-client';
import {
  serviceName,
  KeypairToDIDKeyDocumentParams,
  GetDIDResolutionParams,
} from './config';

export class DIDServiceRPC extends RpcService {
  constructor() {
    super(serviceName);
  }
  keypairToDIDKeyDocument(params: KeypairToDIDKeyDocumentParams) {
    return this.call('keypairToDIDKeyDocument', params);
  }
  getDIDResolution(params: GetDIDResolutionParams) {
    return this.call('getDIDResolution', params);
  }
  generateKeyDoc(params) {
    return this.call('generateKeyDoc', params);
  }
  deriveKeyDoc(params) {
    return this.call('deriveKeyDoc', params);
  }
  createSignedJWT(params) {
    return this.call('createSignedJWT', params);
  }
  signWithKeyDoc(params) {
    return this.call('signWithKeyDoc', params);
  }
}
