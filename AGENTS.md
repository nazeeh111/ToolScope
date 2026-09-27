# ToolScope contributor instructions

ToolScope is a local MCP inspector adapted from MCP Inspector. It provides a web app, a scriptable CLI, and an Ink terminal UI over shared `core/` code. Preserve all three surfaces and the launcher when changing behavior. Read the implementation and relevant tests before editing. The upstream source and attribution are retained in the original source checkout, `UPSTREAM_README.md`, `LICENSE`, and `NOTICE`.

## Project layout and setup

- `clients/web` owns the Vite/React app and its Node runner.
- `clients/cli` owns the scriptable command interface.
- `clients/tui` owns the Ink terminal interface.
- `clients/launcher` owns the `mcp-inspector` binary and dispatches to each surface.
- `core/` contains shared MCP transport, auth, state, storage, and React helpers. `test-servers/` holds local MCP fixtures. `scripts/` holds build, verification, and smoke tooling.

Use Node 24 for this publication copy. The repository is not an npm workspace: the root and four clients each have a lockfile. For a reproducible clean install, run `INSPECTOR_SKIP_CLIENT_INSTALL=1 npm ci` in the root, then `npm --prefix clients/web ci`, `npm --prefix clients/cli ci`, `npm --prefix clients/tui ci`, and `npm --prefix clients/launcher ci`. An ordinary root `npm install` invokes `scripts/install-clients.mjs` and installs all clients for development.

## Dependency boundaries

- Runtime packages imported by `core/` belong in root `dependencies`. Root-owned runtime imports and externalized client imports must resolve from the root package at runtime.
- A client declares packages only when that client alone consumes them. Shared lint, TypeScript, formatting, and test tools belong in root `devDependencies`; client-specific build and UI packages stay client-local.
- The `@inspector/core` alias is source code, not a separate package. Verify every client build after a shared-code change.
- Preserve the root/client version lockstep checked by `verify:dep-lockstep`. Use a reasoned `overrides` entry for a transitive dependency change; do not run a broad audit fixer blindly.

## Tests and delivery gates

Run the smallest relevant checks while developing. Before handing off a publication candidate, run `npm run validate`, `npm run coverage`, `npm run verify:build-gate`, `npm run verify:bundle-externals`, `npm run smoke`, and `npm --prefix clients/web run test:storybook` with Chromium installed. The current `npm run local:gate` adds Firefox and runs suites once under coverage. Tests that fail need a cause and a fix; do not make a check optional or suppress its exit status to obtain a green run.

`validate` checks root guards, formatting, lint, TypeScript, builds, and unit tests in web, CLI, TUI, and launcher. `coverage` enforces 90% per file for lines, statements, functions, and branches in all four clients. Coverage exclusions need an explanation grounded in unreachable or infrastructure code. CI must exercise the built launcher and local MCP test servers as well as the browser app. On Linux, `smoke:tui` uses `script(1)` to provide a pseudoterminal; a CI skip is not evidence of a working TUI.

The workflow in `.github/workflows/main.yml` is a validation workflow for pushes and pull requests. It does not publish npm packages, containers, or a backend. `scripts/lib/workflow-gate.mjs` keeps local-only scripts and non-Chromium engine passes out of CI. Keep its tests aligned with the real workflow. Pin third-party actions to verified immutable commits and keep the token at `contents: read` unless a concrete read-only verification step needs a narrower documented exception.

Preserve unrelated staged, unstaged, and untracked work. Do not commit, push, post, publish, deploy, change credentials, or spend money without the current user's authorization. Keep license and notice files in the source and web output.

## Source conventions

- Every source file should explain its purpose. Keep shared behavior in `core/` and client-specific behavior in its client.
- Use the repository's Prettier and ESLint scripts; lint has no warning tier (`--max-warnings 0`). Do not discard promises without a reason.
- Keep TypeScript checks meaningful. New TypeScript files must enter a checked tsconfig project; `verify:typecheck-coverage` enforces this. Avoid `any` where a concrete type or `unknown` with validation works.
- In React code, do not reset local state from a prop in an effect. Derive render values during render, use `useValueChange` for render-phase local state correction, and use `useSyncExternalStore` for shared state-store subscriptions. Keep values passed to those hooks referentially stable as required.
- Put web browser-only code in `clients/web/src`; put Node server code in `clients/web/server`. Do not import Node built-ins into the browser graph. `verify:build-gate` checks this with a deliberate failing build.
- Do not broaden auth or network exposure while adapting a local-only product. Test transport and secret handling with local fixtures.

The original upstream rules describe organization boards, release publishing, and retired agent workflows. Those processes do not apply to this ToolScope adaptation. Preserve upstream attribution and technical behavior while keeping this project's active instructions accurate.
