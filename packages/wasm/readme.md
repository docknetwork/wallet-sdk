# @docknetwork/wallet-sdk-wasm

## Storage in Node.js

The WASM package keeps some data in `localStorage` (e.g. the DID resolution cache). In Node.js there is no native `localStorage`, so it falls back to [`node-localstorage`](https://www.npmjs.com/package/node-localstorage), which persists to a `./local-storage` directory relative to the current working directory.

To store it elsewhere, set the `LOCAL_STORAGE_PATH` environment variable:

```bash
export LOCAL_STORAGE_PATH=/path/to/local-storage
```
