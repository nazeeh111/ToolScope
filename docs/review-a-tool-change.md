# Review a tool change with concrete examples

This source workflow compares supplied definitions and checks supplied examples. It does not execute the server or prove compatibility for every possible value.

## Reproduce two consumer regressions

After the root dependency install in the README:

```sh
node scripts/probe-tool-baselines.mjs examples/tool-baselines/consumer-before.json examples/tool-baselines/consumer-after.json examples/tool-baselines/consumer-probes.json
```

The bundled synthetic `read_temperature` definition changes in two ways: its input `unit` accepts only `C` after the change, and its output `status` adds `warming`.

| Case ID | Direction | Before | After | Verdict |
| --- | --- | --- | --- | --- |
| `celsius-still-accepted` | Input | Valid | Valid | `accepted-example` |
| `fahrenheit-call-rejected` | Input | Valid | Invalid | `input-regression` |
| `ready-still-accepted` | Output | Valid | Valid | `accepted-example` |
| `warming-result-new` | Output | Invalid | Valid | `output-regression` |

The report exits **1**, contains `regressions: 2`, `unknown: 0` and `invalidCases: 0`, and retains `compatibilityProven: false`. An old caller can no longer send Fahrenheit. An old consumer cannot accept the possible new warming result. These are witnesses of specific schema regressions, not a measurement of real temperature hardware or server behavior.

## Inspect the locations that changed

```sh
node scripts/compare-tool-baselines.mjs examples/tool-baselines/consumer-before.json examples/tool-baselines/consumer-after.json
```

This also exits **1**. Read the `changes` entry for `read_temperature`, its changed `inputSchema` and `outputSchema` fields, and the JSON pointers under `details`. Structural paths locate edits; they do not establish semantic compatibility. Array positions matter, and large diagnostics may be truncated explicitly.

Compare either baseline with itself for exit **0**. Use the unchanged reference files and a new output filename when saving reports; shell redirection can overwrite an existing destination.

## Tie the report to the files

Probe report v2 includes `inputs.before`, `inputs.after` and `inputs.cases`, each with SHA-256 and a byte count for the exact file read. Whitespace, BOM and line endings affect those digests. Preserve the three files alongside a report and compare their hashes before relying on its labels. Hashes identify bytes; they do not authenticate the author or the history of a server.

Reports omit case values, validator error text and file paths. The case files themselves contain their values; use synthetic data and inspect all exports before sharing them.

## Interpret inconclusive cases

An unknown tool/schema, unsupported dialect or failed validator compilation remains `unknown`. An old-invalid input or new-invalid output is not a valid regression witness. An unknown-only suite exits **2**, not a compatibility pass. If a report contains both a regression and unknown cases, exit **1** describes the witnessed regression; inspect the remaining cases too. Invalid files and evaluator failures emit no successful report.

The evaluator has a five-second worker deadline and 128 MiB V8 old-generation ceiling. These are bounded evaluation settings, not an OS sandbox or total-memory guarantee. The restricted decimal admission and exact `multipleOf` behavior, supported dialects, no remote schema fetching and full formats are documented in [offline comparison](offline-comparison.md).

## Capture your own definitions

In the browser workspace, connect an authorized server, refresh and load every page, then save/export a baseline. Capture a later definition list for the same catalog server. The browser comparison shows structural changes; the offline probe CLI checks the separate synthetic case suite you supply. The browser does not claim to have run those cases or called the tool.

The bundled local `add_tool` example accepts an optional convertible JSON Schema with an explicit object root, and preserves its earlier empty-object shorthand. Its converter uses the existing locked Zod dependency; conversion failures return a tool error before registration. Inspect the advertised definition because the experimental reverse converter supports a limited subset of JSON Schema. Leaving the schema unset keeps the simple name-and-description example. This fixture is not a universal JSON Schema-to-tool converter.
