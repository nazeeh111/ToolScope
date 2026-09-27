# Testing and the quality gate

ToolScope keeps a local gate and a GitHub validation workflow for its web, CLI, TUI, and launcher surfaces. The workflow does not publish or deploy anything. It has not yet run in the new public repository; local results and a future GitHub run should be reported separately.

## Clean installation

The root and four clients are separate npm installations with committed lockfiles. Node 24 is the target. Use this sequence to enforce every lockfile:

```sh
INSPECTOR_SKIP_CLIENT_INSTALL=1 npm ci
npm --prefix clients/web ci
npm --prefix clients/cli ci
npm --prefix clients/tui ci
npm --prefix clients/launcher ci
```

The root `postinstall` otherwise invokes `npm install` in each client, which is convenient for development but does not enforce a clean client lockfile install.

## GitHub validation

`.github/workflows/main.yml` runs on pushes and pull requests with read-only repository permissions. Its first job runs `npm run validate`, `npm run verify:build-gate`, `npm run verify:bundle-externals`, `npm run smoke`, and the web Storybook interactions after installing Chromium. Its second job runs `npm run coverage` on a separate runner. Each job first performs the clean install above.

`validate` checks guard integrity, formatting, lint, TypeScript, builds, and unit tests across all four clients. `coverage` enforces at least 90% **per file** on lines, statements, functions, and branches. The web coverage command includes its unit and integration projects. The build and externalization guards run real builds and inspect their results.

`smoke` exercises the built launcher, CLI, web app, Chromium MCP App flows, tabs, and TUI. The TUI smoke uses `script(1)` to supply a pseudoterminal on Linux. It must fail in CI if that PTY is unavailable; a skip is not a passing runtime check. The browser interactions are automated checks. Manual browser inspection provides separate evidence about presentation and usability.

The workflow uses immutable commits for `actions/checkout` and `actions/setup-node`. It contains no registry publish, container push, deployment, release trigger, paid model call, or organization bot. A green local check does not imply the GitHub jobs have passed until the repository actually runs them.

## Local gate and focused checks

`npm run local:gate` serializes concurrent local gates with a lease. It runs `local:validate` (the format/lint/type/build and script guard pass), all four coverage suites, build guards, `smoke`, a Firefox web pass, and Storybook interactions. CI runs each client's fast unit tests during `validate` and again with coverage in its parallel job; the local gate runs them once under coverage to avoid duplicate serial work. Both paths retain the same application checks. Use `npm run validate` for a fast development pass, and the relevant per-client command for a focused edit.

The web smoke supports Chromium, Firefox, and WebKit through `SMOKE_BROWSER`; Chromium is the CI engine and Firefox is part of the local gate. WebKit is an on-demand diagnostic. An unknown browser name or missing browser binary is a failure. `scripts/lib/workflow-gate.mjs` and its tests reject local-only scripts, non-Chromium engine passes, and browser overrides in GitHub workflows.

Retired upstream skill validation, organization issue sweeps, and publication tests must not be represented as active ToolScope gates. Keep tests for applicable guards and remove obsolete workflow assertions together with the workflow they describe. Do not mask a failing guard with `|| true`, a conditional CI step, or a success skip.
