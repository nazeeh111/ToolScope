// ToolScope runner regression: source flags are parsed before its default catalog is applied.
import { afterEach, describe, expect, it, vi } from "vitest";

const { loadTuiServers } = vi.hoisted(() => ({
  loadTuiServers: vi.fn(),
}));
vi.mock("../src/tui-servers.js", () => ({ loadTuiServers }));

import { runTui } from "../tui.js";

describe("ToolScope TUI source selection", () => {
  const savedDefault = process.env.TOOLSCOPE_DEFAULT_CATALOG_PATH;
  const savedCatalog = process.env.MCP_CATALOG_PATH;

  afterEach(() => {
    if (savedDefault === undefined)
      delete process.env.TOOLSCOPE_DEFAULT_CATALOG_PATH;
    else process.env.TOOLSCOPE_DEFAULT_CATALOG_PATH = savedDefault;
    if (savedCatalog === undefined) delete process.env.MCP_CATALOG_PATH;
    else process.env.MCP_CATALOG_PATH = savedCatalog;
    vi.clearAllMocks();
  });

  async function parsedOptions(args: string[]) {
    delete process.env.MCP_CATALOG_PATH;
    process.env.TOOLSCOPE_DEFAULT_CATALOG_PATH = "/project/mcp.json";
    loadTuiServers.mockRejectedValueOnce(new Error("captured parsed options"));
    await expect(runTui(["node", "tui", ...args])).rejects.toThrow(
      "captured parsed options",
    );
    return loadTuiServers.mock.calls[0]?.[0];
  }

  it("keeps the project catalog when -e consumes several values and there is no target", async () => {
    expect(await parsedOptions(["-e", "A=1", "B=2"])).toMatchObject({
      catalogPath: "/project/mcp.json",
      env: { A: "1", B: "2" },
      target: undefined,
    });
  });

  it("uses an explicit catalog or config without applying the project fallback", async () => {
    expect(
      await parsedOptions(["--catalog", "/chosen/mcp.json"]),
    ).toMatchObject({
      catalogPath: "/chosen/mcp.json",
    });
    vi.clearAllMocks();
    expect(
      await parsedOptions(["--config", "/chosen/config.json"]),
    ).toMatchObject({
      catalogPath: undefined,
      configPath: "/chosen/config.json",
    });
  });

  it("does not add a catalog to a positional or URL server", async () => {
    expect(await parsedOptions(["node", "server.js"])).toMatchObject({
      catalogPath: undefined,
      target: ["node", "server.js"],
    });
    vi.clearAllMocks();
    expect(
      await parsedOptions(["--server-url", "https://example.com/mcp"]),
    ).toMatchObject({
      catalogPath: undefined,
      serverUrl: "https://example.com/mcp",
    });
  });
});
