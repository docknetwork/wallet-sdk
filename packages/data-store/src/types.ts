import {EventEmitter} from 'events';

export type DocumentResolverProps = {
  document: WalletDocument;
  dataStore: DataStore;
};
export type DocumentNetworkResolver = (
  input: DocumentResolverProps,
) => Promise<DocumentResolverResult>;

export type DocumentResolverResult = {
  networkId: string;
  isFallback: boolean;
  resolver?: Function;
};

export type Network = {
  name: string;
  id: string;
  credentialHostnames: Array<string | RegExp>;
  configs?: any;
};

export type DataSource = {
  initialize: () => Promise<void>;
  destroy: () => Promise<void>;
};

export type DocumentStore = {
  addDocument: (json: any, options?: any) => Promise<WalletDocument>;
  updateDocument: (json: any, options?: any) => Promise<WalletDocument>;
  removeDocument: (id: string, options?: any) => Promise<void>;
  getDocumentById: (id: string) => Promise<WalletDocument>;
  getDocumentsById: (idList: string[]) => Promise<WalletDocument[]>;
  getDocumentsByType: (type: string) => Promise<WalletDocument[]>;
  getAllDocuments: (allNetworks?: any) => Promise<WalletDocument[]>;
  removeAllDocuments: () => Promise<void>;
  getDocumentCorrelations: (documentId: string) => Promise<WalletDocument[]>;
};

export type WalletStore = {
  getWallet: () => Promise<WalletDocument>;
  updateWallet: (json: any) => Promise<WalletDocument>;
}

export type DataStore = {
  events: EventEmitter;
  db: DataSource;
  networkId: string;
  testNetworkId: string;
  mainNetworkId: string;
  network: Network;

  networks: Network[];
  version?: string;
  resolveDocumentNetwork: DocumentNetworkResolver;
  setNetwork: (networkId: string) => Promise<void>;
  documents: DocumentStore;
  wallet: WalletStore;
};

export type ContextProps = {
  dataStore: DataStore;
};

export type DataStoreConfigs = {
  driver?: any;
  networks?: Network[];

  // Typeorm supported multiple RDBMS types https://typeorm.io/data-source-options#common-data-source-options
  // We've tested sqlite, react-native, and sqljs
  dbType?: 'sqlite' | 'react-native' | 'sqljs';

  defaultNetwork?: string;
  testNetworkId?: string;
  mainNetworkId?: string;

  dropSchema?: boolean;

  databasePath: string;

  documentNetworkResolver?: DocumentNetworkResolver;
  sqlJsConfig?: any;
  typeORMConfigs?: any;
  cloudWallet?: {
    edvUrl: string;
    authKey: string;
  };
  truveraApi?: {
    apiUrl: string;
    authKey: string;
  };
};

export type AnyJSON = any;

export type WalletDocument = {
  id: string;
  type: string[] | string;
} & AnyJSON;

export enum DataStoreEvents {
  DocumentCreated = 'DocumentCreated',
  DocumentUpdated = 'DocumentUpdated',
  DocumentDeleted = 'DocumentDeleted',
  AllDocumentsDeleted = 'AllDocumentsDeleted',
}


export type LocalStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
