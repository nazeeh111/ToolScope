# ToolScope adaptations

Upstream baseline: `1e31c78fbf81a989e8eb47021c6281d7876ad7fd`.

The shared protocol/authentication core and upstream client commands are retained.

- Connection workspace and tool-schema baseline capture/comparison/export UI.
- Stable definition comparison with storage validation, duplicate-name rejection and error recovery.
- Local example catalog and launcher with project-scoped state and memory-only secrets by default.
- Original mark, system typography, teal palette, and local About/license documents.
- The default launcher ignores an inherited `MCP_CATALOG_PATH` and seeds only its project catalog. `TOOLSCOPE_DATA_DIR` changes that directory. Explicit `--catalog`, `--config`, and ad-hoc server arguments bypass default-catalog injection and use their own source.
- Schema capture and comparison require a ready, complete `tools/list`, including no entries dropped by the Inspector's malformed-item salvage and no advertised tools excluded by the SDK for invalid `x-mcp-header` annotations. The existing warnings remain available for diagnosis.
- The interface retains the upstream desktop layout with a 1280-pixel minimum viewport width.

The publication checkout replaces upstream organization bots and release automation with a validation-only workflow. It preserves applicable format, lint, type, build, unit, integration, coverage, and runtime checks. See [the quality gate](quality-gate.md).

## How schema comparison works

The shared managed and paged tool stores expose whether the current list is ready. `ToolsScreen` combines that state with pagination, load errors, malformed entries, and SDK exclusions. An incomplete list disables capture and comparison: otherwise a dropped or unloaded tool could look like a genuine removal.

`toolContracts.ts` sorts object keys recursively while preserving array order, then stores each advertised definition under its tool name. This avoids changes caused only by JSON key order. Duplicate names are rejected because a name must identify one definition. The snapshot contains no tool-call arguments or results and is limited to 1,000,000 characters.

`ToolContractPanel` stores one baseline per catalog server in browser local storage. After a refresh or reconnect, comparison reports added and removed names and changed top-level fields. A schema difference is not automatically a compatibility failure: that judgment depends on the client's expectations. New comparison policies belong in `toolContracts.ts`; the panel handles storage, actions, and presentation.

The launcher generates local examples and supplies a separate default-catalog hint. Each client applies it after parsing its own arguments, so an explicit catalog, session file, or ad-hoc server takes precedence. This avoids duplicating three clients' argument grammars in a wrapper and prevents an inherited personal catalog from becoming the default.

## Changed source

Modified upstream files at adaptation time:

- `.gitignore`
- `README.md`
- `clients/cli/src/cli.ts`
- `clients/tui/tui.tsx`
- `clients/web/index.html`
- `clients/web/server/run-web.ts`
- `clients/web/src/App.test.tsx`
- `clients/web/src/App.tsx`
- `clients/web/src/components/elements/CopyrightBadge/CopyrightBadge.test.tsx`
- `clients/web/src/components/elements/CopyrightBadge/CopyrightBadge.tsx`
- `clients/web/src/components/groups/ViewHeader/ViewHeader.test.tsx`
- `clients/web/src/components/groups/ViewHeader/ViewHeader.tsx`
- `clients/web/src/components/screens/ServerListScreen/ServerListScreen.tsx`
- `clients/web/src/components/screens/ToolsScreen/ToolsScreen.test.tsx`
- `clients/web/src/components/screens/ToolsScreen/ToolsScreen.tsx`
- `clients/web/src/components/views/InspectorView/InspectorView.test.tsx`
- `clients/web/src/components/views/InspectorView/InspectorView.tsx`
- `clients/web/src/components/views/InspectorView/types.ts`
- `clients/web/src/hooks/useInspectorStores.ts`
- `clients/web/src/test/core/mcp/state/managedToolsState.test.ts`
- `clients/web/src/test/integration/server/run-web.test.ts`
- `clients/web/src/theme/Button.ts`
- `clients/web/src/theme/Card.ts`
- `clients/web/src/theme/theme.ts`
- `core/mcp/state/managedToolsState.ts`
- `core/mcp/state/pagedToolsState.ts`
- `core/react/useManagedTools.ts`
- `core/react/usePagedTools.ts`
- `package.json`

New ToolScope modules and examples carry their purpose in file comments; the original LICENSE and copyright notices are preserved. New code is Apache-2.0; new documentation is CC-BY-4.0.

The clean publication build, all four coverage gates, formatting, lint, TypeScript, maintenance guards, and final browser comparison passed. See [verification](toolscope-verification.md) for commands, observed behavior, and limits.
