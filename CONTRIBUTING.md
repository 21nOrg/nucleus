# Contributor and maintainer orientation

As noted in README.md, external contributions are not currently accepted. This guide documents the workflow for maintainers and authorized agents.

Start with [AGENTS.md](AGENTS.md), [WARP.md](WARP.md), [client boundaries](docs/architecture/client-boundaries.md), and [type ownership](docs/architecture/type-ownership.md).

Confirm the active product in `client/products` and `client/config`. Reuse shared controls and DataFn APIs, and keep behavior with its domain owner. `client/stores` is for shared state and contracts; application workflows, navigation, and capability logic have separate owners.

Use repository scripts for setup, compilation, tests, and builds. Run architecture and type-ownership checks for moves, and include a forward migration when generated database mappings change. Do not modify existing tests without the per-file authorization required by AGENTS.md.

PRs should describe the user-visible result, ownership changes, checks performed, and limitations. Do not include secrets, local environment files, build output, or unrelated workspace changes.
