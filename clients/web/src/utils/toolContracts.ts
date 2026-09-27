/** ToolScope schema baselines: compare public definitions without executing tools. */
import { ToolSchema } from "@modelcontextprotocol/core";
import type { Tool } from "@modelcontextprotocol/client";

const FORMAT = "toolscope.schema/v1";
const MAX_CHARS = 1_000_000;
// Pretty-printed UTF-8 exports can be larger than their compact storage form.
export const MAX_IMPORT_BYTES = 4_000_000;
export interface ContractSnapshot {
  format: typeof FORMAT;
  server: string;
  capturedAt: string;
  definitions: Record<string, string>;
}
export interface ContractChange {
  name: string;
  kind: "added" | "removed" | "changed";
  fields: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Object key order is incidental; array order remains part of the definition. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function captureContracts(
  server: string,
  tools: Tool[],
  capturedAt = new Date().toISOString(),
): ContractSnapshot {
  const definitions: Record<string, string> = Object.create(null);
  for (const tool of tools) {
    if (Object.hasOwn(definitions, tool.name))
      throw new Error(
        `Duplicate tool name: ${tool.name}. Resolve duplicates before capturing a baseline.`,
      );
    definitions[tool.name] = canonical(tool);
  }
  const snapshot: ContractSnapshot = {
    format: FORMAT,
    server,
    capturedAt,
    definitions,
  };
  if (JSON.stringify(snapshot).length > MAX_CHARS)
    throw new Error(
      "Schema baseline exceeds the 1,000,000-character storage limit.",
    );
  return snapshot;
}

/** JSON.parse discards repeated keys. Reject that ambiguity before using a value. */
function parseUniqueJson(raw: string): unknown {
  const value: unknown = JSON.parse(raw, (_key: string, entry: unknown) => {
    if (typeof entry === "number" && !Number.isFinite(entry))
      throw new Error("Baseline contains an out-of-range number.");
    return entry;
  });
  const stack: { keys: Set<string> | null; expectingKey: boolean }[] = [];
  for (const token of raw.matchAll(/"(?:\\.|[^"\\])*"|[{}[\],:]/g)) {
    const text = token[0];
    const frame = stack.at(-1);
    if (text === "{" || text === "[") {
      if (stack.length >= 100)
        throw new Error("Baseline JSON nesting is too deep.");
      stack.push({ keys: text === "{" ? new Set() : null, expectingKey: true });
    } else if (text === "}" || text === "]") stack.pop();
    else if (text === "," && frame) frame.expectingKey = true;
    else if (text.startsWith('"') && frame?.keys && frame.expectingKey) {
      const key = JSON.parse(text) as string;
      if (frame.keys.has(key))
        throw new Error("Duplicate JSON property in baseline.");
      frame.keys.add(key);
      frame.expectingKey = false;
    }
  }
  return value;
}

/** Strict import boundary; preserve definition extensions while canonicalizing keys. */
export function importContracts(raw: string, server: string): ContractSnapshot {
  if (raw.length > MAX_IMPORT_BYTES)
    throw new Error("Baseline file is too large.");
  const value = parseUniqueJson(raw);
  if (
    !isRecord(value) ||
    value.format !== FORMAT ||
    Object.keys(value).sort().join(",") !==
      "capturedAt,definitions,format,server"
  )
    throw new Error(
      "Unsupported baseline. Expected a toolscope.schema/v1 export.",
    );
  if (value.server !== server)
    throw new Error(
      "This baseline belongs to a different server. Select its original catalog server before importing.",
    );
  if (
    typeof value.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(value.capturedAt)) ||
    !isRecord(value.definitions)
  )
    throw new Error("Invalid baseline capture time or definitions.");
  const definitions: Record<string, string> = Object.create(null);
  for (const [name, definition] of Object.entries(value.definitions)) {
    if (typeof definition !== "string")
      throw new Error("Invalid tool definition.");
    const parsed = parseUniqueJson(definition);
    if (
      !isRecord(parsed) ||
      !name.trim() ||
      parsed.name !== name ||
      !ToolSchema.safeParse(parsed).success
    )
      throw new Error("Invalid tool definition or mismatched tool name.");
    definitions[name] = canonical(parsed);
  }
  const snapshot: ContractSnapshot = {
    format: FORMAT,
    server,
    capturedAt: value.capturedAt,
    definitions,
  };
  if (JSON.stringify(snapshot).length > MAX_CHARS)
    throw new Error(
      "Schema baseline exceeds the 1,000,000-character storage limit.",
    );
  return snapshot;
}

/** Inspect File.size before allocating its text; importing never contacts a server. */
export async function readContractFile(
  file: File,
  server: string,
): Promise<ContractSnapshot> {
  if (file.size > MAX_IMPORT_BYTES)
    throw new Error("Baseline file exceeds the 4,000,000-byte import limit.");
  return importContracts(await file.text(), server);
}

/** Ignore corrupt or foreign storage rather than treating it as a valid baseline. */
export function parseContracts(
  raw: string | null,
  server: string,
): ContractSnapshot | null {
  if (!raw || raw.length > MAX_CHARS) return null;
  try {
    return importContracts(raw, server);
  } catch {
    return null;
  }
}

export function compareContracts(
  baseline: ContractSnapshot,
  tools: Tool[],
): ContractChange[] {
  const current = captureContracts(baseline.server, tools).definitions;
  const names = [
    ...new Set([...Object.keys(baseline.definitions), ...Object.keys(current)]),
  ].sort();
  const changes: ContractChange[] = [];
  for (const name of names) {
    if (!Object.hasOwn(baseline.definitions, name))
      changes.push({ name, kind: "added", fields: [] });
    else if (!Object.hasOwn(current, name))
      changes.push({ name, kind: "removed", fields: [] });
    else if (baseline.definitions[name] !== current[name]) {
      const before = JSON.parse(baseline.definitions[name]) as Record<
        string,
        unknown
      >;
      const after = JSON.parse(current[name]) as Record<string, unknown>;
      const fields = [
        ...new Set([...Object.keys(before), ...Object.keys(after)]),
      ]
        .sort()
        .filter(
          (key) =>
            Object.hasOwn(before, key) !== Object.hasOwn(after, key) ||
            canonical(before[key]) !== canonical(after[key]),
        );
      changes.push({ name, kind: "changed", fields });
    }
  }
  return changes;
}
