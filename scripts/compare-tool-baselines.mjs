/** Compare exported tool definitions offline using the same policy as the web app. */
import { readJsonInput } from "./lib/baseline-input.mjs";
import { compareContracts, importContracts } from "../core/toolContracts.ts";

const usage = [
  "Usage: node scripts/compare-tool-baselines.mjs baseline.json current.json",
  "Compare two ToolScope exports for the same catalog server, offline.",
  "Writes a JSON report; neither input is modified.",
  "Exit codes: 0 match, 1 differences, 2 invalid input or arguments.",
  "",
].join("\n");

async function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(usage);
    return 0;
  }
  if (args.length !== 2) {
    process.stderr.write(usage);
    return 2;
  }
  try {
    const first = await readJsonInput(args[0]);
    const header = JSON.parse(first.text);
    if (typeof header?.server !== "string" || !header.server.trim())
      throw new Error("Baseline must identify its catalog server.");
    const before = importContracts(first.text, header.server);
    const after = importContracts(
      (await readJsonInput(args[1])).text,
      before.server,
    );
    const tools = Object.values(after.definitions).map((definition) =>
      JSON.parse(definition),
    );
    const changes = compareContracts(before, tools);
    const report = {
      format: "toolscope.comparison/v1",
      server: before.server,
      matched: changes.length === 0,
      changes,
    };
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return report.matched ? 0 : 1;
  } catch (error) {
    const detail =
      error instanceof SyntaxError
        ? "Invalid baseline JSON."
        : error?.code
          ? `Unable to read baseline (${error.code}).`
          : error instanceof Error
            ? error.message
            : "Unable to compare baselines.";
    process.stderr.write(`ToolScope: ${detail}\n`);
    return 2;
  }
}

process.exitCode = await main(process.argv.slice(2));
