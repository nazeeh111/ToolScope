/** Contract snapshots compare definitions, never tool calls or credentials. */
import { describe, expect, it } from "vitest";
import {
  captureContracts,
  compareContracts,
  parseContracts,
} from "./toolContracts";

const tool = {
  name: "lookup",
  inputSchema: {
    type: "object" as const,
    properties: { id: { type: "string" } },
  },
};

describe("tool contract snapshots", () => {
  it("round-trips a server-scoped snapshot and ignores object-key order", () => {
    const saved = captureContracts("local", [tool], "2026-09-23T00:00:00.000Z");
    expect(parseContracts(JSON.stringify(saved), "local")).toEqual(saved);
    expect(parseContracts(JSON.stringify(saved), "other")).toBeNull();
    const reordered = {
      inputSchema: {
        properties: { id: { type: "string" } },
        type: "object" as const,
      },
      name: "lookup",
    };
    expect(compareContracts(saved, [reordered])).toEqual([]);
  });
  it("reports additions, removals and changed fields without executing tools", () => {
    const saved = captureContracts("local", [
      tool,
      { name: "old", inputSchema: { type: "object" } },
    ]);
    const changes = compareContracts(saved, [
      { ...tool, inputSchema: { type: "object", required: ["id"] } },
      { name: "new", inputSchema: { type: "object" } },
    ]);
    expect(changes).toEqual([
      { name: "lookup", kind: "changed", fields: ["inputSchema"] },
      { name: "new", kind: "added", fields: [] },
      { name: "old", kind: "removed", fields: [] },
    ]);
    expect(compareContracts(saved, [])).toHaveLength(2);
  });
  it("rejects duplicate names instead of comparing ambiguous entries", () => {
    expect(() => captureContracts("local", [tool, tool])).toThrow(
      "Duplicate tool name",
    );
  });
  it("preserves array order and special property names", () => {
    const named = { ...tool, name: "__proto__", annotations: { title: "A" } };
    const saved = captureContracts("local", [named]);
    expect(
      compareContracts(saved, [{ ...named, annotations: { title: "B" } }])[0]
        ?.fields,
    ).toEqual(["annotations"]);
    const array = captureContracts("local", [
      { ...tool, inputSchema: { type: "object", required: ["a", "b"] } },
    ]);
    expect(
      compareContracts(array, [
        { ...tool, inputSchema: { type: "object", required: ["b", "a"] } },
      ]),
    ).toHaveLength(1);
  });
  it.each([
    null,
    "{",
    "null",
    "[]",
    "{}",
    '{"format":"toolscope.schema/v1","server":"local","capturedAt":"bad","definitions":{}}',
  ])("ignores malformed saved data %s", (raw) => {
    expect(parseContracts(raw, "local")).toBeNull();
  });
  it("limits stored size and validates canonical definition values", () => {
    expect(() =>
      captureContracts("local", [
        { ...tool, description: "x".repeat(1_050_000) },
      ]),
    ).toThrow("1,000,000-character storage limit");
    const saved = captureContracts("local", [tool]);
    expect(
      parseContracts(
        JSON.stringify({ ...saved, definitions: { lookup: 42 } }),
        "local",
      ),
    ).toBeNull();
    expect(
      parseContracts(
        JSON.stringify({ ...saved, definitions: { lookup: "invalid" } }),
        "local",
      ),
    ).toBeNull();
    expect(parseContracts("x".repeat(1_050_000), "local")).toBeNull();
  });
});
