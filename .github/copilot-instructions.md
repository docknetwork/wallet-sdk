# Code review checklist

`@docknetwork/wallet-sdk`: npm-workspaces monorepo (`packages/*`, versioned with Lerna) for
Truvera's identity wallet SDK. Each package publishes independently to npm. `wasm` is the base
most packages depend on; `core` builds the wallet API on it; `react-native`, `web` and `cli` are
platform bindings. Source of these rules: `AGENTS.md`. Keep both in sync.

## Flag as high priority

- **Cross-package contracts:** changes to `wasm`'s public exports or the `DataStore` interface in
  `data-store` without updating every consumer in the same PR — `wasm`: `core`, `data-store`,
  `data-store-typeorm`, `data-store-web`, `relay-service`, `react-native`; `DataStore`: `core`,
  `data-store-typeorm`, `data-store-web`, `react-native`, `web`, `cli`. Breaking changes need bumped internal
  `dependencies`/`peerDependencies` ranges.
- **Public API breaks:** these are published npm packages used by external apps (including
  `dock-app` via `packages/react-native`). Flag removed or changed exports and signatures.
- **Secrets:** committed `.env` files (only `.env.example` belongs in git), hardcoded keys or
  mnemonics, or secrets, private keys or credential contents written to logs.
- **Versions/release:** manual edits to `packages/*/package.json` versions (use
  `npm run bump-version`), or changes to `.github/workflows/npm-publish.yml` and other
  release-triggering workflows.
- **Lockfile:** `package-lock.json` changes not tied to an intentional dependency change.
- **Build artefacts** committed: `lib/`, `dist/`, `coverage/`, `reports/`, `node_modules/`.
  Exception: `packages/react-native/lib/` and `packages/request-logger/lib/` are checked-in source.

## Checklists that get forgotten

- New runtime dependency: flag it; should be justified. Licenses must not be AGPL/GPL.
- New package: named `@docknetwork/wallet-sdk-<name>`, added to `scripts/build.sh` if others
  depend on it, and to the `npm-publish.yml` publish loop if it should be published.
- Changes to `examples/` should be called out for explicit reviewer sign-off.

## Code conventions

- Prefer `async/await` with `try/catch` over `.then/.catch` chains.
- Core domain logic follows `<domain>-provider.ts` / `<domain>-controller.ts`, mirroring
  `packages/core/src/credential-provider.ts`.
- Reuse existing providers, helpers and storage backends instead of re-implementing them.
- Changes unrelated to the PR's purpose should be split out.

## Tests

- Tests co-located as `<file>.test.ts` (or `.test.js`) beside the source, or under `__tests__/`
  where the package already does that.
- Mock blockchain, network and storage dependencies in unit tests; real-service tests belong in
  `integration-tests/`.
- Bug fixes and new branches in logic should come with a test.
