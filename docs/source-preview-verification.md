# Source-preview verification

Verified locally on 17 November 2026 with Node.js 24.14.0 and the locked dependencies. This source preview preserves engineering parent `f8833e59ea928e2a80424c331262a5e6c8bb5f04`. It is a source delivery, not an npm or tagged release.

## Repairs verified

- The bundled `add_tool` fixture previously passed a serialized JSON Schema to an SDK API expecting an in-memory Zod shape. A real browser call and a real HTTP integration regression reproduced the tool error. The fixture now converts an explicit object-root schema using the already locked Zod dependency before registration. The test checks retained constraints, a valid call, rejection of a wrong type, and refusal of failed conversions without poisoning the tool list. Omitted schemas and the earlier empty `{}` shorthand still work. The reverse converter is experimental and limited; inspect the advertised definition.
- Dark-theme introduction labels now use the existing theme-aware primary text token. The settled labels pass the automated contrast check.
- The compact view selector has a usable share of the header and a 220-pixel portal menu. At 320 pixels all six options fit and their pointer targets are unobscured. Actual pointer selection and arrow-key/Enter selection work. Desktop controls and actions remain available.

No auth, transport, decimal policy, offline evaluator, package lock, license, coverage budget or pre-existing test assertion was changed for these repairs.

## Original required checks

All six contributor gates passed on the final repaired runtime source:

```sh
npm run validate
npm run coverage
npm run verify:build-gate
npm run verify:bundle-externals
npm run smoke
npm --prefix clients/web run test:storybook
```

Coverage ran 8,555 web tests, 391 CLI tests, 440 TUI tests and 5 launcher tests, retaining the 90% per-file gates. Storybook ran 527 interactions in 123 files. Smoke checks exercised the built launcher, CLI, TUI, authenticated web backend, Chromium application/elicitation paths and tabs. Tests used synthetic local state; native-module secret storage tests retain their existing mock.

## Browser and offline workflows

The actual browser created a typed tool, refreshed its list, compared exactly one added definition and executed the new tool. The empty-schema control also registered and executed. Exported five- and six-tool baselines were checked through the existing offline comparator: one added tool exits 1 and an identical baseline exits 0. Cancelling an import preserved the current baseline; confirming restored the original baseline and capture time. Reopening the page and reconnecting preserved that saved baseline. A fresh synthetic server process starts with its original tools; this does not claim durable server mutations.

Twenty-four settled-view axe scans covered Tools, Resources, Prompts and Servers in light/dark themes at 320, 390 and 1280 pixels. All reported zero violations and no document overflow. Manual-review items remain in every scan. Console and page-error buffers were empty after the final journey. [Current captures](images/source-preview/CAPTURES.md) show the real workspace.

The new synthetic temperature examples produce two witnessed regressions and two accepted controls, with exact hashes and byte counts for all three inputs. Unsupported-only cases exit 2; a report containing both a witnessed regression and unknown cases retains both. These are finite supplied examples, not proof of universal compatibility. Earlier independent engineering review covered 432 numeric verdicts across three dialects; it is a separate bounded review, not a new whole-client or scientific study.

## Limits

This check does not establish exhaustive assistive-technology, performance, security or all-browser acceptance. It uses local synthetic servers and no provider account. Existing published offline kits retain their original structural-comparison scope; the probe command requires a dependency-installed source checkout. License and upstream attribution remain in [LICENSE](../LICENSE), and the original full README is preserved byte-for-byte as [TECHNICAL_GUIDE.md](../TECHNICAL_GUIDE.md).
