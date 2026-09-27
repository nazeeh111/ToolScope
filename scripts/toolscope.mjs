#!/usr/bin/env node
/** ToolScope local launcher: portable example catalog and separate project state.
 * No external servers or package runners are seeded. Existing catalogs are never overwritten.
 * Secrets stay in memory by default; the upstream authenticated backend is unchanged.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export function exampleCatalog(root, executable) {
  const command = (config) => ({
    type: "stdio",
    command: executable,
    args: [
      join(root, "test-servers/build/server-composable.js"),
      "--config",
      join(root, "examples/toolscope", config),
    ],
  });
  return {
    mcpServers: {
      "Tool contracts": command("contracts.json"),
      "Resources and prompts": command("resources.json"),
    },
  };
}

export function launchEnvironment(root, environment) {
  const data = resolve(
    environment.TOOLSCOPE_DATA_DIR || join(root, ".toolscope"),
  );
  const env = {
    ...environment,
    // The client runners apply this only after parsing their own source flags.
    // Never forward an inherited upstream catalog of personal servers.
    TOOLSCOPE_DEFAULT_CATALOG_PATH: join(data, "mcp.json"),
    MCP_STORAGE_DIR: join(data, "storage"),
    MCP_CLIENT_CONFIG_PATH: join(data, "storage/client.json"),
    MCP_INSPECTOR_OAUTH_STATE_PATH: join(data, "storage/oauth.json"),
    MCP_INSPECTOR_LOG_DIR: join(data, "logs"),
    MCP_INSPECTOR_SECRET_STORE:
      environment.MCP_INSPECTOR_SECRET_STORE || "memory",
  };
  delete env.MCP_CATALOG_PATH;
  return env;
}

export function prepareCatalog(root, environment, executable) {
  const env = launchEnvironment(root, environment);
  const catalogPath = env.TOOLSCOPE_DEFAULT_CATALOG_PATH;
  if (!existsSync(catalogPath)) {
    mkdirSync(dirname(catalogPath), { recursive: true });
    try {
      writeFileSync(
        catalogPath,
        JSON.stringify(exampleCatalog(root, executable), null, 2) + "\n",
        { flag: "wx", mode: 0o600 },
      );
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  return env;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const launcher = join(root, "clients/launcher/build/index.js");
  const server = join(root, "test-servers/build/server-composable.js");
  if (!existsSync(launcher) || !existsSync(server))
    throw new Error("Build ToolScope first: npm run build:toolscope");
  const args = process.argv.slice(2);
  const env = prepareCatalog(root, process.env, process.execPath);
  const child = spawn(process.execPath, [launcher, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => child.kill(signal));
  const code = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (status) => resolveExit(status ?? 1));
  });
  process.exitCode = code;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
