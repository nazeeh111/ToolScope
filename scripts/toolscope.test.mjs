/** ToolScope launcher keeps project state isolated and respects saved catalogs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  exampleCatalog,
  launchEnvironment,
  prepareCatalog,
} from "./toolscope.mjs";
test("examples use the current Node binary and checkout paths, never npx or HTTP", () => {
  const catalog = exampleCatalog("/example/root", "/bin/node");
  for (const config of Object.values(catalog.mcpServers)) {
    assert.equal(config.type, "stdio");
    assert.equal(config.command, "/bin/node");
    assert.equal(
      config.args[0],
      "/example/root/test-servers/build/server-composable.js",
    );
  }
});
test("isolation preserves caller environment without reading credential stores", () => {
  const env = launchEnvironment("/project", {
    OTHER: "value",
    TOOLSCOPE_DATA_DIR: "/custom",
    MCP_CATALOG_PATH: "/personal/mcp.json",
  });
  assert.equal(env.MCP_CATALOG_PATH, undefined);
  assert.equal(env.TOOLSCOPE_DEFAULT_CATALOG_PATH, "/custom/mcp.json");
  assert.equal(env.MCP_STORAGE_DIR, "/custom/storage");
  assert.equal(env.MCP_INSPECTOR_SECRET_STORE, "memory");
  assert.equal(env.OTHER, "value");
  assert.equal(
    launchEnvironment("/project", { MCP_INSPECTOR_SECRET_STORE: "file" })
      .MCP_INSPECTOR_SECRET_STORE,
    "file",
  );
});
test("an inherited catalog is never read or seeded by the default launcher", () => {
  const dir = mkdtempSync(join(tmpdir(), "toolscope-launch-"));
  try {
    const env = prepareCatalog(
      dir,
      { MCP_CATALOG_PATH: join(dir, "personal.json") },
      process.execPath,
    );
    assert.equal(env.MCP_CATALOG_PATH, undefined);
    assert.equal(
      env.TOOLSCOPE_DEFAULT_CATALOG_PATH,
      join(dir, ".toolscope/mcp.json"),
    );
    assert.equal(
      JSON.parse(readFileSync(env.TOOLSCOPE_DEFAULT_CATALOG_PATH)).mcpServers[
        "Tool contracts"
      ].type,
      "stdio",
    );
    assert.throws(() => readFileSync(join(dir, "personal.json")), {
      code: "ENOENT",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("catalog is seeded only once and preserves user's edits", () => {
  const dir = mkdtempSync(join(tmpdir(), "toolscope-launch-"));
  try {
    const env = prepareCatalog(dir, {}, process.execPath);
    assert.equal(
      Object.keys(
        JSON.parse(readFileSync(env.TOOLSCOPE_DEFAULT_CATALOG_PATH)).mcpServers,
      ).length,
      2,
    );
    writeFileSync(env.TOOLSCOPE_DEFAULT_CATALOG_PATH, '{"mcpServers":{}}');
    prepareCatalog(dir, {}, process.execPath);
    assert.equal(
      readFileSync(env.TOOLSCOPE_DEFAULT_CATALOG_PATH, "utf8"),
      '{"mcpServers":{}}',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
