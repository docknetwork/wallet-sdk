# packages/cli — AGENTS.md

## Purpose

`@docknetwork/wallet-sdk-cli` is a Node CLI for exercising the SDK outside a host app — driving
`core` + `data-store` (TypeORM/SQLite) from the terminal, plus standalone BBS
verification/revocation scripts.

## Entry Point & Stack

`src/index.ts`, run via `ts-node` (no compile step — see `package.json` for the current
version). Depends on `@docknetwork/wallet-sdk-core` and `@docknetwork/wallet-sdk-data-store`.

## Local commands

```bash
cd packages/cli
npm run cli              # ts-node src/index.ts — interactive CLI (src/commands/)
npm run test:bbs          # ts-node src/bbs-verification.ts
npm run test:revocation   # ts-node src/bbs-revocation.ts
```

There is no `build` or `test` script in this package's `package.json`, and `scripts/build.sh` at
the repo root does not build it — it ships as TypeScript run directly through `ts-node`.

## Tests

None. No `*.test.*` files exist under `src/`, and this package is excluded from the root Jest
coverage collection (`!packages/cli/**` in the root `jest.config.js`). Treat as a coverage gap.

## See also

[Root AGENTS.md](../../AGENTS.md)
