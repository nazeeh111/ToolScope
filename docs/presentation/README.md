# Two directions through one changed MCP contract

This synthetic worked example uses ToolScope source `784e5a7be1b9f6a48949bb63c45735ae4ccdd0ee`, Node24.14.0 and the unchanged five locked dependency sets. ToolScope is adapted from MCP Inspector; the complete inherited [LICENSE](LICENSE) is retained. The fixture is deliberately small, stdio-only and public. It has no device, model, provider, real server configuration or credential requirement.

Extract `toolscope-contract-reader.zip` into an empty directory and run `python3 -B reopen.py`. This verifies all declared content bytes and independently checks **only these four enum witnesses**, plus their report/input hashes and exact preserved baseline exports. It is not a JSON Schema validator, an independent reimplementation of ToolScope or a universal compatibility/security proof.

[before.json](before.json) and [after.json](after.json) are actual browser baseline downloads. Their two advertised definitions have one changed tool. [compare-report.json](compare-report.json) is actual structural CLI output, exit1: removed `/inputSchema/properties/unit/enum/1` and added `/outputSchema/properties/status/enum/1`. [probes.json](probes.json) contains four explicitly supplied examples; [probe-report.json](probe-report.json) is the original finite checker output, exit1. Input checks ask whether the **new server accepts an old call**. Output checks ask whether the **old consumer accepts a possible new result**. Both have accepted controls, and the report keeps `compatibilityProven:false`.

## Run the real inspector

Use the repository's unchanged Node24 source setup and install/build instructions. In a new task-owned directory, make a catalog containing only this fixture. Use absolute paths to your Node executable and extracted `fixture-server.mjs`:

```json
{"mcpServers":{"Voltage fixture":{"type":"stdio","command":"/absolute/path/to/node","args":["/absolute/path/to/fixture-server.mjs"]}}}
```

Save it as `mcp.json` in that owned directory. Launch from your dependency-installed ToolScope checkout with `TOOLSCOPE_DATA_DIR=/absolute/owned/directory node scripts/toolscope.mjs --web`. The normal authenticated backend remains enabled. Do not point this example at a personal catalog, user server or credential store.

Connect **Voltage fixture** using its switch (keyboard Space also works), open Tools and save/export a baseline. Call `read_voltage` with `unit:mV`: the synthetic result is `3300,mV,ready`. Execute `advance_contract`, then **Refresh** the tool list before Compare tools; the list-change notification marks the old list stale until refreshed. The two pointers above appear. A new `unit:V` call returns `3.3,V,warming`. These are fixed fixture outputs, not measured values or a claim about conversion accuracy.

Replace/export the baseline to capture the second definition. Importing the earlier export asks for **Confirm replacement** or **Cancel import**. Cancellation preserves the current baseline and capture time; malformed JSON is refused while the saved baseline remains exportable. Reimport/confirm restores the earlier capture. [cancel-preserved.json](cancel-preserved.json) and [invalid-preserved.json](invalid-preserved.json) match `after.json` exactly. Baselines are browser state; this does not claim server mutation durability across a fresh fixture process.

The CLI also listed tools/resources/prompts, called the original millivolt tool, read `fixture://scope`, and obtained `review_contract` without invoking any model. Exact outputs are in [cli-observations.json](cli-observations.json). [workspace-desktop.png](workspace-desktop.png) and [workspace-mobile.png](workspace-mobile.png) are actual finished browser states. [phone-result.txt](phone-result.txt) is the visible completed result; [call-request-ack.json](call-request-ack.json) is only the HTTP acknowledgment, not the asynchronously delivered MCP result.

## Recheck the original CLI against extracted files

From a dependency-installed current ToolScope checkout:

```sh
node scripts/compare-tool-baselines.mjs /EXTRACTED/before.json /EXTRACTED/after.json
node scripts/probe-tool-baselines.mjs /EXTRACTED/before.json /EXTRACTED/after.json /EXTRACTED/probes.json
```

Both exit1 for these observed differences/regressions. The unchanged comparator exits0 for matching definitions and2 for invalid input. The probe command exits2 for invalid/inconclusive cases. Neither offline command connects to a server, calls a tool or needs authentication. Unsupported schemas and unknown cases are not silently accepted. A passing finite suite cannot establish universal semantic compatibility.

The [wide figure](contract.html), [narrow figure](contract-mobile.html) and editable [render.py](render.py) are source-derived explanations of the exact reports, not redrawn app UI. PNGs are actual Chrome renders, with portable Arial text. All real workflow, source, test and rendering limits are recorded in the candidate's private handoff; no release or hosted deployment is implied.
