/** Contract snapshots compare definitions, never tool calls or credentials. */
import { describe, expect, it, vi } from "vitest";
import {
  captureContracts,
  compareContracts,
  parseContracts,
  importContracts,
  readContractFile,
  MAX_IMPORT_BYTES,
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

describe("baseline import boundary", () => {
  const saved = captureContracts("local", [tool], "2026-09-23T00:00:00.000Z");
  it("canonicalizes imported definition keys and roundtrips export formatting", () => {
    const raw = JSON.stringify(
      { ...saved, definitions: { lookup: JSON.stringify(tool) } },
      null,
      2,
    );
    const imported = importContracts(raw, "local");
    expect(compareContracts(imported, [tool])).toEqual([]);
    expect(parseContracts(JSON.stringify(imported), "local")).toEqual(saved);
    expect(
      compareContracts(imported, [{ ...tool, description: "new" }]),
    ).toEqual([{ name: "lookup", kind: "changed", fields: ["description"] }]);
  });
  it("rejects wrong versions, servers, timestamps, shapes and mismatched names", () => {
    for (const value of [
      { ...saved, format: "toolscope.schema/v2" },
      { ...saved, server: "other" },
      { ...saved, capturedAt: "bad" },
      { ...saved, extra: true },
      {
        ...saved,
        definitions: { lookup: JSON.stringify({ ...tool, name: "other" }) },
      },
      { ...saved, definitions: { lookup: JSON.stringify({ name: "lookup" }) } },
      { ...saved, definitions: { lookup: "[]" } },
      { ...saved, definitions: { lookup: 42 } },
    ])
      expect(() => importContracts(JSON.stringify(value), "local")).toThrow();
    expect(() => importContracts("{", "local")).toThrow();
  });
  it("rejects duplicate keys including escaped names and nested schema properties", () => {
    const definition = JSON.stringify(saved.definitions.lookup);
    const raw = `{"format":"toolscope.schema/v1","server":"local","capturedAt":"2026-09-23","definitions":{"lookup":${definition},"lookup":${definition}}}`;
    expect(() => importContracts(raw, "local")).toThrow("Duplicate JSON");
    expect(() =>
      importContracts(raw.replace('"lookup":', '"\\u006cookup":'), "local"),
    ).toThrow("Duplicate JSON");
    const duplicate =
      '{"name":"lookup","inputSchema":{"type":"object","properties":{"id":{},"id":{}}}}';
    expect(() =>
      importContracts(
        JSON.stringify({ ...saved, definitions: { lookup: duplicate } }),
        "local",
      ),
    ).toThrow("Duplicate JSON");
  });
  it("bounds file bytes before reading and compact storage after normalization", async () => {
    const file = new File(["x"], "large.json");
    Object.defineProperty(file, "size", { value: MAX_IMPORT_BYTES + 1 });
    const read = vi.spyOn(file, "text");
    await expect(readContractFile(file, "local")).rejects.toThrow(
      "byte import limit",
    );
    expect(read).not.toHaveBeenCalled();
    expect(() =>
      importContracts(" ".repeat(MAX_IMPORT_BYTES + 1), "local"),
    ).toThrow("too large");
    expect(() =>
      importContracts(
        JSON.stringify({
          ...saved,
          definitions: {
            lookup: JSON.stringify({
              ...tool,
              description: "x".repeat(1_000_000),
            }),
          },
        }),
        "local",
      ),
    ).toThrow("storage limit");
    await expect(
      readContractFile(
        new File([JSON.stringify(saved, null, 2)], "baseline.json"),
        "local",
      ),
    ).resolves.toEqual(saved);
  });
  it("preserves array ordering and special names, rejects excessively deep JSON", () => {
    const named = { ...tool, name: "__proto__" };
    expect(
      compareContracts(
        importContracts(
          JSON.stringify(captureContracts("local", [named])),
          "local",
        ),
        [named],
      ),
    ).toEqual([]);
    expect(() =>
      importContracts("[".repeat(101) + "0" + "]".repeat(101), "local"),
    ).toThrow("nesting");
  });
});

it("rejects numeric overflow instead of changing imported schema values to null", () => {
  const saved = captureContracts("local", [tool]);
  for (const definition of [
    '{"name":"lookup","inputSchema":{"type":"object","properties":{"count":{"maximum":1e400}}}}',
    '{"name":"lookup","inputSchema":{"type":"object"},"extension":[-1e400]}',
  ])
    expect(() =>
      importContracts(
        JSON.stringify({ ...saved, definitions: { lookup: definition } }),
        "local",
      ),
    ).toThrow("out-of-range number");
});
