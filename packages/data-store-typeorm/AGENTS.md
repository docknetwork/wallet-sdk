# packages/data-store-typeorm — AGENTS.md

## Purpose

`@docknetwork/wallet-sdk-data-store-typeorm` is the TypeORM-backed implementation of the
`DataStore` interface defined in `packages/data-store` — persistent (SQLite via `sqlite3` by
default) storage for wallet documents. It is the storage backend `packages/react-native` and
`packages/cli` use.

## Entry Point & Stack

TypeScript, built with `tsc` to `lib/` (see `package.json` for the current version). Uses
`typeorm` as a peer dependency and includes its own migrations under `src/migrations` /
`src/migration` plus a `src/migrations-data-source.ts` for running them.

## Local commands

```bash
cd packages/data-store-typeorm
npm test            # jest, this package only
npm run build         # tsc -p tsconfig.build.json, then fix-build-imports.js
```

## Tests

`src/__tests__/` (e.g. `index.test.ts`, `v1-data-store.test.ts`) plus a co-located
`src/entities/document/document.entity.test.ts`. Picked up by the root Jest run and counted
toward the root coverage thresholds.

## See also

[Root AGENTS.md](../../AGENTS.md)
