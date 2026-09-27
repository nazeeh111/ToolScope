# ToolScope publication scope

ToolScope is a local adaptation of MCP Inspector with web, CLI, and TUI interfaces plus tool-schema baselines. The original project and its maintainers retain attribution through `LICENSE`, `NOTICE`, `UPSTREAM_README.md`, and the web-served license and notice files. The implementation and adaptation notes are in this source tree; the original source checkout is preserved separately for recovery.

The public repository may accept ordinary source contributions, but the copied upstream organization policies, issue bots, agent-skill evaluation, npm publish path, and container release path do not apply here. The active CI workflow checks source and built behavior only. It has no publishing or deployment job and requires no paid model service, account secret, or separately billed API.

Use Node 24 and the five-lockfile clean install in [the quality-gate guide](quality-gate.md). The launcher provides the web, CLI, and TUI modes. `npm run build` builds all four clients; `npm run build:toolscope` also builds local example MCP servers. `npm run toolscope` opens the web workspace, where the Tools screen provides schema baselines. See the README for user commands and examples.

A publication candidate needs evidence from format, lint, TypeScript, unit and integration tests, 90% per-file coverage, launcher and client smoke tests, browser interactions, and manual browser inspection. Report each command as passed, failed, or unavailable. A workflow file that parses locally is still unverified on GitHub until its first run. No package or backend is published by these checks.
