# Security reporting

Security updates target ToolScope's `main` branch and latest release. ToolScope is a local application; this repository does not operate a hosted backend or publish the upstream MCP Inspector npm package.

Report a vulnerability through [ToolScope's private vulnerability reporting form](https://github.com/nazeeh111/ToolScope/security/advisories/new). Include the affected revision, client, reproduction steps using disposable data, and potential impact. Do not include real credentials or sensitive tool results. Do not disclose an unpatched vulnerability in a public issue or pull request.

The reporting form is for ToolScope. A defect confined to a dependency should also follow that dependency's reporting policy. The project makes no guaranteed response-time or security-certification claim.

When running ToolScope, retain the backend's session-token, host, and origin checks. Connections can run local commands or contact remote services; use only servers you intend to trust. The bundled examples run locally and need no account credentials. The wrapper uses memory-only secrets by default. See [secret storage](docs/secret-storage.md) for explicit persistence options.
