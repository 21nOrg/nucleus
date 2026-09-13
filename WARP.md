# Repository guide

`AGENTS.md` is the governing agent policy. Read it before changes. The current architecture is documented in [client boundaries](docs/architecture/client-boundaries.md) and [type ownership](docs/architecture/type-ownership.md).

## Organization

- `schema/`: cross-layer product/resource definitions, wire contracts, and legacy serialization contracts.
- `client/datafn/`: client storage, queries, sync, and DataFn resource adapters.
- `client/runtime/`: UI-independent auth/account transport, connectivity, logging, native messaging, audio, and inference.
- `client/features/`: shared capabilities such as memory, focus, calendar, collections, and spaces.
- `client/products/`: product-specific composition, configuration, and integrations.
- `client/config/`: client product identity, navigation metadata, and command identifiers.
- `client/application/`: commands, account/subscription workflows, settings, and mixed-resource presentation.
- `client/layout/`: app shells, URL/history navigation, tabs, sidebar, and menu customization.
- `client/stores/`: shared reactive state, persistence preferences, file handling, and permanent composition contracts.
- `client/elements/`, `client/components/`, `client/actions/`: reusable controls, presentation, and generic DOM behavior.
- `client/persistence/`: persistence helpers and legacy backup/recovery boundaries.
- `services/account/`: AuthFn/DataFn account service, database mappings, lookup integrations, and Node/Worker deployments.
- `shared/`: cross-layer utilities and remaining legacy database objects.
- `apps/`, `extensions/`: deployable product and extension bundles; `apps/e2e-playwright` owns browser verification.

There is no global `client/types` or `shared/types` package. Import contracts from their domain owner. The unused `@nucleum/cx` workspace is retired.

## Composition rules

App state does not implement navigation or command execution. Layout navigation changes URL/history; the application command runner executes product commands. Application and extension shells install command, overlay, resource, renderer, shortcut, and recents hosts through `client/application/composition/resource-hosts.ts` before mounting consumers.

Use direct imports after moves, without compatibility wrappers. Shared runtime code must not transitively load capability or application implementations. Features use declared public entries when consuming another capability. Source aliases do not enforce package exports, so run the architecture checker.

## Commands

Run commands from the repository root using npm workspaces and Turbo:

```sh
npm ci --legacy-peer-deps
npm run dev:nucleus
npm run dev:memotron
npm run dev:pointron
npm run check:architecture
node tools/check/type-ownership.mjs
npm run check:apps
npm --workspace @21n/account-service run typecheck
npm run test
npm run lint
npm run build:nucleus
npm run build:memotron-share
```

Use the Caddy HTTPS hosts and account-service health checks in `AGENTS.md` for local browser work. Run one product server and browser worker at a time when practical. Do not treat compiler success as browser, cloud, native-device, or deployment proof.

## Database changes

Regenerate DataFn mappings with the account-service scripts. Generate and commit a forward migration for physical schema changes; never edit an applied migration. Deployment executes the checked-in migration journal. A successful local `datafn:push:local` does not prove that deployment migrations are complete.

## Review and delivery

Preserve unrelated checkout changes. Review product configuration and callers before editing. Follow the existing-test and user-facing behavior approval rules in `AGENTS.md`. Keep code free of inline comments and document exported APIs with JSDoc. PR descriptions must identify changed behavior, relevant verification, and unverified environments.
