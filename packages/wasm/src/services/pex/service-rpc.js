import {RpcService} from '../rpc-service-client';
import {
  serviceName,
  FilterCredentialsParams,
  validation,
  EvaluatePresentationParams,
  CreatePresentationParams,
} from './config';

export class PEXServiceRPC extends RpcService {
  constructor() {
    super(serviceName);
    this.sandbox = process.env.NODE_ENV !== 'test';
  }
  async filterCredentials(params: FilterCredentialsParams) {
    validation.filterCredentials(params);
    return this.call('filterCredentials', params);
  }
  async evaluatePresentation(params: EvaluatePresentationParams) {
    validation.evaluatePresentation(params);
    return this.call('evaluatePresentation', params);
  }

  async presentationFrom(params: CreatePresentationParams) {
    return this.call('presentationFrom', params);
  }

  async isCredentialSelectionValid(params: EvaluateCredentialsParams) {
    return this.call('isCredentialSelectionValid', params);
  }
}
