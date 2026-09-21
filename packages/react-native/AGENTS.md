# packages/react-native — AGENTS.md

## Purpose

`@docknetwork/wallet-sdk-react-native` is the React Native binding for the SDK: React
hooks/components (`useWallet`, DID/document hooks, biometric plugins) that a host RN app imports
directly, plus a bundled WebView runtime that runs the actual wasm/crypto work off the RN JS
thread.

## Entry Point & Stack

TypeScript/JavaScript, `react-native` as a peer dependency. See `package.json` for the current
version — it depends on `core`, `data-store-typeorm`, `dids`, and `wasm`.

## Non-obvious mechanism: two separate "build" steps

- **`lib/` is hand-written source, not build output.** Unlike every other package in this repo,
  `lib/` here is checked-in React hooks/components (`lib/wallet.ts`, `lib/index.tsx`,
  `lib/didHooks.js`, `lib/credentials/CredentialContext.tsx`, …) consumed as-is by the host app's
  Metro bundler. This is why `package.json`'s `"build"` script is a no-op
  (`echo 'add build script when required'`) — there is nothing to compile for this half of the
  package.
- **`bundler/` builds the WebView runtime.** `npm run build:all` (`bundler/build-and-copy.js`)
  runs Rollup (`bundler/rollup.config.mjs`) to produce `sandbox.js` and `bundle.js` — the wasm
  wallet logic bundled to run inside a hidden WebView — then copies them into RN assets
  (`bundler/copy-rn-assets.js`). This is the mechanism the external `dock-app` repo depends on:
  its `build-sdk` script calls `bundler/build-and-copy.js` directly
  (`../wallet-sdk/packages/react-native/bundler/build-and-copy.js`). Do not rename or move
  `bundler/build-and-copy.js` without checking `dock-app` first.

## Local commands

```bash
cd packages/react-native
npm test              # jest — only lib/**/*.test.js runs here (root jest.config.js excludes
                       # this package's .test.ts files; see its own jest.config.js)
npm run build:bundle    # build the WebView bundle only (bundler/build.js)
npm run build:all       # build the WebView bundle and copy it into RN assets
npm run test:bundle     # playwright test — exercises the built bundle (bundler/test/)
npm run dev              # bundler/server.js, a dev server for the WebView bundle
```

## Tests

Co-located `*.test.js`/`*.test.ts` under `lib/` (e.g. `lib/wallet.test.ts`,
`lib/didHooks.test.ts`) run via this package's own `jest.config.js`. Separately,
`bundler/test/bundle.test.js` is a Playwright test (`npm run test:bundle`) that loads the built
bundle in a browser — not part of the root Jest run.

## See also

[Root AGENTS.md](../../AGENTS.md)
