# ToolScope verification

The publication candidate was checked on macOS with Node.js 24.14.0 on September 26, 2026. Dependencies were installed cleanly from the root and four client lockfiles using the README commands. These results cover the local examples and test fixtures, not arbitrary third-party servers.

## Build and automated checks

| Check | Result |
| --- | --- |
| `npm run build:toolscope` | Web, CLI, terminal interface, launcher, and bundled example servers built successfully |
| Formatting, lint, and TypeScript | Passed for core, shared fixtures, and all four clients |
| `npm run validate:guards` | Passed, including 363 maintenance-script tests |
| `npm --prefix clients/web run test:coverage -- --maxWorkers=2` | 439 files, 8,471 tests passed; all per-file coverage thresholds passed |
| `npm --prefix clients/cli run test:coverage -- --maxWorkers=2` | 30 files, 391 tests passed; all per-file coverage thresholds passed |
| `npm --prefix clients/tui run test:coverage -- --maxWorkers=2` | 31 files, 436 tests passed; all per-file coverage thresholds passed |
| `npm --prefix clients/launcher run test:coverage -- --maxWorkers=2` | 1 file, 5 tests passed; 100% coverage |
| `npm run verify:build-gate` | A real browser build rejected an injected Node-only import and restored the original entry file |
| `npm run verify:bundle-externals` | All three bundled clients preserved their declared external dependencies |
| Built launcher, CLI, TUI, and HTTP smoke tests | Passed, including CLI source/error cases, terminal rendering and survival, and authenticated web bootstrap |

Coverage requires at least 90% per file for statements, branches, functions, and lines. The integration suites need permission to bind loopback listeners. The terminal tests used a disposable `MCP_INSPECTOR_LOG_DIR` so test logs stayed outside personal application state. A restricted-network install and a restricted-loopback CLI test attempt failed before the identical commands passed with the necessary native permissions; those failed attempts are not counted as passes.

## Exercised workflows

The built CLI listed the five bundled Tool contracts definitions as JSON: `echo`, `list_items`, `get_temp`, `add_tool`, and `remove_tool`. The example's `add_tool` definition intentionally exposes a schema-portability warning; the listing completed with no schema-portability errors.

In Chrome, a real connection to the bundled server saved a five-tool baseline. Calling `add_tool` added `inspect_part`; the change notification disabled capture and comparison until the list was refreshed. Comparing then reported exactly one added definition. This workflow was repeated on the final publication build after the launcher repairs.

The earlier browser pass also verified baseline export, persistence across a new tab and reconnect, a removed tool, and clearing the saved baseline. The export parsed as the five original definitions and excluded the subsequently added tool. The relevant panel and storage code was unchanged apart from error-path coverage and status wording; the final comparison confirmed the corrected singular wording.

Regression tests cover duplicate names, corrupt or inaccessible browser storage, storage write/remove failures, incomplete pagination, malformed or excluded advertised tools, and stale list state. Launcher tests verify that a personal inherited catalog is not used by default and that explicit catalogs, session files, and ad-hoc targets retain precedence. The terminal's variadic environment option and the web client's bare stdio transport option are covered directly in their parsers. An independent review found no remaining blocker in these changes.

## CI terminal smoke repair

The first GitHub run passed application validation and all coverage gates, but the terminal smoke did not render. The same failure reproduced locally with `CI=true`: Ink suppresses live frames in CI even when attached to a real terminal. The smoke now sets `CI=false` and `CONTINUOUS_INTEGRATION=false` only in its PTY child. The parent retains CI mode and fails if no PTY is available; render deadlines and the two-second survival assertion are unchanged. The repaired local CI-mode smoke rendered in 235 ms and survived the required interval. Focused PTY/render tests passed 30/30, and all 363 maintenance tests passed. The [GitHub workflow](https://github.com/nazeeh111/ToolScope/actions/workflows/main.yml) reports verification of the Linux terminal path and subsequent browser checks separately.

## Baseline import checks, September 27, 2026

The import change was checked locally on Node.js 24.14.0. The two affected test files passed 27 tests, covering export/import/reload comparison, source capture time, explicit replacement and cancellation, wrong servers, malformed definitions, duplicate and escaped-equivalent JSON keys, tool-name mismatches, numeric overflow, size rejection before reading, storage failure preservation, and incomplete-list restrictions. Coverage for the parser was 100% statements/functions/lines and 98.73% branches; the panel reached 97.10% statements, 95.55% branches, 92.30% functions and 98.48% lines. Targeted ESLint, formatting, the web TypeScript/client/runner build and `git diff --check` passed. Existing Vite configuration and bundle-size warnings remain.

The continuation browser pass verified export, clearing storage, import and reload with the original capture time preserved. After reloading and reconnecting the bundled server, comparison reported matching definitions. Calling the synthetic add_tool fixture, refreshing the list, and comparing then reported exactly one added definition, inspect_imported_part. No remote server or provider was used. The earlier broad checks above describe the preceding candidate, not a fresh full-suite run of this change. [GitHub run 36335788802](https://github.com/nazeeh111/ToolScope/actions/runs/36335788802) passed on `3f3c9164cc3cef2698c97cc896c63a384ed446b4`: complete validation, per-file coverage across all four clients, build safety/externalization gates, launcher/CLI/TUI/web smoke checks, Chromium flows, and Storybook interactions. The final source-release commit only records this evidence; unchanged code checks are reused.

## Offline baseline comparison and maintenance, September 30, 2026

The source candidate was checked in an isolated checkout with Node.js 24.14.0 and installs from all five lockfiles. The new offline command reuses the existing parser and comparison policy in `core/toolContracts.ts`; the browser wrapper retains file admission. An independent review identified a missing coverage entry after that move. The entry was added before coverage ran: the shared module reached 100% statements, functions and lines, and 98.7% branches; the browser wrapper reached 100% in all four measures.

| Check | Result |
| --- | --- |
| Actual offline-command tests | 6 passed, covering matches, stable differences, invalid/foreign files, duplicate keys, numeric overflow, malformed UTF-8, input limits and unchanged input bytes |
| Existing browser baseline tests | 27 passed across the parser and panel |
| `npm run validate` | Passed; 369 maintenance tests, 6,683 web unit tests, 391 CLI tests, 436 terminal tests and 5 launcher tests |
| `npm run coverage` | Passed all four per-file gates; web 439 files / 8,481 cases, plus the CLI, terminal and launcher suites |
| `npm run verify:build-gate` | Passed the deliberate Node-only browser-import refusal |
| `npm run verify:bundle-externals` | Passed for all three bundles |
| `npm run smoke` | Passed built launcher, CLI, terminal, authenticated HTTP, Chromium startup, embedded apps, elicitation and inspector tabs |
| `npm --prefix clients/web run test:storybook` | 123 files / 527 interactions passed |
| Bundled offline examples | Different definitions returned status 1 with one addition and one changed description; identical files returned status 0 with no changes |

The final help text and coverage configuration also passed their focused formatting, lint and command checks after those small edits. The updated root runtime lock returned no current advisory matches; see [dependency maintenance](dependency-maintenance.md). Existing Vite configuration and bundle-size warnings remain. Hosted checks are reported separately by the [validation workflow](https://github.com/nazeeh111/ToolScope/actions/workflows/main.yml).

The new command does not call a server, assess backward compatibility or authenticate a file's history. Its tests exercise independently authored local files. Browser baseline export/import was not repeated manually in this continuation; the earlier browser evidence above and current parser/panel tests are distinct checks. No external provider or production deployment was exercised.

## Scope and remaining limits

The interface was inspected at 1470 pixels wide. It retains a 1280-pixel desktop minimum; mobile readiness is not claimed. The comparison reports changed top-level definition fields and does not determine backward compatibility. Baselines are stored in this browser; exported files can now restore a baseline for the same catalog server identity. Imported files are not authenticated historical evidence, and the explicit import limits are documented in the README.

No external-account authentication, production MCP server, sensitive sensor, or cross-device workflow was exercised. GitHub CI runs the browser smoke and Storybook interactions separately; its actual run status is the authority for those checks. Local unit coverage alone does not establish accessibility compliance or universal correctness.
