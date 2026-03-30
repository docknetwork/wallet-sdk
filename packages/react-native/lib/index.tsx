import {setStorage} from '@docknetwork/wallet-sdk-wasm/src/core/storage';
import {
  WalletEvents,
  WalletStatus,
} from '@docknetwork/wallet-sdk-core/src/wallet';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Platform, View} from 'react-native';
import WebView from 'react-native-webview';
import {WebviewEventHandler} from './message-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DocumentType,
  WalletDocument,
} from '@docknetwork/wallet-sdk-wasm/src/types';
import './rn-rpc-server';
import {useDIDManagement} from './didHooks';
import {
  useCredentialUtils,
  useCredentialStatus,
} from './credentials/credentialHooks';
import {
  CredentialProvider,
  useCredentialContext,
} from './credentials/CredentialContext';
import {getOrCreateWallet} from './wallet';
import debounce from 'lodash.debounce';
import {setV1LocalStorage} from '@docknetwork/wallet-sdk-data-store-typeorm/src/migration/migration1/v1-data-store';
import {IWallet} from '@docknetwork/wallet-sdk-core/src/types';
import { DataStoreConfigs } from '@docknetwork/wallet-sdk-data-store/src/types';
export type WalletSDKContextProps = {
  wallet?: IWallet;
  documents: WalletDocument[];
  status: WalletStatus;
  createWallet: () => Promise<void>;
  toggleTestMode: () => Promise<void>;
  testMode?: boolean;
  refetch: ({fetchBalances}?: {fetchBalances: boolean}) => Promise<void>;
};

setV1LocalStorage(AsyncStorage);

export const WalletSDKContext = React.createContext<WalletSDKContextProps>({
  documents: [],
  status: 'loading',
  createWallet: async () => {},
  toggleTestMode: async () => {},
  refetch: async () => {},
});

setStorage(AsyncStorage);

export {useDIDManagement};
export {useCredentialUtils, useCredentialStatus};
export {useDocument, useDocuments} from './documentsHooks';
export {useCredentialContext} from './credentials/CredentialContext';

export function getStorage() {
  return AsyncStorage;
}

export const filterDocsByType = (type: DocumentType) => doc =>
  doc.type === type;
export const filterByIds = idList => doc => idList.find(v => v === doc.id);
export const findDocument = (address, documents) =>
  documents.filter(doc => doc.id === address)[0];
export const findRelatedDocs = (document, documentList) =>
  document && document.correlation
    ? documentList.filter(doc => document.correlation.find(id => id === doc.id))
    : [];

export function useWallet() {
  return useContext(WalletSDKContext);
}

export function _useWalletController() {
  const [wallet, setWallet] = useState<IWallet>();
  const [status, setStatus] = useState<WalletStatus>('loading');
  const [documents, setDocuments] = useState<WalletDocument[]>([]);
  const [firstFetch, setFirstFetch] = useState(false);
  const [networkId, setNetworkId] = useState<string>();

  const testMode = networkId === wallet?.dataStore?.testNetworkId;

  const toggleTestMode = async () => {
    if (!wallet) return;

    await wallet.setNetwork(
      testMode
        ? wallet.dataStore.mainNetworkId
        : wallet.dataStore.testNetworkId,
    );
  };

  useEffect(() => {
    if (firstFetch) {
      return;
    }

    if (documents.length > 0 || !wallet) {
      return;
    }

    setFirstFetch(true);

    wallet.getAllDocuments().then(setDocuments);
  }, [documents, wallet, firstFetch]);

  const refetch = useCallback(
    async () => {
      if (!wallet) return;
      try {
        const allDocs = await wallet.getAllDocuments();
        setDocuments(allDocs);
      } catch (err) {
        console.error(err);
      }
    },
    [wallet, setDocuments],
  );

  useEffect(() => {
    if (!wallet) {
      return;
    }

    const _refetch = debounce(refetch, 100);

    setNetworkId(wallet.getNetworkId());

    wallet.eventManager.on(WalletEvents.statusUpdated, setStatus);
    wallet.eventManager.on(WalletEvents.networkUpdated, () => {
      _refetch();
      setNetworkId(wallet.getNetworkId());
    });
    wallet.eventManager.on(WalletEvents.ready, _refetch);
    wallet.eventManager.on(WalletEvents.documentAdded, _refetch);
    wallet.eventManager.on(WalletEvents.documentRemoved, _refetch);
    wallet.eventManager.on(WalletEvents.documentUpdated, _refetch);
    wallet.eventManager.on(WalletEvents.walletImported, _refetch);
    wallet.eventManager.on(WalletEvents.walletDeleted, () => {
      setDocuments([]);
    });
  }, [status, wallet, refetch]);

  const createWallet = async (configs?: DataStoreConfigs) => {
    const newWallet = await getOrCreateWallet(configs);
    setWallet(newWallet);
  };

  return {
    wallet,
    createWallet,
    toggleTestMode,
    testMode,
    documents,
    status,
    refetch,
  };
}

export function WalletSDKProvider({onError, customUri, children, onReady, configs, debug}) {
  const controller = _useWalletController();
  const webViewRef = useRef();
  const sandboxWebViewRef = useRef();
  const baseUrl =
    Platform.OS === 'ios' ? 'app-html' : 'file:///android_asset/app-html';

  const {createWallet} = controller;

  const handleReady = useCallback(async () => {
    await createWallet(configs);
    if (onReady) {
      onReady();
    }
  }, [onReady, createWallet, configs]);

  const eventHandler: WebviewEventHandler = useMemo(
    () =>
      new WebviewEventHandler({
        webViewRef,
        sandboxWebViewRef,
        debug,
        onReady: handleReady,
      }),
    [webViewRef, handleReady],
  );

  const webviewContainer = (
    <WebView
      style={{
        height: 0,
      }}
      ref={webViewRef}
      webviewDebuggingEnabled={debug}
      originWhitelist={['*']}
      allowFileAccessFromFileURLs={true}
      allowUniversalAccessFromFileURLs={true}
      source={
        customUri
          ? {
              uri: customUri,
            }
          : {
              uri: `${baseUrl}/index.html`,
            }
      }
      onError={err => {
        console.log(err);
        if (onError) {
          onError(err);
        }
      }}
      onMessage={event => {
        eventHandler.handleEvent(event);
      }}
      javaScriptEnabled={true}
    />
  );

  const sandboxContainer = (
    <WebView
      style={{
        height: 0,
      }}
      webviewDebuggingEnabled={debug}
      ref={sandboxWebViewRef}
      originWhitelist={['*']}
      allowFileAccessFromFileURLs={true}
      allowUniversalAccessFromFileURLs={true}
      source={{
        uri: `${baseUrl}/sandbox.html`,
      }}
      onError={err => {
        console.error(err);
        if (onError) {
          onError(err);
        }
      }}
      onMessage={event => {
        eventHandler.handleSandboxEvent(event);
      }}
      javaScriptEnabled={true}
    />
  );

  return (
    <View flex={1}>
      <WalletSDKContext.Provider value={controller}>
        <CredentialProvider>
          {children}
        </CredentialProvider>
      </WalletSDKContext.Provider>
      <View style={{height: 0}}>
        {webviewContainer}
        {sandboxContainer}
      </View>
    </View>
  );
}
