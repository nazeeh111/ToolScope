/** Structural diagnostics against actual shared comparator, without a server. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { captureContracts, compareContracts } from "../core/toolContracts.ts";

const tool = { name: "lookup", inputSchema: { type: "object" } };
const compare = (before, after) =>
  compareContracts(captureContracts("local", [{ ...tool, ...before }]), [
    { ...tool, ...after },
  ])[0];

test("identifies nested changes, escaped keys, missing subtrees and container replacements", () => {
  const before = {
    inputSchema: {
      type: "object",
      properties: { "a~/b": { type: "string" }, "": { enum: ["a", "b"] } },
      required: ["a~/b"],
    },
    description: "old",
  };
  const after = {
    inputSchema: {
      type: "object",
      properties: { "a~/b": { type: "number" }, "": { enum: ["b", "a", "c"] } },
      additionalProperties: false,
    },
    description: "new",
  };
  const change = compare(before, after);
  assert.deepEqual(change.fields, ["description", "inputSchema"]);
  assert.deepEqual(change.details, [
    { path: "/description", kind: "changed" },
    { path: "/inputSchema/additionalProperties", kind: "added" },
    { path: "/inputSchema/properties//enum/0", kind: "changed" },
    { path: "/inputSchema/properties//enum/1", kind: "changed" },
    { path: "/inputSchema/properties//enum/2", kind: "added" },
    { path: "/inputSchema/properties/a~0~1b/type", kind: "changed" },
    { path: "/inputSchema/required", kind: "removed" },
  ]);
  assert.equal(change.detailsTruncated, false);
  assert.deepEqual(compare({ extension: [] }, { extension: {} }).details, [
    { path: "/extension", kind: "changed" },
  ]);
  assert.deepEqual(compare({ extension: [0, 1] }, { extension: [0] }).details, [
    { path: "/extension/1", kind: "removed" },
  ]);
  assert.deepEqual(compare({ extension: null }, { extension: false }).details, [
    { path: "/extension", kind: "changed" },
  ]);
});

test("object order is immaterial and special keys remain data", () => {
  const left = JSON.parse('{"__proto__":1,"/":1,"~":1,"a":1}');
  const right = JSON.parse('{"a":2,"~":2,"/":2,"__proto__":2}');
  const first = compare({ extension: left }, { extension: right });
  const second = compare(
    { extension: { ...left } },
    { extension: { ...right } },
  );
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.details.map((row) => row.path),
    ["/extension/~1", "/extension/__proto__", "/extension/a", "/extension/~0"],
  );
  assert.equal(
    compare({ extension: left }, { extension: { ...left } }),
    undefined,
  );
});

test("caps details with an exact deterministic prefix, without claiming completeness", () => {
  const before = Array.from({ length: 100 }, () => 0);
  const after = Array.from({ length: 100 }, () => 1);
  const exact = compare({ extension: before }, { extension: after });
  assert.equal(exact.details.length, 100);
  assert.equal(exact.detailsTruncated, false);
  const over = compare(
    { extension: [...before, 0] },
    { extension: [...after, 1] },
  );
  assert.deepEqual(over.details, exact.details);
  assert.equal(over.detailsTruncated, true);
  const long = "x".repeat(15_999);
  const fits = compare({ [long]: 0 }, { [long]: 1 });
  assert.equal(fits.details[0].path.length, 16_000);
  assert.equal(fits.detailsTruncated, false);
  const longer = long + "x";
  const refused = compare({ [longer]: 0 }, { [longer]: 1 });
  assert.deepEqual(refused.details, []);
  assert.equal(refused.detailsTruncated, true);
  assert.deepEqual(refused.fields, [longer]);
});
