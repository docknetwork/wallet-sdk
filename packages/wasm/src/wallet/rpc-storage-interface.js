import StorageInterface from '@docknetwork/universal-wallet/storage/storage-interface';
import {v4 as uuid} from 'uuid';
import {storageService} from '../services/storage';
import {Logger} from '../core/logger';

function generateDocumentId() {
  return `doc:${uuid()}`;
}

/* An example file system storage interface implementation. This is not secure and shouldn't be used in production */
class RpcStorageInterface extends StorageInterface {
  constructor(directory) {
    super();
    this.directory = directory;
    this.loadStorage(directory);
  }

  async loadStorage(directory) {
    let data;
    try {
      Logger.debug(`Wallet: Loading storage from ${directory}`);
      data = await storageService.getItem(directory);

      this.documents = typeof data === 'string' ? JSON.parse(data) : data;

      if (!this.documents) {
        Logger.debug('Wallet: no storage found, creating empty wallet');
        this.documents = {};
      } else {
        Logger.debug(
          `Wallet: existing storage found with ${
            Object.keys(this.documents).length
          } documents`,
        );
      }
    } catch (err) {
      Logger.error(
        `error to retrieve data from rpc storage: ${err.toString()}`,
      );
      this.documents = {};

      throw err;
    }
  }

  updateLocalStorage() {
    storageService.setItem(this.directory, JSON.stringify(this.documents));
  }

  async get({id}) {
    const content = this.documents[id];
    return {
      id,
      content,
    };
  }

  async update(options) {
    return this.insert(options);
  }

  async delete({document}) {
    delete this.documents[document.id];
    this.updateLocalStorage();
  }

  async insert({document}) {
    const docId = document.id || generateDocumentId();

    this.documents[docId] = document.content;

    this.updateLocalStorage();

    return {
      id: docId,
      ...document,
    };
  }

  async count(query) {
    const result = await this.find(query);
    return result.length;
  }

  async find({has = undefined, equals = undefined} = {}) {
    const documentIds = Object.keys(this.documents || {});

    Logger.debug('Execute find', {
      equals,
      documentCount: documentIds.length,
    });

    const documents = documentIds
      .map(docId => {
        const content = this.documents[docId];

        let matchesQuery = false;
        if (!has && !equals) {
          // Return all documents
          matchesQuery = true;
        } else if (equals && equals['content.id']) {
          // Basic "query" support for tests
          matchesQuery = content.id === equals['content.id'];
        } else if (equals && equals['content.type']) {
          // Basic "query" support for tests
          matchesQuery = content.type === equals['content.type'];
        }

        if (matchesQuery) {
          return {
            id: docId,
            content,
          };
        }

        return null;
      })
      .filter(value => !!value);
    return {documents};
  }
}

export default RpcStorageInterface;
