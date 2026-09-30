/** Compare exported tool definitions offline using the same policy as the web app. */
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import {
  compareContracts,
  importContracts,
  MAX_IMPORT_BYTES,
} from "../core/toolContracts.ts";

const usage = [
  "Usage: node scripts/compare-tool-baselines.mjs baseline.json current.json",
  "Compare two ToolScope exports for the same catalog server, offline.",
  "Writes a JSON report; neither input is modified.",
  "Exit codes: 0 match, 1 differences, 2 invalid input or arguments.",
  "",
].join("\n");

async function readBaseline(path) {
  // Nonblocking open prevents a FIFO supplied as a filename from hanging admission.
  const file = await open(
    path,
    constants.O_RDONLY | (constants.O_NONBLOCK ?? 0),
  );
  try {
    const info = await file.stat();
    if (!info.isFile())
      throw new Error("Baseline input must be a regular file.");
    if (info.size > MAX_IMPORT_BYTES)
      throw new Error("Baseline file exceeds the 4,000,000-byte import limit.");
    // Read at most limit+1 even if the file grows after stat().
    const bytes = Buffer.alloc(MAX_IMPORT_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await file.read(
        bytes,
        length,
        bytes.length - length,
        length,
      );
      if (read.bytesRead === 0) break;
      length += read.bytesRead;
    }
    if (length > MAX_IMPORT_BYTES)
      throw new Error("Baseline file exceeds the 4,000,000-byte import limit.");
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(0, length),
      );
    } catch {
      throw new Error("Baseline file must contain valid UTF-8.");
    }
  } finally {
    await file.close();
  }
}

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
    const first = await readBaseline(args[0]);
    const header = JSON.parse(first);
    if (typeof header?.server !== "string" || !header.server.trim())
      throw new Error("Baseline must identify its catalog server.");
    const before = importContracts(first, header.server);
    const after = importContracts(await readBaseline(args[1]), before.server);
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
