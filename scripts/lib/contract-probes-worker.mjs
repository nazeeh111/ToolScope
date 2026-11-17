/** Isolate schema compilation/validation so recursive schemas have a hard limit. */
import { parentPort, workerData } from "node:worker_threads";
import { evaluateProbeCases } from "./contract-probes.mjs";
parentPort.postMessage(
  evaluateProbeCases(workerData.before, workerData.after, workerData.suite),
);
