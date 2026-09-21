# packages/wasm — AGENTS.md

## Purpose

`@docknetwork/wallet-sdk-wasm` is the crypto and blockchain integration layer: it wraps the Cheqd
blockchain SDK (`@docknetwork/cheqd-blockchain-api`/`-modules`), `@docknetwork/credential-sdk`,
OID4VCI/OID4VC, SD-JWT, and the delegation engine behind the SDK's own service/module interfaces.
It is the largest package by file count and the dependency every other `packages/*` workspace
(directly or transitively) sits on.

## Entry Point & Stack

TypeScript/JavaScript under `src/{core,wallet,modules,services,test}`. Built either with Rollup
(`npm run build`, the default) or plain Babel (`npm run build:babel`) — see `package.json` for
which one CI/consumers actually rely on and for the current dependency versions (several
`@docknetwork/*` deps are pinned to exact versions here, not ranges).

## Local commands

```bash
cd packages/wasm
npx jest              # this package has no "test" script in package.json — run jest directly,
                       # or use the root `npm test` which includes it
npm run build          # rollup -c, then fix-build-imports.js
npm run docs:jsdoc      # jsdoc -c jsdoc.conf.json -r src/
```

## Tests

Co-located `*.test.{js,ts}` beside each source file (e.g. `src/services/credential/oid4vci.test.js`,
`src/core/validation.test.js`); `src/test/fixtures/` holds shared fixture data, not specs. Picked
up by the root Jest run and counted toward the root coverage thresholds
(`coverage-thresholds.json`).

## See also

[Root AGENTS.md](../../AGENTS.md)
