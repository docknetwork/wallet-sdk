# Other topics

## Using WebAssembly

React native doesn't support WebAssembly. Libraries that require WebAssembly need to run in a WebView. This includes some components of the wallet-sdk. Messages are exchanged with the React Native thread through a JSON RPC client / server layer. The Wallet SDK can be used to abstract all the complexity of the WebView communication with the react-native thread.

The WebView is similar to a REST API, and its entry point is in the wallet-sdk-wasm package. Each module in the package has a service-rpc client to interact with the service.js that is running in the main thread (React Native):

`@docknetwork/wallet-sdk-wasm/lib/services/[moduleName]/service-rpc`
interacts with
`@docknetwork/wallet-sdk-wasm/lib/services/[moduleName]/service.js`

Notice that the `modules` folder is running in the main thread (React Native) and will be using the JSON RPC client (`@docknetwork/wallet-sdk-core/lib/client`) to interact with `@docknetwork/wallet-sdk-core/lib/service` methods.
