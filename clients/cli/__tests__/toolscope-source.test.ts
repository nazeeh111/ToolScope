// ToolScope runner regression: explicit CLI sources must outrank its example catalog.
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./helpers/cli-runner.js";

describe("ToolScope CLI source selection", () => {
  const directory = mkdtempSync(join(tmpdir(), "toolscope-cli-source-"));
  const fallback = join(directory, "default.json");
  const chosen = join(directory, "chosen.json");
  const savedCatalog = process.env.MCP_CATALOG_PATH;

  writeFileSync(fallback, '{"mcpServers":{"fallback":{"command":"node"}}}');
  writeFileSync(chosen, '{"mcpServers":{"chosen":{"command":"node"}}}');

  afterEach(() => {
    if (savedCatalog === undefined) delete process.env.MCP_CATALOG_PATH;
    else process.env.MCP_CATALOG_PATH = savedCatalog;
  });
  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  async function list(args: string[]) {
    delete process.env.MCP_CATALOG_PATH;
    const result = await runCli(
      [...args, "--method", "servers/list", "--format", "json"],
      {
        env: { TOOLSCOPE_DEFAULT_CATALOG_PATH: fallback },
      },
    );
    expect(result.exitCode).toBe(0);
    return (
      JSON.parse(result.stdout) as { result: { servers: { name: string }[] } }
    ).result.servers.map((server) => server.name);
  }

  it("uses the fallback only when no source is selected", async () => {
    expect(await list([])).toEqual(["fallback"]);
    expect(await list(["-e", "A=1", "-e", "B=2"])).toEqual(["fallback"]);
  });

  it("honors explicit catalog and read-only config", async () => {
    expect(await list(["--catalog", chosen])).toEqual(["chosen"]);
    expect(await list(["--config", chosen])).toEqual(["chosen"]);
  });

  it("does not overlay the fallback on an ad-hoc URL", async () => {
    expect(await list(["--server-url", "https://example.com/mcp"])).toEqual([
      "default",
    ]);
  });
});
