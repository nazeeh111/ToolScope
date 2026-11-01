# From exported definitions to a reviewable change

ToolScope can compare two saved tool-definition exports without connecting to the server. This path uses Node.js 24. The desktop browser, CLI and terminal clients have their own setup in the [README](../README.md).

## Try the included files

Download the ZIP from the [v0.3.1 release](https://github.com/nazeeh111/ToolScope/releases/tag/v0.3.1), check it against the release's `SHA256SUMS`, and extract it. From the extracted directory:

```sh
node scripts/compare-tool-baselines.mjs examples/tool-baselines/before.json examples/tool-baselines/after.json
```

No clone or npm install is needed for the kit. It contains the bundled comparison command, these synthetic files, licenses and a `manifest.json` listing source and output hashes. To run from source instead, clone the repository and run `INSPECTOR_SKIP_CLIENT_INSTALL=1 npm ci` before the same command.

Actual output reproduced on 2026-10-23 with the checked-in synthetic examples:

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
      "fields": ["description"]
    }
  ]
}
```

The shell receives status **1**, meaning definitions differ. It is an expected comparison result, not an installation failure. `lookup` still exists; its advertised description changed. `inspect_part` appears only in the second file. This reports definition changes, not whether consumers remain compatible.

## Save a result without hiding its status

Choose a new output filename. Shell redirection replaces an existing file with that name.

```sh
node scripts/compare-tool-baselines.mjs examples/tool-baselines/before.json examples/tool-baselines/after.json > comparison.json
comparison_status=$?
printf 'Comparison exit: %s\n' "$comparison_status"
cat comparison.json
```

Use `comparison_status` when integrating this with another script. Do not chain the command to the next step using `&&` if you intend to inspect differences: status 1 stops that chain.

| Exit | Meaning | Next action |
| --- | --- | --- |
| 0 | Definitions match | Continue the check |
| 1 | Definitions differ | Read `changes` and review each definition |
| 2 | Invalid arguments or input | Read stderr, correct the file or path, rerun |

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
