# ToolScope

**Inspect MCP servers. Review what changed. Check the examples your client relies on.**

A local workspace for tools, resources and prompts exposed through the Model Context Protocol. Connect a server, exercise its tools, save definition baselines and review changes. Use the offline CLI to check known call and result examples against two versions of a schema. Includes a browser client, scriptable CLI, terminal UI and local test servers.

Adapted from [MCP Inspector](https://github.com/modelcontextprotocol/inspector), with ToolScope's launcher, baseline workflows, contract checks and visual identity. The [license and attribution](LICENSE) record the inherited work. No model, subscription or API key is needed for the included synthetic examples.

## Start with a concrete change

Use **Node.js 24**. From a source checkout:

```sh
git clone https://github.com/nazeeh111/ToolScope.git
cd ToolScope
INSPECTOR_SKIP_CLIENT_INSTALL=1 npm ci
node scripts/probe-tool-baselines.mjs examples/tool-baselines/consumer-before.json examples/tool-baselines/consumer-after.json examples/tool-baselines/consumer-probes.json
```

This synthetic temperature interface drops Fahrenheit inputs and adds a new result status. The command exits **1**, identifying two concrete regression examples:

| Supplied example | Old schema | New schema | Result |
| --- | --- | --- | --- |
| Input `{ "unit": "C" }` | Accepts | Accepts | Accepted example |
| Input `{ "unit": "F" }` | Accepts | Rejects | Input regression |
| Output `{ "status": "ready" }` | Accepts | Accepts | Accepted example |
| Output `{ "status": "warming" }` | Rejects | Accepts | Output regression |

Inputs check what an existing caller can still send. Outputs check whether an existing consumer can accept a possible new result. The report records SHA-256 and byte counts for all three input files, without embedding their values or paths. It never calls a tool or connects to a server.

A passing example suite covers only those examples. Reports explicitly retain `scope: "supplied-examples-only"` and `compatibilityProven: false`. Unsupported schemas and inconclusive cases remain visible. [Walk through the report and limits](docs/review-a-tool-change.md).

<a id="run-the-desktop-app"></a>
<a id="check-a-changing-tool-interface"></a>

## Use the inspector

Install the four clients and build the local examples:

```sh
npm --prefix clients/web ci
npm --prefix clients/cli ci
npm --prefix clients/tui ci
npm --prefix clients/launcher ci
npm run build:toolscope
npm run toolscope
```

Open the printed local URL. ToolScope creates its own writable `.toolscope/mcp.json` catalog with **Tool contracts** and **Resources and prompts**. Each local server starts when you connect; existing catalogs are preserved. The authenticated Node backend is required.

1. Connect **Tool contracts**, open **Tools**, and **Save baseline**.
2. Call the synthetic `add_tool` with a name and description, then refresh the list.
3. **Compare tools** to inspect the added definition and changed JSON-pointer locations.
4. Export the baseline; import it later for the same catalog server. Existing baselines require confirmation before replacement.

Baselines contain advertised definitions, not call arguments, results or authentication data. They persist in this browser. Definitions may still contain private descriptions; inspect exports before sharing. Refresh and load every page before comparing. Malformed or incomplete lists cannot be saved as a valid baseline.

![ToolScope showing a saved baseline, an added tool and its input form](docs/images/source-preview/workspace-desktop.png)

The compact view menu switches between tools, resources, prompts and monitoring. On narrow screens the list and editor stack vertically. [Actual comparison and phone captures](docs/images/source-preview/CAPTURES.md) use the bundled synthetic server.

## Choose a surface

| Task | Command or surface |
| --- | --- |
| Inspect a server and its responses | Browser workspace |
| Read the bundled tool list as JSON | `node scripts/toolscope.mjs --cli --server "Tool contracts" --method tools/list --format json` |
| Open the terminal client | `npm run toolscope -- --tui` |
| Compare definitions, without a server | `node scripts/compare-tool-baselines.mjs baseline.json current.json` |
| Check supplied call/result examples | `node scripts/probe-tool-baselines.mjs baseline.json current.json cases.json` |

The structural comparator exits 0 for a match, 1 for differences and 2 for invalid input. The probe command exits 0 when all supplied examples are accepted, 1 when it witnesses a regression, and 2 for invalid or inconclusive input. A regression report can also contain unknown cases; read the whole result. [Full formats, numeric admission and bounded evaluation](docs/offline-comparison.md). The local `add_tool` fixture accepts a convertible object JSON Schema or the existing empty-schema shorthand; conversion failures return a tool error before registration. Inspect the advertised definition: the experimental reverse converter is not a universal JSON Schema converter.

The existing [v0.3.1 offline kit](https://github.com/nazeeh111/ToolScope/releases/tag/v0.3.1) remains a separate structural-comparison artifact. The new probe command runs from this source checkout with dependencies installed. No new release or npm package is implied.

## Local boundaries

ToolScope uses `.toolscope/` for its catalog, settings, OAuth state and logs; `TOOLSCOPE_DATA_DIR` selects another location. Secrets use the in-memory backend by default. Connections you add can execute local commands or contact remote services. Host, origin and session-token protections remain enabled. No model is needed for local inspection; connecting a third-party server retains that server's requirements.

[Complete technical guide](TECHNICAL_GUIDE.md) · [Verification](docs/source-preview-verification.md) · [Architecture](docs/architecture.md) · [Secret storage](docs/secret-storage.md) · [Contributing instructions](AGENTS.md)
