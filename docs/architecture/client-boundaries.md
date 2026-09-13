# Client ownership and import boundaries

Tracked in [TIDY-477](https://linear.app/21n/issue/TIDY-477/enforce-architectural-boundaries-after-client-feature-and-datafn).

## Delivery checklist

- [x] Commit the existing reorganization separately from schema, session, and popover fixes.
- [x] Move shared focus preferences and sound state into focus ownership, retaining persistence keys.
- [x] Remove the composition/session-store cycle by passing fixed end times explicitly.
- [x] Move memory upload, search-result, and synced-id helpers out of product implementations.
- [x] Supply the graph layout from the product shell.
- [x] Move authentication, network authority, connectivity, and logging into non-UI runtime ownership.
- [x] Move the active-resource UI store out of DataFn and avatar/icon catalogs into UI ownership and initial app data into configuration.
- [x] Remove unused mutation-label helpers from DataFn and depend on the observable-store interface instead of its implementation.
- [x] Move shared product contracts and navigation metadata out of product implementations.
- [x] Enforce completed boundaries and declare existing public feature entry points.
- [x] Pass compiler checks for Nucleum, Pointron, Memotron, and account-service.
- [x] Pass seven schema tests, two focus-preferences tests, and three popover tests.
- [x] Pass four Nucleum focus browser scenarios with no page errors.
- [x] Update the approved existing-test import and mock paths.
- [x] Adapt the approved fixed-end-time test setup without changing expected durations; pass 127 tests across all 19 affected unit-test files.
- [x] Confirm Playwright discovers all 549 tests in 55 files after import updates.

## Ownership

`schema` owns resource definitions. `client/datafn` owns the client storage and sync runtime. `client/runtime` owns browser infrastructure such as account transport, network authority, connectivity, and diagnostic logging. `client/features` owns capability implementations. `client/products` composes those capabilities into product experiences. Client product identity composition lives in `client/config/product.type.ts`; cross-layer product identity lives in `schema/product.type.ts`; declarative navigation metadata lives in `client/config`.

`client/elements` contains UI primitives. `client/components` contains shared charts, nested-list controls, and the time selector. `client/application` owns account/settings, library/resource rendering, modal orchestration, command UI, and app-specific integrations. Markdown editing and tags belong to memory; combinations belong to spaces. Shared preferences live in `client/stores/preferences`, and cross-layer billing contracts live in `schema/account`. Keyboard and interaction-mode contracts live in `client/elements/keyboard`; panel and error presentation contracts live in shared resource and element owners. See [type ownership](type-ownership.md) for the complete inventory.

## Enforced rules

Run `npm run check:architecture`. CI and the root lint command run the same check. It resolves relative imports, source aliases, dynamic imports, and TypeScript import types in TypeScript and Svelte scripts.

- Features cannot import product implementation files.
- Shared components cannot directly import features, products, or application composition.
- DataFn and runtime files cannot directly import features, products, application composition, components, application stores, layouts, elements, or actions.
- Composition calculations cannot import the session singleton.
- A caller outside a capability must use a source file explicitly listed in `tools/check/feature-entrypoints.json`.

The feature entry-point list records the existing public surface, including individual components and type modules; it is not a barrel module. Additions require an explicit contract change. Package exports expose these same paths. Source aliases bypass package exports, which is why the source-level check remains necessary.

## Current architecture contract

Features cannot import application or product implementations. Shared stores, utilities, actions, components and elements cannot transitively load capability or application composition at runtime. Explicit type-only edges are excluded from runtime reachability; legacy persistence adapters can still reference capability types. Cross-capability imports remain permitted through declared public entries, so the complete source graph is not claimed to be acyclic.

Application and extension shells configure permanent overlay, resource-action, panel, shortcut, recents, record-renderer and action-renderer contracts in `client/application/composition/resource-hosts.ts`. Configuration runs from base, user, and extension shells before presentation or command execution. Shared Markdown display owns portable parsing; memory owns Markdown editing. Shared file state and presentation, resource enums, event contracts and action identifiers no longer depend on capability implementations.

The public feature API is enumerated in `tools/check/feature-entrypoints.json`. Each has a static consumer outside its capability. The checker rejects unused public entries and private external imports. This reduces the previous 154 entries by moving shared contracts and infrastructure to their proper owners without introducing barrels or compatibility paths.

Registered workspaces declare their production source imports. `@nucleum/client` owns the existing config/runtime/next aliases. Source workspaces bundled by an app declare co-hosted workspace requirements as peer dependencies; existing build dependencies remain dependencies. Peers describe the host's source compilation requirements without adding artificial Turbo build cycles. This is not a claim that each source package builds or installs independently. The checker verifies both resolved workspace and external package imports; test and story dependencies are outside this production-source check.

The narrow Library now mounts resource panes only after a resource is selected. A dedicated focus-capability test covers the portrait Library in Nucleum and Pointron; a seeded Recents probe verifies visibility before and after reload without page errors. Broader regression results are recorded below separately from the architecture checks.

## Application-state ownership follow-up

`client/stores/app.store.ts` retains product state and state mutation. URL/history and resource navigation live in `client/layout/navigation/navigation.ts`. Product command lookup/execution lives in `client/application/commands/action-runner.ts`; shared callers use the permanent `CommandHost` installed from `resource-hosts.ts`. No old methods delegate to the new owners.

Account session state stays shared. Deletion confirmation and cleanup orchestration live in `client/application/account/account-deletion.ts`; subscription operations live in `client/application/subscription/subscription.ts`; file conversion, thumbnail generation, signing, and local/remote storage live in `client/stores/files/file-upload.ts`. Legacy OAuth initiation belongs to application account composition.

Product menu persistence lives beside navigation. Tab and sidebar mutations live beside those layouts; generic UI-state persistence remains shared. Shortcut hints derive from a scoped UI-state observer and update when product or device context changes. Focus owns its scheduled notification queue, and the existing native transport delivers messages. Memory owns its word-count and PDF-overlay DOM actions. The unused Markdown action and empty `@nucleum/cx` workspace are retired, including active aliases and workspace declarations.

The remaining shared stores are not certified as universally minimal. Notification presentation stays in `notification.store.ts`; application events have a separate `stores/events` owner. Legacy account session bootstrapping still spans persistence adapters. Further splits must identify concrete ownership and consumer benefits rather than create generic wrapper layers.

## Verification

Preserve product gates, navigation destinations, preference resource keys, schemas, and immediate and durable user-visible behavior. Run the Nucleum, Pointron, and Memotron compiler scripts, account-service typecheck, affected existing unit tests, and the Nucleum focus probe. Record existing extension/compiler or test-harness failures separately from regressions. No cloud transport or deployment coverage is implied by the local probe.

## Historical phase verification records

The following records describe each phase at its original commit. Their pending-work notes and counts are historical; the current architecture contract above supersedes them.

### Initial local verification record

- `npm run check:architecture`: passed; alias, relative, and dynamic forbidden-import negative controls were rejected.
- `npm --workspace nucleus-app run typecheck`: 0 errors, 379 warnings.
- `npm --workspace pointron-app run check`: 0 errors, 308 warnings.
- `npm --workspace memotron-app run check`: 0 errors, 302 warnings.
- `npm --workspace @21n/account-service run typecheck`: passed.
- Schema tests: 7 passed using the shared Vitest project with coverage disabled.
- Focus preference and popover tests: 5 passed using the client Vitest project, coverage disabled, and the existing dependency-inlining workaround for `@testing-library/svelte` and `@testing-library/svelte-core`.
- `node apps/e2e-playwright/scripts/probe-review-session.mjs`: start, reload/fullscreen, interval-boundary, and delivered-reset scenarios passed. Evidence: `apps/e2e-playwright/artifacts/review-session-1788782040041`.

The first focused Vitest invocation ran the selected tests successfully but inherited repository-wide coverage collection, which encountered existing missing PDF sourcemaps in generated app bundles. It was stopped and rerun with coverage disabled. No existing test configuration was changed.

The approved test-path updates and explicit-end-time setup adaptation are complete. All 127 tests across the 19 affected unit-test files pass. Playwright discovers 549 tests in 55 files; this is collection validation, not execution of the full browser suite. Delivery is local only; nothing has been pushed.

`npm run lint` passed the architecture and fixed-wait checks. Turbo reported no package lint tasks; it ran only the static asset build dependency, so this is not full source lint coverage. Its generated manifest was restored after validation.

## Component ownership phase

- [x] Separate application composition from shared components.
- [x] Move Markdown/tag UI to memory and combinations to spaces.
- [x] Move shared preferences and cross-layer contracts out of UI directories.
- [x] Update source imports, test/mock paths, Storybook callers, aliases, workspace metadata, and public feature entries without compatibility files.
- [x] Enforce shared-component dependency direction, including relative and dynamic imports.
- [x] Complete scoped compiler, unit, browser, and architecture verification; deliver this phase as a separate local commit.

The public feature list now contains 148 entries after relocating existing public Markdown and combination modules. This is ownership correction, not completion of the separate public-API reduction phase.


### Component ownership validation

- Architecture check: 1,983 source files, 10,489 resolved imports, zero violations. Alias, relative, and dynamic forbidden-import negative controls passed.
- Nucleum, Pointron, and Memotron compiler checks: zero errors (379, 308, and 302 warnings respectively). Nucleum required `svelte-kit sync` to refresh generated aliases. Account-service typecheck passed.
- Affected client tests: 28 passed in eight files. Shared text utility tests: 15 passed. Coverage collection was disabled for these focused runs.
- Playwright collection: 549 tests in 55 files; the full suite was not executed.
- Four Nucleum focus browser scenarios passed with no page errors. Evidence: `apps/e2e-playwright/artifacts/review-session-1788782529667`.
- A separate fresh-context Markdown smoke probe seeded through the loaded DataFn runtime, opened the node through `appStore.openResource`, verified a visible edit, waited for persistence, reloaded, and verified the edited content again. No page errors. Evidence: `apps/e2e-playwright/artifacts/component-ownership-1788782928482`.
- The existing Markdown Playwright scenario stopped at its seed fixture because its imported DataFn runtime was uninitialized. No existing test setup or assertions were altered to bypass this failure.
- Four affected legacy server test files remain failing: three cannot collect because `dodopayments` is unavailable, and the Turso file has one failing user assertion (ten tests pass). The same failures reproduced in a detached worktree at pre-phase commit `efd1a409`; these are baseline failures.

Changes preserve source behavior and update existing test paths only. Browser coverage is local and focused; no full-suite, cloud, deployment, or push validation is claimed.


## Overlay and reusable resource boundary phase

- [x] Separate overlay state from shell navigation through an explicit host contract.
- [x] Colocate reusable modal chrome, resource feedback and selection/active-resource state with shared UI/store owners.
- [x] Separate read-only resource queries and file limits from application mutation orchestration.
- [x] Rewrite callers and authorized test paths directly, preserving behavior and enum values.
- [x] Enforce the completed boundaries and validate product compilers, unit tests and focused browser workflows.

This phase removes the shared modal/resource foundation dependencies first. Application-composed record lists, thumbnails with action dispatch, resource panels, and the remaining broader helper cycles retain application ownership until their host interactions can be supplied explicitly. The parent issue remains open for those boundaries, public-API reduction and broader regression coverage.


The overlay store now lives in `client/stores/overlays` and owns modal, mini-player and fullscreen state without importing application navigation. `appStore` configures its `OverlayHost` once during module initialization; callbacks preserve dismissal events, fullscreen URL parameters and associated-player selection. This is the permanent shell contract, with an explicit error if a caller uses an overlay without a configured shell. Architecture enforcement rejects transitive overlay dependencies on application, feature or product implementations.

Reusable modal header/footer/padding and popup props live in `client/elements/modal`. Selection and active-resource stores live in `client/stores/resources`; resource grid/star/trash feedback lives in `client/components/records`. Generic resource errors and read-only lookup belong to DataFn; the file capability owns the existing upload limit. Application mutation orchestration and feature-composed record rendering remain in application. All old import paths are removed, and the retired application-path registry prevents their reintroduction.

Phase validation: all four product compilers passed with zero errors (379/302/308/0 warnings); 285 unit tests passed, 3 skipped, including eight new overlay/resource-query tests. Existing test modifications are import/mock/filesystem-path updates only. Focus start, reload/fullscreen, interval-boundary and delivered-reset probes passed; Markdown visible edit, persisted content and post-reload verification passed. The share extension production build passed. Architecture checks, transitive/retired-path negative controls, unchanged-enum comparison (199 enums), no-fixed-waits, Turbo build graph and Playwright discovery (549 tests, 55 files) passed. Full cross-product Playwright and cloud integration were not run.

Direct feature-to-application imports decreased from 165 to 84. The public feature registry has 156 entries after exposing the shared file limit. Remaining imports include application-composed records/thumbnails, mutation/action dispatch, panel navigation, shortcuts and transcription integration; broader helper/store cycles and public-API reduction remain parent-issue work. This phase does not claim completion of TIDY-477.


## Resource action host phase

- [x] Remove application navigation and node-store imports from shared resource menu/bulk actions through an explicit host contract.
- [x] Preserve mutations, lifecycle hook ordering, menu labels and selection context.
- [x] Update callers and authorized mock/import paths without compatibility exports.
- [x] Add host/lifecycle tests, enforce the boundary, and validate product/browser workflows.

- [x] Move reusable thumbnail presentation to shared components and supply menus from the owning capability.

ResourceActions and BulkEditor now live in `client/stores/resources`. The composing appStore supplies ResourceActionHost for navigation, tabs, link dialogs, clipboard links and awaited node lifecycle hooks. This removes the ResourceActions -> BulkEditor -> node.store -> ResourceActions dependency cycle. Thumbnail presentation no longer imports resource stores to choose menus: node, collection, objective and task callers supply their resolver with the same access-point parameters. Unsupported event and combination menus remain empty.

The architecture check rejects application/product dependencies and feature implementations in these resource action modules; the existing pure LinkType contract remains explicitly permitted. Shared thumbnail components use the generic-component boundary. Four retired application paths are blocked. This enforces direct dependencies for resource actions, not transitive isolation of all existing shared utilities and stores.

Validation: all four product compilers passed with zero errors (379/302/308/0 warnings). The repository unit suite passed 293 tests, with 3 skipped; eight new host-contract tests cover edit navigation, dialog payloads, awaited mutation/lifecycle ordering, failure retention and bulk selection. The existing resource-action test changed only two import/mock paths. Focus start, reload/fullscreen, interval-boundary and delivered-reset probes passed, as did Markdown edit/persistence/reload and a fresh-context thumbnail star/immediate-menu/reload-menu probe; no page errors. The share-extension build passed. Architecture (2,005 files, 10,632 imports), negative controls, all 383 type dispositions and 199 unchanged enum invariants, fixed-wait check, Turbo build graph and Playwright discovery (549 tests in 55 files) passed. Full cross-product Playwright and cloud integration were not run.

Direct feature-to-application imports decreased from 84 to 69. Public feature entries remain 156. Application-composed record lists, panel navigation, modal composition, action enums, shortcuts, transcription and broader helper/store cycles remain, along with package dependency alignment, public-API reduction and broader regression coverage. TIDY-477 remains In Progress.

## Resource panel boundary phase

- [x] Move panel contracts, state transitions and presentation to shared resource owners.
- [x] Supply shell navigation explicitly, preserving URL keys and panel/focus transitions.
- [x] Enforce retired paths and dependency direction; verify compiler, unit and browser behavior.

Panel enums, URL resolution and panel state transitions now live in `client/stores/resources`; reusable panel presentation lives in `client/components/records`. ResourcePanelHost supplies shell navigation. Callers pass the current SvelteKit URL explicitly when resolving the panel, keeping the shell store independent of SvelteKit page-store initialization. URL suffixes and values, default/focus toggles, update/event ordering and navigation semantics are preserved. The four previous application paths are retired, and direct application/feature/product or appStore imports are forbidden in these shared panel modules.

This phase reduces direct feature-to-application imports from 69 to 48; the feature public surface remains 156 entries. Application action/embed contracts, composed record lists/status rendering, shortcuts, recent-resource tracking, library composition, maps, transcription and modal/capture integrations remain. Broader shared-store cycles, package dependency alignment, API reduction and full product regression remain open under TIDY-477. No complete transitive-isolation claim is made.

Validation: four product compilers passed with zero errors (379/302/308/0 warnings); 301 unit tests passed, 3 skipped, including eight new panel transition/URL tests. No existing tests changed. The browser panel probe verified Links selection and visible empty-state content immediately and after reload, resource close, and maximize/minimize. Focus's four scenarios and Markdown edit/persistence/reload passed without page errors. Architecture checked 2,007 files and 10,640 resolved imports; the panel-to-shell negative control was rejected. All 383 type dispositions and 199 runtime enum invariants passed, as did fixed-wait enforcement, Turbo graph validation and Playwright discovery (549 tests, 55 files). The share extension was built directly to avoid relying on Turbo's cached result. Full cross-product Playwright, narrow-screen back navigation, cloud integration and deployment were not exercised.

## Native embed transport boundary phase

- [x] Move native protocol contracts and request/response transport into runtime infrastructure.
- [x] Preserve payload serialization, origin selection, native delivery and timeout behavior.
- [x] Enforce transitive isolation and validate compiler, unit, browser and extension surfaces.

The native message enums, haptic contract, request channel and transport utilities now live in `client/runtime/embed`. They retain the original message names, payload serialization, trusted-parent selection, native host delivery, request caching/correlation and polling timeout. The shared delay helper moved out of frontend date utilities into `shared/utils/wait.ts`, and every caller uses the new owner directly. No compatibility exports remain.

Transitive enforcement restricts embed transport to runtime and cross-layer dependencies, preventing a utility import from silently pulling UI/store code back into the transport. Four retired application paths plus the old embed utility path are blocked. Direct feature-to-application imports decrease from 48 to 41; public feature entries remain 156. Native message interpretation and application actions remain in the composing UserBaseLayer; transcription capability ownership, action contracts, remaining record/library/modal dependencies and broader regression work remain open.

Validation: four product compilers passed with zero errors (379/302/308/0 warnings); the serial repository unit run passed 309 tests, 3 skipped, including eight new transport/request tests. Three existing test files changed import/mock paths only. A browser round trip through a simulated iOS message handler and the existing UserBaseLayer receiver verified the exact request payload and correlated reply; this is not real-device native validation. Architecture checked 2,009 files and 10,644 resolved imports; the transitive frontend-dependency negative control was rejected. All 383 type dispositions and 199 unchanged runtime enum invariants passed, along with fixed-wait enforcement, Turbo graph validation, Playwright discovery (549 tests, 55 files) and a direct share-extension build. Initial concurrent validation encountered a failed preference persistence assertion, browser timing failures and a stopped local app server; the server was restarted and affected checks rerun serially without changing existing test assertions.

Serial browser verification passed all four focus scenarios and Markdown visible edit/persistence/reload with no page errors. Full cross-product Playwright, native iOS/WebView devices, live auth/cloud sync and deployment were not exercised. TIDY-477 remains In Progress.

## Inference runtime boundary phase

- [x] Separate inference service and native/worker contracts from application composition.
- [x] Move pure WAV serialization to shared utilities and preserve all callers and wire values.
- [x] Enforce runtime isolation and verify service, compiler and browser behavior.

The Taco inference service and distinct native/worker contracts now live in `client/runtime/inference`. Byte-level WAV serialization belongs to `shared/utils/audio.utils.ts`; browser AudioBuffer conversion and AudioContext decoding belong to `client/runtime/audio/audio.utils.ts`. Existing service and audio function bodies and all enum values are unchanged. Preference defaults, native model identifiers, worker identifiers and the existing local inference endpoint remain intact; no endpoint correctness or real-model execution is claimed by this ownership change.

Transitive runtime enforcement now includes inference and browser audio infrastructure. Four old paths are retired. Direct feature-to-application imports decrease from 41 to 38; public feature entries remain 156. Application settings and product-specific worker composition retain their existing ownership and behavior. Remaining action contracts, composed record/library/modal surfaces, broader helper cycles, public-API reduction, package alignment and cross-product regression remain under TIDY-477.

Validation: all four product compilers passed with zero errors (379/302/308/0 warnings). The repository unit suite passed 319 tests, 3 skipped, including ten new service-contract checks and unchanged existing audio assertions. The existing audio test only changed import paths. A browser probe exercised transcription start, job retrieval and download acknowledgement through a simulated native host and the existing message receiver; four focus scenarios and Markdown edit/persistence/reload also passed without page errors. The direct share-extension build passed. Architecture checked 2,011 files and 10,650 imports, the transitive negative control was rejected, all 383 type dispositions and 199 runtime enum invariants passed, and fixed-wait enforcement, Turbo graph and Playwright discovery (549 tests, 55 files) passed. Full cross-product Playwright, real model downloads/inference, native devices, cloud integration and deployment were not run. TIDY-477 remains In Progress.

## Keyboard shortcut boundary phase

- [x] Separate reusable shortcut state, matching and listening from application defaults/product configuration.
- [x] Preserve persistence, modifier matching and product-specific configurable shortcuts.
- [x] Retire old paths and remove public feature exports with no external consumers.
- [x] Validate matching, compilers and product/browser workflows.

Reusable shortcut persistence/matching lives in `client/stores/keyboard`; the component listener lives in `client/components/keyboard` and formatting/modifier utilities in `client/elements/keyboard`. ShortcutHost supplies application defaults and current product-configurable actions from the app shell. The original DataFn resource, merge/load behavior, Windows default modifier mapping, exact matching and text-input handling are preserved. The application shortcut runner and default command configuration remain application-owned. Direct dependencies from the shared shortcut store/listener into application or product implementations are rejected; this does not claim all broader store dependencies are transitively isolated.

The collection and task stores no longer have consumers outside their own capability, following the earlier thumbnail refactor. Their two entries were removed from both the feature registry and package exports; source enforcement and Node package resolution reject external imports. Internal capability callers use relative paths to these private modules. Remaining public feature entries decreased from 156 to 154. Direct feature-to-application imports decreased from 38 to 33. Further capability API reduction, composed record/library/modal boundaries, broader helper cycles, package alignment and broad regression remain parent-issue work.

Validation: the repository unit suite passed 327 tests, 3 skipped, including eight new shortcut contract tests; no existing tests changed. All four product compilers passed with zero errors (379/302/308/0 warnings). Browser probes passed default keyboard navigation, input suppression, a saved keymap override after reload, four focus scenarios with keyboard session start, and Markdown visible edit/persistence/reload without page errors. Architecture checked 2,013 files and 10,662 imports with zero violations; forbidden shortcut dependencies and private-store external imports were rejected by negative controls. All 383 type dispositions and 199 runtime enum invariants, fixed-wait enforcement, Turbo build graph and Playwright discovery (549 tests, 55 files) passed. The direct share-extension build passed. Full cross-product Playwright, native devices, live cloud integration and deployment were not run. TIDY-477 remains In Progress.

## Recent-record boundary phase

- [x] Move recent-record state and its contract into shared resource stores.
- [x] Supply live product resource selection from the app shell.
- [x] Enforce direct ownership and retire both former application paths.
- [x] Validate queries, sorting, product selection and browser persistence.

Recent-record state now lives in `client/stores/resources/recent.store.ts`, with its state contract in `recent.type.ts`. The shell configures RecentsHost to read the current app product whenever an everything query runs. Explicit resource refreshes retain their existing behavior. The state key, query limits, archive/trash filters, date normalization, typed exclusions, ordering, duplicate replacement and partial-failure handling are unchanged. The unused memory-node import is removed. Direct imports into application, feature or product implementations and the app store are rejected from the recent-record modules. Broader transitive store dependencies remain outside this phase's enforcement.

Direct feature-to-application imports decrease from 33 to 31; public feature entries remain 154. All 333 unit tests passed, 3 skipped, including six new contract tests. The existing Pointron DataFn integration test changed only its import path. All four product compilers passed with zero errors (379/302/308/0 warnings). Architecture checked 2,015 source files and 10,668 imports with zero violations; an injected app-store dependency was rejected. All 383 type dispositions and 199 runtime enum invariants, fixed-wait enforcement, Turbo build graph and Playwright discovery (549 tests in 55 files) passed. The direct share-extension build passed.

Browser verification passed four focus scenarios and Markdown visible edit/persistence/reload without page errors. A new narrow-library probe confirmed recent-record visibility immediately and after reload, but its zero-page-error assertion failed with `DFQL_UNKNOWN_RESOURCE: Unknown resource: unknown`. Serving the original recent-store implementation from baseline `ca8dc455` at the same browser module URL reproduced that error while preserving both visible assertions; this isolates the store implementation, not the entire baseline checkout. Record this Library selection error under broader regression work instead of claiming a fully clean Recents browser run. Full cross-product Playwright, native devices, live cloud integration and deployment were not run. TIDY-477 remains In Progress.

## Completion validation

The final implementation is delivered as eight cohesive architecture commits (`a268d984` through `673547cb`) and a separate Library behavior fix (`64f39f58`). Command/event contracts, Markdown display, modal/map/file presentation, resource renderers and URL-capture ownership are separated without compatibility exports. The shell owns renderer/host configuration, including extension entry points.

- Unit suite: 337 passed, 3 skipped across 58 files.
- Product compilers: Nucleum, Memotron, Pointron and Timear all have zero errors; existing warning counts are 379, 302, 308 and 0. Account-service typecheck passes.
- Production builds: Nucleum and the share extension pass. These are local builds, not deployment checks.
- Type ownership: all 383 dispositions and 199 unchanged runtime enum invariants pass.
- Source enforcement rejects forbidden alias, relative and dynamic imports, indirect shared-runtime composition dependencies, undeclared workspace/external dependencies and unused public feature entries. Turbo's build graph validates.
- Library: Nucleum and Pointron portrait Library tests pass; seeded Recents visibility survives reload with no page errors.
- Nucleum: 15 Library/settings/task-creation/collection/navigation scenarios pass. The countup item-switch scenario passes when run serially. The Markdown probe confirms visible edits and persisted content after reload, with no page errors.
- Memotron: the broader node/collection/navigation run has 4 passed, 3 product-specific skips and 3 Capture-related failures. Its Capture smoke failure also reproduces in a detached worktree at the pre-completion baseline `350e4735`.
- Pointron: the serial settings/collection/navigation run has 7 passed, 3 product-specific skips and 2 settings failures. Both settings cases also fail at baseline, but at different steps; their causes remain unclassified.
- Four Nucleum focus failures also reproduce at `350e4735`: restoring mixed/nested focus items after reload, checking the active task, and countup break/resume state. Existing assertions were retained. These are recorded baseline failures, not passing coverage.

Some early browser batches overlapped and caused excessive local memory use; those processes were stopped. Subsequent verification uses one product server and one browser worker, with the server's Node heap capped at 1 GB. Interrupted runs are not treated as passes. This verification does not claim execution of the entire Playwright suite, native-device coverage, live cloud auth/sync or deployment validation.

Workflow failures and unresolved classification are tracked separately in [TIDY-479](https://linear.app/21n/issue/TIDY-479/investigate-offline-capture-and-focus-workflow-failures-found-during). TIDY-477 closes the structural work with this explicit regression record; it does not certify that every existing product workflow passes. Final architecture enforcement covers 2,029 files and 10,765 resolved imports with zero violations. Root lint passes architecture/fixed-wait checks, but Turbo defines no package source-lint tasks.
