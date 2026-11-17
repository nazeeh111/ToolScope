# From exported definitions to a reviewable change

ToolScope can compare two saved tool-definition exports without connecting to the server. This path uses Node.js 24. The desktop browser, CLI and terminal clients have their own setup in the [README](../README.md).

## Try the included files

Download the ZIP from the [v0.3.1 release](https://github.com/nazeeh111/ToolScope/releases/tag/v0.3.1), check it against the release's `SHA256SUMS`, and extract it. From the extracted directory:

```sh
node scripts/compare-tool-baselines.mjs examples/tool-baselines/before.json examples/tool-baselines/after.json
```

No clone or npm install is needed for the kit. It contains the bundled comparison command, these synthetic files, licenses and a `manifest.json` listing source and output hashes. To run from source instead, clone the repository and run `INSPECTOR_SKIP_CLIENT_INSTALL=1 npm ci` before the same command.

Source command output includes nested details as of 2026-11-16. The previously published v0.3.1 kit retains its original top-level-only output; rebuilding the kit from this source includes the new fields. With the checked-in synthetic examples:

```json
{
  "format": "toolscope.comparison/v1",
  "server": "Synthetic baseline example",
  "matched": false,
  "changes": [
    {
      "name": "inspect_part",
      "kind": "added",
      "fields": []
    },
    {
      "name": "lookup",
      "kind": "changed",
      "fields": ["description"],
      "details": [{ "path": "/description", "kind": "changed" }],
      "detailsTruncated": false
    }
  ]
}
```

The shell receives status **1**, meaning definitions differ. It is an expected comparison result, not an installation failure. `lookup` still exists; its advertised description changed. `inspect_part` appears only in the second file. This reports definition changes, not whether consumers remain compatible. Nested `details` identify structural locations using JSON Pointer syntax: `~0` encodes a tilde and `~1` a slash in a key. Arrays compare by position. A missing subtree is reported once, and replacing a container type reports its parent path. Each changed tool has at most 100 details and 16,000 total pointer UTF-16 code units. `detailsTruncated: true` means the diagnostic prefix is incomplete; the full exported definitions remain the reference. Details do not contain repeated schema values or executable patch instructions.

## Save a result without hiding its status

Choose a new output filename. Shell redirection replaces an existing file with that name.

```sh
node scripts/compare-tool-baselines.mjs examples/tool-baselines/before.json examples/tool-baselines/after.json > comparison.json
comparison_status=$?
printf 'Comparison exit: %s\n' "$comparison_status"
cat comparison.json
```

Use `comparison_status` when integrating this with another script. Do not chain the command to the next step using `&&` if you intend to inspect differences: status 1 stops that chain.

| Exit | Meaning                    | Next action                                  |
| ---- | -------------------------- | -------------------------------------------- |
| 0    | Definitions match          | Continue the check                           |
| 1    | Definitions differ         | Read `changes` and review each definition    |
| 2    | Invalid arguments or input | Read stderr, correct the file or path, rerun |

## Check the unchanged and failure paths

```sh
# Identical definitions: status 0, matched true, empty changes.
node scripts/compare-tool-baselines.mjs examples/tool-baselines/before.json examples/tool-baselines/before.json

# Missing input: status 2; explanation on stderr, no JSON on stdout.
node scripts/compare-tool-baselines.mjs examples/tool-baselines/before.json missing-baseline.json
```

If you redirected an invalid comparison, the destination may exist but be empty. A file's existence is not a successful comparison; check the status and parse the JSON only for status 0 or 1. Correct the path and rerun the first command to recover.

## Use your own exports

In the desktop app, save and export a baseline, then capture/export a later definition list for the same catalog server. Compare those two JSON files with the same command. Both files must identify that server; unrelated server exports are rejected. Refresh and load every page before capture. See [browser capture and import boundaries](../README.md#check-a-changing-tool-interface).

The comparison never calls tools, modifies either input, authenticates the files' origin or classifies breaking changes. Definitions can contain private descriptions. Inspect both exports and the result before sharing them. The bundled examples above are synthetic, not a recorded third-party server or a compatibility benchmark.

## Build the kit from source

After installing the root lockfile, choose an output directory that does not already exist:

```sh
npm run build:offline-kit -- /path/to/new-offline-kit
```

The builder uses the already-declared Vite dependency to bundle the existing command and shared validator. It refuses unexpected runtime dependencies and preserves bundled package licenses. No source parser is replaced. The manifest records the source commit, tree, dirty state, bundle inputs and output hashes; build from a clean, pinned checkout to identify a release. An existing output directory is left unchanged. A failed new build may leave a partial directory for inspection; use a fresh destination after correcting the cause.

## Check known calls and result shapes

A structural change does not by itself show a consumer regression. Use an explicit
synthetic case suite to check known examples against both exports:

```sh
node scripts/probe-tool-baselines.mjs examples/tool-baselines/before.json examples/tool-baselines/after.json examples/tool-baselines/probes.json
```

This example exits **0**: the supplied `lookup` input is valid in both versions.
The report always says `scope: "supplied-examples-only"` and
`compatibilityProven: false`. Passing examples cannot establish compatibility for
all inputs or results, and schema validation does not execute or test a server.
The probe command runs from a source checkout with existing dependencies; the
standalone offline comparison kit continues to contain the structural comparator.

A suite uses `format: "toolscope.probes/v1"` and a `cases` array. Each case has a
unique `id` (1–80 letters, digits, dots, underscores or hyphens), `tool`,
`direction` (`input` or `output`), and JSON `value`. Input values must be objects.
Use synthetic values: baseline exports remain definition-only, and probe reports
omit values and validator error text, but the suite file itself contains them.
Suites allow 1–256 cases, at most 1,000,000 UTF-8 bytes and 100 nesting levels.

- An **input-regression** is an example accepted by the old input schema and
  rejected by the new one.
- An **output-regression** is an example accepted by the new output schema and
  rejected by the old consumer schema. Supply possible new structured results
  as output cases. This checks the reverse containment direction from inputs.
- An **accepted-example** passes both schemas.
- An **invalid-reference-case** (old input rejects it) or
  **invalid-current-case** (new output rejects it) cannot witness a regression.
- **Unknown** means a tool/schema is missing, a dialect is unsupported, or
  validation could not be completed. It never becomes a compatibility pass.

Exit codes are **0** when all supplied examples pass both schemas, **1** when at
least one concrete regression is witnessed (inspect any additional unknown cases),
and **2** for invalid input, inconclusive cases or evaluator failure. Duplicate
JSON properties and foreign-server exports are rejected. Inputs are read through
the same bounded regular-file admission as structural comparisons and never
modified.

Schemas without `$schema` use JSON Schema 2020-12. Explicit 2019-09 and draft-07
are also supported. Each schema gets an isolated Ajv instance; local references
and composition work without type coercion, inserted defaults or property removal.
No remote schema is fetched. Unknown keywords, unknown formats (including formats
that need an additional plugin), unresolved references, asynchronous schemas and
other dialects are reported as unknown. Compilation and evaluation run in a worker
with a five-second total deadline and a 128 MiB V8 old-generation ceiling. Timeout
or worker failure emits no partial success report; these limits are not an
operating-system sandbox or a total-process memory guarantee.

The probe command checks `multipleOf` with exact decimal divisibility, so `0.3`
passes `multipleOf: 0.1` while `0.30000000000000004` does not. It rejects numeric
literals whose decimal value would change when parsed as a JavaScript number,
including `9007199254740993`, overly precise fractions and nonzero underflow.
This check also covers the JSON strings containing exported tool definitions.
Rejection exits 2 without a report or the offending value. It admits ordinary
decimals, equivalent exponent spellings and negative zero. This is a bounded
numeric input domain, not arbitrary-precision JSON support. The structural
comparator and interactive clients retain their existing numeric behavior.

The schema direction follows the [MCP tool contract](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx).
Dialect selection and strict compilation use [Ajv's supported dialects](https://ajv.js.org/json-schema.html)
and [strict schema rules](https://ajv.js.org/strict-mode.html).

### Identify the exact inputs behind a probe report

The command now emits `toolscope.probe-report/v2`. Its `inputs.before`,
`inputs.after` and `inputs.cases` entries each record `sha256` and `bytes` for
the exact captured UTF-8 file bytes that were parsed. This includes whitespace,
line endings and an optional UTF-8 BOM, even though parsing strips the BOM.
Files are read once; hashing does not reopen them after validation.

Keep those input files alongside a saved report and compare their SHA-256 values
when reviewing it. A different case value or schema can reuse the same server
and case IDs, so labels alone do not identify a run. The report includes no file
paths or case values. Digests identify bytes; they do not authenticate the report
or prove compatibility. Older v1 reports do not carry this binding.
