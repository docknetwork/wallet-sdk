# Truvera Wallet SDK

The [Wallet SDK](https://github.com/docknetwork/wallet-sdk) enables you to build an identity wallet inside your app and allows your users to receive, store, and manage verifiable credentials.

To use the wallet-sdk, all you need to do is wrap your app in a `WalletSDKProvider` and start building your wallet.

The Truvera Mobile SDK supports:
- Devices that have Android 8.1 or higher and iOS 11 or higher.
- Minimum supported version of Node.js is 20.2.0

## Installation
```js
npm install @docknetwork/wallet-sdk-core
npm install @docknetwork/wallet-sdk-react-native

```
**There are some scripts and additional dependencies required.**
Please check our [examples](https://github.com/docknetwork/wallet-sdk/tree/master/examples) folder for detailed steps.

## React Native example
The following example will create a wallet and allow the user to add credentials to it, displaying the count of documents added to the wallet.
Notice that all documents are accessible through the `documents` object.

```js
import {Box, Button, NativeBaseProvider, Text} from 'native-base';
import React, {useEffect} from 'react';
import {
  WalletSDKProvider,
  useWallet,
} from '@docknetwork/wallet-sdk-react-native/lib';

const WalletDetails = function () {
  const {wallet, status, documents} = useWallet();

  return (
    <Box>
      <Text>Wallet status: {status}</Text>
      <Text>Wallet docs: {documents.length}</Text>
      <Button onPress={() => wallet.addDocument({
        name: 'my credential',
        type: 'VerifiableCredential',
      })}>
        <Text>Add Credential</Text>
      </Button>
    </Box>
  );
};

const App = () => {
  return (
    <NativeBaseProvider>
      <WalletSDKProvider>
        <Box p={8}>
          <Text>Dock Wallet SDK Demo</Text>
          <Text>Press on `add credential` button to create a new credential</Text>
        </Box>
        <WalletDetails />
      </WalletSDKProvider>
    </NativeBaseProvider>
  );
};

export default App;

```


## Documentation

The [Truvera Documentation Portal](https://docs.truvera.io) aggregates documentation for all components of the Truvera Platform. Documentation specific to the Wallet SDK is mirrored from [the GitHub repository](https://github.com/docknetwork/wallet-sdk). Node package reference documentation is also published on [GitHub.io](https://docknetwork.github.io/wallet-sdk/).

For more details you should read [the getting started guide](https://github.com/docknetwork/wallet-sdk/blob/master/docs/getting-started.md).


### Key features
- [Biometric Plugin](https://github.com/docknetwork/wallet-sdk/blob/master/docs/biometric-plugin.md)
- [Ecosystem Tools](https://github.com/docknetwork/wallet-sdk/blob/master/docs/ecosystem-tools.md)
- [Cloud Wallet](https://github.com/docknetwork/wallet-sdk/blob/master/docs/cloud-wallet.md)


### Running on other platforms

[The examples directory](https://github.com/docknetwork/wallet-sdk/tree/master/examples) contains detailed examples for running the Truvera Wallet SDK on NodeJS, Web, and Flutter.
