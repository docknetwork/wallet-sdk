import {RpcService} from '../rpc-service-client';
import {serviceName, InitializeEDVParams, validation} from './configs';

export class EDVServiceRpc extends RpcService {
  constructor() {
    super(serviceName);
  }

  initialize(params: InitializeEDVParams) {
    validation.initialize(params);
    return this.call('initialize', params);
  }

  initializeFromMnemonic(params: { mnemonic: string; edvUrl: string; authKey: string }) {
    return this.call('initializeFromMnemonic', params);
  }

  initializeFromMasterKey(params: { masterKey: any; edvUrl: string; authKey: string }) {
    return this.call('initializeFromMasterKey', params);
  }

  generateKeys() {
    return this.call('generateKeys');
  }

  deriveKeys(masterKey) {
    return this.call('deriveKeys', masterKey);
  }

  getController() {
    return this.call('getController');
  }

  find(params: any) {
    return this.call('find', params);
  }

  update(params: any) {
    return this.call('update', params);
  }

  insert(params: any) {
    return this.call('insert', params);
  }

  delete(params: any) {
    return this.call('delete', params);
  }

  deriveBiometricKey(biometricData: Buffer, identifier: string) {
    return this.call('deriveBiometricKey', {biometricData, identifier});
  }

  deriveBiometricEncryptionKey(biometricData: Buffer, identifier: string) {
    return this.call('deriveBiometricEncryptionKey', {
      biometricData,
      identifier,
    });
  }

  encryptMasterKey(masterKey: Uint8Array, encryptionKey: Buffer, iv: Buffer) {
    return this.call('encryptMasterKey', {masterKey, encryptionKey, iv});
  }

  decryptMasterKey(
    encryptedKey: Uint8Array,
    decryptionKey: Buffer,
    iv: Buffer,
  ) {
    return this.call('decryptMasterKey', {encryptedKey, decryptionKey, iv});
  }
}
