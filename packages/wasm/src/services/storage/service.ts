// @ts-nocheck
let _store;
function getStore() {
  if (_store) {
    return _store;
  }

  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    _store = globalThis.localStorage;
    return _store;
  }

  const {LocalStorage} = require('node-localstorage');
  _store = new LocalStorage(process.env.LOCAL_STORAGE_PATH || './local-storage');
  return _store;
}

export class StorageService {
  rpcMethods = [
    StorageService.prototype.setItem,
    StorageService.prototype.getItem,
    StorageService.prototype.removeItem,
    StorageService.prototype.getAllKeys,
  ];

  constructor() {
    this.name = 'storage';
  }

  setItem(...args): Promise<any> {
    return getStore().setItem(...args);
  }

  removeItem(...args): Promise<any> {
    return getStore().removeItem(...args);
  }

  getItem(...args): Promise<any> {
    return getStore().getItem(...args);
  }

  getAllKeys(): Promise<string[]> {
    const store = getStore();
    const keys = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (typeof key === 'string') {
        keys.push(key);
      }
    }
    return Promise.resolve(keys);
  }
}

export const storageService: StorageService = new StorageService();
