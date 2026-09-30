/** Browser file admission over the shared ToolScope snapshot implementation. */
import {
  importContracts,
  MAX_IMPORT_BYTES,
  type ContractSnapshot,
} from "@inspector/core/toolContracts";

export {
  captureContracts,
  compareContracts,
  importContracts,
  MAX_IMPORT_BYTES,
  parseContracts,
} from "@inspector/core/toolContracts";
export type {
  ContractChange,
  ContractSnapshot,
} from "@inspector/core/toolContracts";

/** Inspect File.size before allocating text; importing never contacts a server. */
export async function readContractFile(
  file: File,
  server: string,
): Promise<ContractSnapshot> {
  if (file.size > MAX_IMPORT_BYTES)
    throw new Error("Baseline file exceeds the 4,000,000-byte import limit.");
  return importContracts(await file.text(), server);
}
