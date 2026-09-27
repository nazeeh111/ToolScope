# ToolScope

Inspect MCP servers from a browser, terminal interface, or command line. ToolScope adapts MCP Inspector v2 with a connection workspace, saved tool-definition baselines, and bundled local examples.

MCP (Model Context Protocol) lets applications expose tools, resources, and prompts to AI clients. ToolScope exercises those interfaces directly. No language model, subscription, API key, or remote server is needed for the included examples.

## Run locally

Use Node.js 24 (upstream minimum: 22.19). Install from the five committed lockfiles:

```sh
INSPECTOR_SKIP_CLIENT_INSTALL=1 npm ci
npm --prefix clients/web ci
npm --prefix clients/cli ci
npm --prefix clients/tui ci
npm --prefix clients/launcher ci
npm run build:toolscope
npm run toolscope
```

Open the local URL printed by the launcher. The authenticated Node backend is required; this application is not a static GitHub Pages site.

The launcher creates a writable `.toolscope/mcp.json` catalog with two local stdio servers. Each server starts only when you connect. Existing catalogs are preserved. Its example paths are generated for this checkout; after moving the checkout, edit the commands in the UI or regenerate a disposable example catalog.

- **Tool contracts:** echo, structured output, and tools that add or remove a tool at runtime.
- **Resources and prompts:** synthetic resources, a resource template, prompts with arguments, and progress notifications.

## Check a changing tool interface

1. Connect **Tool contracts**, open **Tools**, and choose **Save baseline**.
2. Call `add_tool` with `name: inspect_part` and `description: Inspect a sample part`.
3. Refresh the tool list, then choose **Compare tools**. The new definition appears as added.
4. Call `remove_tool` with that name, refresh, and compare again. The original definitions match.
5. Export the baseline as JSON. In a fresh browser, select the same catalog server and choose **Import baseline** to restore it. If a baseline exists, review the capture time and confirm replacement.

Baselines contain advertised tool definitions, including input/output schemas and annotations. They exclude call arguments, results, and authentication data. They are saved per catalog server in browser local storage and survive reloads. Definitions can themselves contain sensitive descriptions; clear a baseline when appropriate. Clearing site data removes them. A comparison checks the currently loaded list; load every page and refresh after server changes. Saving and comparing are disabled if `tools/list` dropped malformed entries or the SDK excluded advertised tools with invalid `x-mcp-header` annotations. Duplicate tool names are rejected as ambiguous. Changes are reported by top-level field, not classified as breaking or non-breaking. Exports can be imported for the same catalog server identity, without executing tools or initiating a connection. Imports preserve the original capture time and require confirmation before replacing a saved baseline. Invalid files, cancelled imports and storage errors leave the previous baseline intact. Files are limited to 4,000,000 bytes before reading; normalized storage remains limited to 1,000,000 characters. Duplicate JSON keys, mismatched tool names, non-finite numbers, unsupported formats and JSON nesting beyond 100 containers are rejected. Equivalent object-key order does not count as a change. A file is a reference supplied by its author, not authenticated proof of a server’s history.

## CLI and terminal interface

The same example catalog works across all three clients:

```sh
npm run toolscope -- --cli --server "Tool contracts" --method tools/list --format json
npm run toolscope -- --tui
```

Use `node scripts/toolscope.mjs` instead of `npm run` when stdout must contain only the CLI's machine-readable result. The original upstream `mcp-inspector` binaries and connection behavior remain available. The ToolScope wrapper sets its own catalog and storage paths for default launches. Explicit `--catalog`, `--config`, and ad-hoc server arguments select their own source without an injected default catalog.

## Storage and connections

The ToolScope launcher uses `.toolscope/` for its catalog, client settings, OAuth state and logs. An inherited `MCP_CATALOG_PATH` does not replace its example catalog. Set `TOOLSCOPE_DATA_DIR` to choose another ToolScope state directory. Secrets use the in-memory backend by default and are lost when the process exits. Explicitly configuring a different secret store opts into upstream persistence behavior; see [secret storage](docs/secret-storage.md).

Connections you add may execute local commands or contact remote services. ToolScope does not require those connections for its local examples. The backend's generated session token, host checks, origin checks and OAuth protections remain enabled. The interface uses system fonts and makes no font-service requests.

The current interface inherits the upstream desktop layout and is intended for viewports at least 1280 pixels wide.

## Development and checks

```sh
npm run toolscope -- --web --dev
npm run build:toolscope
npm --prefix clients/web test
node --test scripts/toolscope.test.mjs
```

See [verification](docs/toolscope-verification.md), [adaptation notes](docs/toolscope-changes.md), and the inherited [architecture](docs/architecture.md). The validation workflow checks all four clients, coverage, and built application flows. See the [quality gate](docs/quality-gate.md) for exact commands. The repository does not publish an npm package or deploy a public backend.

## Attribution and licenses

ToolScope is an independent derivative of [MCP Inspector](https://github.com/modelcontextprotocol/inspector), baseline `1e31c78fbf81a989e8eb47021c6281d7876ad7fd` (v2.8.0). The protocol core, clients, authentication, connection management, inspectors, fixtures and most tests originate upstream. ToolScope's workspace, visual identity, schema checks and local launcher are adaptations by nazeeh111.

The upstream licensing transition preserves Apache-2.0 and MIT code notices; upstream documentation is CC-BY-4.0 except specifications. See [LICENSE](LICENSE), [NOTICE](NOTICE), and the [original README](UPSTREAM_README.md). New ToolScope code is Apache-2.0 and documentation is CC-BY-4.0.
