import {RpcService} from '../rpc-service-client';
import {validation} from './configs';

export class UtilCryptoServiceRpc extends RpcService {
  constructor() {
    super('utilCrypto');
  }

  mnemonicGenerate(numWords: number): Promise<any> {
    validation.mnemonicGenerate(numWords);

    return this.call('mnemonicGenerate', numWords);
  }

  mnemonicToMiniSecret(phrase: string): Promise<any> {
    validation.mnemonicToMiniSecret(phrase);

    return this.call('mnemonicToMiniSecret', phrase);
  }

  isBase64(value: string): Promise<boolean> {
    return this.call('isBase64', value);
  }

  hexToString(hex: string): Promise<string> {
    return this.call('hexToString', hex);
  }

  generateRegistryId(): Promise<string> {
    return this.call('generateRegistryId');
  }
}
