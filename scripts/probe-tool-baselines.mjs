/** Check saved synthetic inputs/results against two advertised schemas, offline. */
import { Worker } from "node:worker_threads";
import { readJsonInput } from "./lib/baseline-input.mjs";
import {
  importProbeContracts,
  parseProbeCases,
} from "./lib/contract-probes.mjs";

const usage =
  "Usage: node scripts/probe-tool-baselines.mjs baseline.json current.json cases.json\nExit codes: 0 examples accepted, 1 witnessed regressions, 2 invalid/unknown/inconclusive.\n";
function evaluate(before, after, suite) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./lib/contract-probes-worker.mjs", import.meta.url),
      {
        workerData: { before, after, suite },
        resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
      },
    );
    let completed = false;
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(
        new Error(
          "Probe evaluation exceeded the 5-second limit; no complete report.",
        ),
      );
    }, 5000);
    worker.once("message", (report) => {
      completed = true;
      clearTimeout(timer);
      resolve(report);
    });
    worker.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Probe evaluator failed; no complete report."));
    });
    worker.once("exit", (code) => {
      clearTimeout(timer);
      if (!completed || code !== 0)
        reject(new Error("Probe evaluator stopped; no complete report."));
    });
  });
}
async function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(usage);
    return 0;
  }
  if (args.length !== 3) {
    process.stderr.write(usage);
    return 2;
  }
  try {
    const first = await readJsonInput(args[0]);
    const header = JSON.parse(first.text);
    if (typeof header?.server !== "string" || !header.server.trim())
      throw new Error("Baseline must identify its catalog server.");
    const before = importProbeContracts(first.text, header.server);
    const second = await readJsonInput(args[1]);
    const after = importProbeContracts(second.text, before.server);
    const cases = await readJsonInput(args[2]);
    const suite = parseProbeCases(cases.text);
    const evaluated = await evaluate(before, after, suite);
    const identity = ({ sha256, bytes }) => ({ sha256, bytes });
    const report = {
      format: "toolscope.probe-report/v2",
      inputs: {
        before: identity(first),
        after: identity(second),
        cases: identity(cases),
      },
      ...evaluated,
    };
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return report.regressions
      ? 1
      : report.unknown || report.invalidCases
        ? 2
        : 0;
  } catch (error) {
    const detail =
      error instanceof SyntaxError
        ? "Invalid JSON input."
        : error?.code
          ? `Unable to read probe input (${error.code}).`
          : error instanceof Error
            ? error.message
            : "Unable to run probes.";
    process.stderr.write(`ToolScope: ${detail}\n`);
    return 2;
  }
}
process.exitCode = await main(process.argv.slice(2));
