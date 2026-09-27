# Contributing to ToolScope

Bug reports and focused pull requests are welcome. Target `main` and describe the observable problem, the change, and the checks you ran. For a substantial feature, open an issue first so its scope can be discussed before implementation.

A useful bug report includes the affected client (web, CLI, or terminal), operating system, Node version, reproduction steps, and expected and actual results. Share a small disposable MCP server or fixture when possible. Remove tokens, personal server configurations, and private tool results from reports and screenshots.

Follow the [README setup](README.md#run-locally) and [quality-gate guide](docs/quality-gate.md). Run checks relevant to the changed behavior and add a regression test for a bug where it can reproduce the failure. CI checks formatting, lint, types, builds, tests, coverage, and runtime behavior. Explain unavailable checks rather than reporting them as passed.

Keep changes focused, preserve existing error handling and applicable notices, and follow [AGENTS.md](AGENTS.md) for repository conventions. Contributions follow the licensing described in [LICENSE](LICENSE) and [NOTICE](NOTICE).

Report vulnerabilities through the private process in [SECURITY.md](SECURITY.md), not public issues. This repository's contribution policy is separate from MCP Inspector's upstream policy.
