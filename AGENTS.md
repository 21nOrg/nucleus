
# Tidigit Constitution

## Core Principles

### I. Product Context First
Agents MUST confirm the active product context before touching UI or workflow code. They MUST inspect `client/products/*` configurations and `$appStore.product` to respect feature gates and product-specific behaviors. Rationale: enforcing product awareness prevents regressions across Nucleus, Memotron, Pointron, and future bundles.

### II. Reuse Shared System
Agents MUST reuse existing primitives, stores, and utilities when delivering changes. Prefer components in `client/elements/`, helpers such as `generateResourceId` and `generateSimpleRandomId`, and shared logic in `client/stores` or `shared/utils` instead of duplicating behavior. Rationale: reuse keeps the monorepo coherent and avoids parallel implementations that drift over time.

### III. Safe State & Data Handling
Agents MUST persist preferences with the correct `Preference` enums, sub-variable scopes, and helper APIs. Frontend persistence MUST use the current DataFn runtime and shared resource stores (`client/datafn/`, `client/features/`, and `schema/`) while respecting legacy local persistence, Dexie, and backup/recovery boundaries under `client/persistence`. Remote synchronization MUST align with the account-service DataFn routes, schemas, generated Drizzle mappings, and lookup helpers under `services/account/src/datafn`, `services/account/src/db`, and `services/account/src/lookup`. Rationale: disciplined state management keeps local stores, DataFn sync state, and account-service records consistent across clients and services.

### IV. Verified Delivery via Repo Workflows
Agents MUST run repository scripts (`npm run dev`, targeted Turbo commands, lint, and tests) that correspond to touched surfaces, and document verification steps alongside changes. Code MUST remain free of inline comments while using JSDoc comments for exported symbols, public APIs, and non-obvious functions. Svelte components MUST follow established structure (script, markup, style). Rationale: shared workflows and TDD discipline keep quality high and reproducible.

### V. Security & Secrets Discipline
Agents MUST prevent exposure of credentials or sensitive data. Environment configuration MUST rely on documented variables such as `VITE_PRODUCT`, `VITE_STATIC_URL`, `VITE_ACCOUNT_BASE_URL`, `VITE_ACCOUNT_BASE_URL_TEMPLATE`, `ACCOUNT_*`, `AUTHFN_*`, `DATAFN_*`, `DEBUG_SINK_URL`, `DEBUG_SINK_WRITE_TOKEN`, and cloud credentials required by deployment or lookup integrations. Storage, auth, sync, and observability integrations MUST use vetted helpers in `services/account`, `schema`, `client/datafn`, and Superfunctions packages instead of ad-hoc secret handling. Rationale: consistent security practices safeguard users and hosting environments.

## Onboarding Checklist

### Orientation
- Review `README.md`, `CONTRIBUTING.md`, and `WARP.md` before making changes.
- Recognize the monorepo layout:
  - `client/`: SvelteKit frontends, shared UI primitives, features, and product composition.
  - `client/features/`: Multi-product capabilities (`@nucleum/features`).
  - `client/datafn/`: Client DataFn runtime (`@nucleum/datafn`).
  - `client/application/`: Product command execution, account/subscription workflows, settings, and composed resource presentation.
  - `client/layout/`: Navigation, tabs, sidebar behavior, and application shells.
  - `client/runtime/`: UI-independent browser transport, account authority, native messaging, inference, and logging.
  - `client/config/`: Client product identity, declarative navigation metadata, and command identifiers.
  - `client/stores/`: Shared reactive state and permanent shell contracts; domain workflows belong with their owner.
  - `services/account/`: account-service AuthFn, DataFn, SearchFn, debug-sink, local Node, and Cloudflare Worker integrations.
  - `schema/`: Product and DataFn schema (`@nucleum/schema`).
  - `shared/`: Cross-layer types and utilities.
  - `apps/`: Deployable product bundles and e2e Playwright harnesses (Memotron, Pointron, Nucleus, Timear, and `apps/e2e-playwright`).
  - `deployment/`: Infrastructure scripts and CDK stacks.
- Confirm product context through `client/products/*` configurations and `$appStore.product` usage before editing UI flows.

### Ownership and composition
- Read `docs/architecture/client-boundaries.md` and `docs/architecture/type-ownership.md` before changing package ownership or imports. Their current-contract sections are authoritative; historical validation records describe earlier snapshots.
- Keep generic DOM actions in `client/actions`; place capability-specific actions beside their consumer. Do not retain empty workspaces or aliases without implemented exports.
- Keep app state in `client/stores/app.store.ts`. Navigation belongs in `client/layout/navigation`; command execution belongs in `client/application/commands`. Shared consumers use the permanent command-host contract configured by the application shell.
- Account state must not own file processing, deletion confirmation, or subscription workflows. Shared uploads belong in `client/stores/files`, and user workflows belong in `client/application/account` or `client/application/subscription`.
- Keep generic UI-state persistence shared; tabs, sidebar behavior, and product menu customization belong with their layout. Focus owns its scheduled notifications; runtime owns native message delivery.
- Update all callers directly when moving a module. Do not add compatibility re-exports or duplicate entry points. Update feature exports, dependency declarations, retirement rules, and type-inventory destinations with the move.
- Run `npm run check:architecture` and `node tools/check/type-ownership.mjs` for ownership changes. Passing import checks does not replace reviewing semantic ownership or testing workflows.
- Regenerated DataFn mappings must ship with a forward migration when physical database definitions change. Verify both a fresh database and upgrading the checked-in migration history.

### Tooling & Commands
- Use npm workspaces and Turbo tasks; run `npm run dev`, `npm run build`, or filtered commands such as `npm run dev:nucleus` and `npm run build:pointron` when verifying changes.
- Prefer repository scripts over ad-hoc commands to mirror how existing apps are started, built, and tested.

### Local Debugging & Observability
- Use Caddy HTTPS product hosts for browser debugging, not raw localhost, unless the task explicitly targets localhost behavior:
  - Nucleum: `https://local.nucleum.app` -> `localhost:5050`.
  - Pointron: `https://local.pointron.app` -> `localhost:5001`.
  - Memotron: `https://local.memotron.app` -> `localhost:5002`.
- Before diagnosing a local app screen as a frontend bug, verify the account backend is reachable through Caddy. For Nucleum local single-region debugging, start the account service with:
  ```bash
  npm --workspace @21n/account-service run dev:local
  ```
- For cloud-user, login, local-sync, or DataFn failures, check the Caddy-fronted account endpoints first:
  ```bash
  curl -k -i https://account-insouth-local.nucleum.app/auth/session
  curl -k -i -X OPTIONS https://account-insouth-local.nucleum.app/datafn/query \
    -H 'Origin: https://local.nucleum.app' \
    -H 'Access-Control-Request-Method: POST'
  ```
  Healthy local signals include `/auth/session` returning an HTTP response from the account service, DataFn preflights returning `204`, and `access-control-allow-origin: https://local.nucleum.app`.
- Do not confuse the local account API upstream with the debug-sink upstream:
  - `https://account-insouth-local.<product-domain>/debug-sink/*` routes to `localhost:8790`.
  - Normal `/auth/*` and `/datafn/*` account-service traffic routes to `localhost:8787` for `insouth`, `localhost:8788` for `useast`, and `localhost:8789` for `euwest`.
  A `502` on `/auth/session` or `/datafn/*` usually means the account service is not running on the expected account upstream, not that the debug sink is down.
- Debug-sink logging is diagnostic-only and MUST NOT be required for auth or sync behavior. The account service sends debug logs through `DEBUG_SINK_URL` and optional `DEBUG_SINK_WRITE_TOKEN`; production sends nothing without a token. The sink redacts common sensitive fields, but agents MUST still avoid adding logs that expose raw credentials, cookies, OTPs, OAuth codes, tokens, email addresses, private keys, or user content.
- When investigating login, sync, OAuth, or DataFn failures, collect evidence in this order:
  1. Browser console and network status for `/auth/session`, `/auth/regions/lookup`, `/datafn/query`, `/datafn/pull`, `/datafn/push`, and `/datafn/search`.
  2. Account-service terminal logs from `dev:local`.
  3. Caddy route health and upstream port checks.
  4. Database assertions only after the request path is known to be reaching the expected backend.
- For Chrome-extension manual QA, keep using `https://local.nucleum.app` so saved auth state, cookies, CORS, and account authority resolution match the product runtime. Treat raw `http://localhost:5050` auth-shell failures as suspect until reproduced on the local HTTPS product host.

### Coding Standards
- Default to TypeScript, Svelte, and Tailwind conventions already present in the repo.
- Match existing Svelte component organization: `<script lang="ts">`, markup, then `<style>` if needed, with shared logic kept in stores or utilities.
- Keep code free of inline comments per repository policy.
- Add concise JSDoc comments for exported symbols, public APIs, and functions whose purpose or constraints are not immediately obvious from the implementation.
- Honor accessibility and UX patterns by reusing primitives from `client/elements/` and shared stores such as `preferences` and `appStore`.
- Follow naming conventions (`camelCase` for functions, `PascalCase` for components, enums colocated with their owning feature, primitive, runtime, or schema).

### Frontend Guidelines
- When editing preferences, use `preferences.save` with the correct `Preference` enum and scoped variables to avoid clobbering user settings.
- Memoize IDs with helpers such as `generateResourceId` and `generateSimpleRandomId` instead of introducing new randomization logic.
- Handle markdown or node manipulation through utilities like `generateMarkdownText` and `NodularMarkdown` instead of new pipelines.
- Respect feature gating via product checks, including comparisons against `Product.NUCLEUM` and `Product.MEMOTRON`.

### Backend & Shared Code
- Backend modules under `services/account/` own AuthFn, account routing, DataFn sync/search, delivery, rate limits, observability, and local/Worker runtime wiring; reuse helpers in `services/account/src`, `schema`, `shared/utils`, and Superfunctions packages instead of duplicating logic.
- When debugging account/auth/DataFn behavior, inspect `services/account/src/app.ts`, `services/account/src/auth.ts`, `services/account/src/debug-sink.ts`, `services/account/src/datafn/`, and `schema/` before changing frontend code.
- Update generated DataFn/Drizzle mappings, schema definitions, and migrations carefully, and coordinate application-side schema expectations with `schema/datafn.ts`.
- Keep shared types with their domain owner in `schema`, `client/features`, `client/runtime`, or `client/datafn`, aligning serialization logic with these definitions before modifying APIs.
- Fix account-service, AuthFn, DataFn, SearchFn, or Superfunctions bugs at their source package rather than masking them in product UI code.

### Testing & Verification
- Run relevant Turbo tasks such as `npm run test`, `npm run lint`, or targeted `turbo run <task> --filter=<project>` after significant changes.
- For UI work, consider Storybook or component-specific verification when available; otherwise smoke test the affected product app.
- Document manual verification steps in pull requests when automated coverage is lacking.

### End-to-End Test Organization
- Organize Playwright suites by shared product capability when the same behavior exists in multiple products. Capability suites such as `tests/focus/` and `tests/memory/` MUST run through product projects and model real product differences through E2E contracts instead of duplicated product-specific specs.
- Keep cross-cutting capability workflows at the capability root and group resource-specific workflows in plural resource directories such as `nodes/`, `objectives/`, and `tasks/`. Resource test directories MUST use plural names.
- Keep a scoped spec at the capability root unless more than two test files clearly belong to the same subdomain. Do not create a nested directory such as `settings/` for one or two specs; use root files such as `settings.spec.ts` instead.
- Centralize repeated capability setup and user workflows in a root helper such as `memory-test-helpers.ts` or `focus-test-helpers.ts`. Keep feature-specific assertions and editor interactions in their owning spec rather than growing a generic helper with unrelated behavior.
- Seed durable precondition state through the E2E DataFn seed fixture (`seed.focus`, `seed.memory`, `seed.collections`) when that state is not the behavior under test. Prefer seed options such as `isPinnedForQuickFocus`, `objectiveId`, and `parentId` over command-bar or panel setup for fixtures. Keep creation, Capture, pin, link, or other setup UI only when that UI path or its side effects is what the test asserts.
- Use Playwright tags only for cross-cutting selection that folder or file paths cannot express. Keep tags such as `@smoke`, `@context-menu`, `@bulk-editor`, `@record-page`, `@creation`, `@browse`, `@settings`, and `@auth`. Do NOT add tags that mirror a directory or file (for example `@focus-feature`, `@session-items`, `@presets`) or capability-scoped smoke/feature aliases such as `@focus-smoke` or `@memory-feature`; select those suites with paths (`tests/focus/`, `tests/focus/active-session/session-items.spec.ts`) and combine with `@smoke` when needed (`tests/focus/ --grep @smoke`).
- Assert immediate user-visible outcomes directly after UI actions: verify the resulting resource, selected bucket, or visible product surface. An action completing, a toast appearing, a store or runtime mutation, or a search result matching is not sufficient proof when stronger visible-state evidence is available.
- Assert DOM readiness and visibility with Playwright web-first locator assertions so UI mode and trace snapshots record the asserted element. For any-of readiness, use `expectAnyLocatorVisible`; for correlated UI conditions, use `expect(...).toPass()` with locator assertions inside. Do not poll `locator.isVisible()` or `locator.isHidden()` booleans.
- Use `expect.poll` only for non-DOM values such as runtime state, persistence, URLs, browser APIs, or serialized collections. Retained polls MUST include a diagnostic `message`; when the polled state has a user-visible consequence, follow it with a direct locator assertion.
- When a workflow writes data that is expected to persist, Playwright tests MUST make both assertions in order: first verify the immediate visible UI feedback, then cross a persistence boundary by closing and reopening the owning page or panel or by reloading the app and navigating back, and verify the durable data again. Do not remove the immediate UI assertion when adding persistence coverage; neither immediate in-memory state nor the post-reopen assertion substitutes for the other.
- Prefer accessible roles, stable test IDs, E2E surface contracts, resource contracts, and shared navigation helpers over CSS structure or product-name branching. Avoid fixed waits where a locator, URL, or persisted-state condition can be awaited.
- Keep specs cohesive and split them when unrelated workflows make ownership or failure diagnosis unclear. Do not copy large specs, repeated route setup, or fallback chains into new resource suites when a shared helper or contract can express the behavior once.

### Workflow Discipline
- Plan work with TODO tracking when tasks involve multiple steps, and close items as progress is made.
- Prefer absolute paths for tooling interactions to avoid ambiguity in the monorepo.
- Use repository-aware tooling, including ripgrep and apply_patch, rather than manual edits that bypass formatting expectations.

### Safety & Secrets
- Never commit environment secrets; rely on documented environment variables such as `VITE_PRODUCT`, `VITE_STATIC_URL`, account-service `ACCOUNT_*` / `AUTHFN_*` / `DATAFN_*` settings, and debug-sink `DEBUG_SINK_*` settings.
- Treat user data and analytics integrations cautiously; consult existing stores or services before changing persistence behavior.

### Additional References
- `WARP.md` for automation policies, CLI workflows, and PR review expectations.
- `deployment/README.md` for infrastructure deployment steps.
- Product-specific docs or configs within `client/products/` for feature toggles and navigation.
- Tests under `tests/`, `apps/e2e-playwright/tests/`, package-local `*.test.ts` files, and fixtures such as `apps/e2e-playwright/tests/fixtures/` to understand existing coverage.
- Always validate assumptions by reading nearby code before rewriting patterns, and ask for clarification when unsure.

## Operational Constraints

- Maintain ASCII-only edits unless files already contain extended characters, never introduce inline comments when modifying code, and prefer JSDoc comments for symbol or function documentation.
- During migrations or refactors, agents MUST NOT introduce intermediary scaffolding, compatibility shims, bridge layers, duplicate config/schema entrypoints, or temporary wrapper APIs unless the user explicitly asks for them. Replace old patterns directly with the target architecture, remove obsolete callers and files in the same change, and stop to ask if a temporary bridge appears unavoidable.

### Non-Negotiable Change Rules

- Any agent fixing issues or bugs, or working on new features, MUST NOT modify existing Playwright or unit tests unless the master explicitly permits each modification.
- Agents MUST NOT modify user-facing UI or functionality unless the master explicitly confirms the change.
- Agents MAY add new Playwright or unit tests when working on new features.

## Workflow Expectations

- Perform code discovery before changes to avoid reimplementing behavior and to understand adjacent systems, especially `client/datafn/`, `client/features/`, `schema/`, `client/persistence`, and `services/account/src/datafn`.
- Align UI updates with accessibility and interaction patterns established in shared components.
- When introducing infrastructure or backend changes, review `deployment/README.md` and coordinate account-service, DataFn, lookup-store, and Cloud deployments with application expectations.
- Record manual verification steps whenever automated coverage is insufficient, ensuring reviewers can reproduce validation.
- Evaluate extension surfaces under `extensions/` whenever share flows or browser integrations are affected to keep host app and extension behavior cohesive.

## Governance

The Tidigit constitution supersedes conflicting process documents for automated agents. Amendments require maintainer approval, an updated Sync Impact Report, and simultaneous updates to dependent templates. Versioning follows semantic rules: MAJOR for principle removals or redefinitions, MINOR for added principles or material scope expansions, PATCH for clarifications. Compliance is reviewed during major feature plans and code reviews; violations must be remediated before merge.

### Sync Impact Report

- Version change: 1.2.0 to 1.2.1.
- Clarified current application, layout, runtime, config, store, and capability ownership after the client migration.
- Synchronized WARP.md, README.md, CONTRIBUTING.md, and the architecture references; retained existing test and UI authorization rules.

**Version**: 1.2.1 | **Ratified**: 2025-09-27 | **Last Amended**: 2026-09-12
