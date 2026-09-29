# packages/core — AGENTS.md

## Purpose

`@docknetwork/wallet-sdk-core` is the wallet orchestration layer: wallet lifecycle, credential
storage/lifecycle, DID management, message handling (DIDComm), and presentation/verification. It
is the API that platform bindings (`react-native`, `web`, `cli`) build on.

## Entry Point & Stack

TypeScript (some `.js`/`.test.js` still present), built with `tsc` to `lib/` (see `build` in
`package.json`). See `package.json` for the current version and dependency ranges — it depends
on `@docknetwork/wallet-sdk-wasm` and peer-depends on `@docknetwork/wallet-sdk-data-store`, so a
storage backend must be supplied by the consumer.

## Local commands

```bash
cd packages/core
npm test            # jest, this package only
npm run build        # tsc -p tsconfig.build.json, then fix-build-imports.js
npm run docs          # regenerate this package's jsdoc reference into ../../docs/api (generate-docs.js)
```

## Tests

Co-located `*.test.ts`/`*.test.js` beside each source file (e.g. `src/wallet.test.ts`,
`src/credential-provider.test.ts`). Also picked up by the root Jest run
(`npm test` at the repo root) and counted toward the root coverage thresholds.

## See also

[Root AGENTS.md](../../AGENTS.md)
