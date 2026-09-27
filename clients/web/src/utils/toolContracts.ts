/** ToolScope schema baselines: compare public definitions without executing tools. */
import type { Tool } from "@modelcontextprotocol/client";

const FORMAT = "toolscope.schema/v1";
const MAX_CHARS = 1_000_000;
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

/** Ignore corrupt or foreign storage rather than treating it as a valid baseline. */
export function parseContracts(
  raw: string | null,
  server: string,
): ContractSnapshot | null {
  if (!raw || raw.length > MAX_CHARS) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.format !== FORMAT ||
      value.server !== server ||
      typeof value.capturedAt !== "string" ||
      !Number.isFinite(Date.parse(value.capturedAt)) ||
      !isRecord(value.definitions)
    )
      return null;
    const definitions: Record<string, string> = Object.create(null);
    for (const [name, definition] of Object.entries(value.definitions)) {
      if (typeof definition !== "string" || !isRecord(JSON.parse(definition)))
        return null;
      definitions[name] = definition;
    }
    return {
      format: FORMAT,
      server,
      capturedAt: value.capturedAt,
      definitions,
    };
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
