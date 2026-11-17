/** Actual Ajv/schema and command controls for finite compatibility witnesses. */
import test from "node:test";
import { createHash } from "node:crypto";
import { readJsonInput } from "./lib/baseline-input.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { captureContracts } from "../core/toolContracts.ts";
import {
  evaluateProbeCases,
  importProbeContracts,
  parseProbeCases,
} from "./lib/contract-probes.mjs";
import { exactMultipleOf, parseProbeJson } from "./lib/probe-numbers.mjs";

const tool = (inputSchema, outputSchema) => ({
  name: "lookup",
  inputSchema,
  ...(outputSchema === undefined ? {} : { outputSchema }),
});
const snapshot = (...tools) =>
  captureContracts("Synthetic", tools, "2026-11-16T00:00:00Z");
const suite = (...cases) => ({ format: "toolscope.probes/v1", cases });
const item = (id, direction, value) => ({
  id,
  tool: "lookup",
  direction,
  value,
});
const base = {
  type: "object",
  properties: { q: { type: "string" } },
  additionalProperties: false,
};
const required = { ...base, required: ["q"] };
const outputBefore = {
  type: "object",
  properties: { state: { enum: ["ready"] } },
  required: ["state"],
};
const outputAfter = {
  type: "object",
  properties: { state: { enum: ["ready", "queued"] } },
  required: ["state"],
};

test("decimal multiples are exact across dialects, signs, exponents and near misses", () => {
  for (const dialect of [
    undefined,
    "http://json-schema.org/draft-07/schema#",
    "https://json-schema.org/draft/2019-09/schema",
  ]) {
    const schema = (multipleOf) => ({
      type: "object",
      ...(dialect ? { $schema: dialect } : {}),
      properties: { x: { type: "number", multipleOf } },
    });
    const s = snapshot(tool(schema(0.1)));
    const values = [0, 0.3, -0.3, 0.30000000000000004, 0.29999999999999993];
    const result = evaluateProbeCases(
      s,
      s,
      suite(...values.map((x, i) => item(`decimal-${i}`, "input", { x }))),
    );
    assert.deepEqual(
      result.cases.map((x) => x.before.status),
      ["valid", "valid", "valid", "invalid", "invalid"],
    );
    for (const bad of [0, -0.1, "0.1"]) {
      const invalid = snapshot(tool(schema(bad)));
      assert.equal(
        evaluateProbeCases(
          invalid,
          invalid,
          suite(item("bad", "input", { x: 0.3 })),
        ).unknown,
        1,
      );
    }
  }
  for (const [divisor, value, expected] of [
    [0.01, 4.02, true],
    [0.01, 4.021, false],
    [1e-300, 3e-300, true],
    [1e-300, 3.1e-300, false],
    [1e300, 3e300, true],
    [1e300, 3.1e300, false],
    [5e-324, 1e-323, true],
    [5e-324, 1.5e-323, true],
    [1e308, 0, true],
    [1e308, 1e-308, false],
  ])
    assert.equal(
      exactMultipleOf(divisor, value),
      expected,
      `${value}/${divisor}`,
    );
});

test("probe files reject rounded numbers in cases and string-encoded definitions", () => {
  for (const raw of [
    "9007199254740993",
    "0.10000000000000001",
    "1e-999",
    "9007199254740992.1",
  ])
    assert.throws(
      () => parseProbeJson(`{"x":${raw}}`),
      /loses decimal precision/,
    );
  for (const raw of [
    "0.1",
    "1.00e3",
    "-0e999999999999999999",
    "5e-324",
    "1e308",
    "9007199254740992",
  ])
    assert.deepEqual(
      parseProbeJson(`{"x":${raw}}`),
      JSON.parse(`{"x":${raw}}`),
    );
  assert.deepEqual(parseProbeJson('{"text":"0.10000000000000001\\\"1e-999"}'), {
    text: '0.10000000000000001"1e-999',
  });
  const cases = JSON.stringify(
    suite(item("round", "input", { x: "REPLACE" })),
  ).replace('"REPLACE"', "9007199254740993");
  assert.throws(() => parseProbeCases(cases), /loses decimal precision/);
  const s = snapshot(
    tool({ type: "object", properties: { x: { const: "REPLACE" } } }),
  );
  s.definitions.lookup = s.definitions.lookup.replace(
    '"REPLACE"',
    "9007199254740993",
  );
  assert.throws(
    () => importProbeContracts(JSON.stringify(s), s.server),
    /loses decimal precision/,
  );
});

test("witnesses rejected old inputs and new outputs rejected by old consumers", () => {
  const report = evaluateProbeCases(
    snapshot(tool(base, outputBefore)),
    snapshot(tool(required, outputAfter)),
    suite(
      item("old-call", "input", {}),
      item("normal", "input", { q: "part" }),
      item("new-result", "output", { state: "queued" }),
      item("old-result", "output", { state: "ready" }),
      item("bad-call", "input", { q: 42 }),
      item("bad-result", "output", { state: "not-a-state" }),
    ),
  );
  assert.deepEqual(
    report.cases.map((x) => x.verdict),
    [
      "input-regression",
      "accepted-example",
      "output-regression",
      "accepted-example",
      "invalid-reference-case",
      "invalid-current-case",
    ],
  );
  assert.equal(report.regressions, 2);
  assert.equal(report.invalidCases, 2);
  assert.equal(report.compatibilityProven, false);
  assert.equal(report.scope, "supplied-examples-only");
});

test("uses real 2020-12 refs, composition and unevaluatedProperties without mutating values", () => {
  const schema = {
    type: "object",
    $defs: { name: { type: "string", minLength: 2 } },
    allOf: [{ properties: { q: { $ref: "#/$defs/name" } }, required: ["q"] }],
    unevaluatedProperties: false,
  };
  const before = snapshot(tool(schema)),
    after = snapshot(tool(schema));
  const data = suite(
    item("yes", "input", { q: "ok" }),
    item("short", "input", { q: "x" }),
    item("extra", "input", { q: "ok", extra: 1 }),
  );
  const original = JSON.stringify(data);
  assert.deepEqual(
    evaluateProbeCases(before, after, data).cases.map((x) => x.before.status),
    ["valid", "invalid", "invalid"],
  );
  assert.equal(JSON.stringify(data), original);
});

test("draft-07 and 2019-09 are selected explicitly; unsupported validation is unknown", () => {
  for (const dialect of [
    "http://json-schema.org/draft-07/schema#",
    "https://json-schema.org/draft/2019-09/schema",
  ]) {
    const s = snapshot(tool({ ...required, $schema: dialect }));
    assert.equal(
      evaluateProbeCases(s, s, suite(item("draft", "input", { q: "ok" })))
        .cases[0].verdict,
      "accepted-example",
    );
  }
  for (const schema of [
    { type: "object", $schema: "https://unknown.invalid/schema" },
    { type: "object", $ref: "https://never-fetch.invalid/schema" },
    { type: "object", properties: { q: { type: "string", format: "email" } } },
    { type: "object", customAssertion: true },
    { type: "object", $async: true },
  ]) {
    const s = snapshot(tool(schema));
    const report = evaluateProbeCases(
      s,
      s,
      suite(item("unknown", "input", { q: "not-an-email" })),
    );
    assert.equal(report.unknown, 1);
    assert.equal(report.cases[0].before.status, "unknown");
  }
  const s = snapshot(tool(base));
  assert.equal(
    evaluateProbeCases(s, s, suite(item("no-output-schema", "output", {})))
      .unknown,
    1,
  );
  assert.equal(
    evaluateProbeCases(s, snapshot(), suite(item("removed", "input", {})))
      .cases[0].after.reason,
    "tool-missing",
  );
});

test("finite type acceptance matrix matches independent JavaScript domain predicates", () => {
  const values = [null, false, 0, 1.5, "", "abc", [], {}, [1]];
  const predicates = {
    string: (x) => typeof x === "string",
    number: (x) => typeof x === "number",
    integer: Number.isInteger,
    boolean: (x) => typeof x === "boolean",
    array: Array.isArray,
    object: (x) => x !== null && typeof x === "object" && !Array.isArray(x),
    null: (x) => x === null,
  };
  for (const [type, accepts] of Object.entries(predicates)) {
    const before = snapshot(
      tool({ type: "object", properties: { x: {} }, required: ["x"] }),
    );
    const after = snapshot(
      tool({ type: "object", properties: { x: { type } }, required: ["x"] }),
    );
    const report = evaluateProbeCases(
      before,
      after,
      suite(...values.map((x, i) => item(`case-${i}`, "input", { x }))),
    );
    assert.deepEqual(
      report.cases.map((x) => x.verdict),
      values.map((x) => (accepts(x) ? "accepted-example" : "input-regression")),
      type,
    );
  }
});

test("case import rejects ambiguous JSON, bad IDs, nonobject inputs and excessive data", () => {
  assert.deepEqual(
    parseProbeCases(JSON.stringify(suite(item("ok", "input", {})))).cases[0]
      .value,
    {},
  );
  for (const data of [
    suite(),
    suite(item("same", "input", {}), item("same", "input", {})),
    suite(item("bad space", "input", {})),
    suite(item("array", "input", [])),
    suite({ ...item("extra", "input", {}), extra: true }),
  ])
    assert.throws(() => parseProbeCases(JSON.stringify(data)));
  assert.throws(
    () =>
      parseProbeCases('{"format":"toolscope.probes/v1","cases":[],"cases":[]}'),
    /Duplicate/,
  );
  assert.throws(() => parseProbeCases("x".repeat(1_000_001)), /limit/);
  assert.throws(
    () =>
      parseProbeCases(
        JSON.stringify(
          suite(item("large", "input", { q: "🌍".repeat(260000) })),
        ),
      ),
    /limit/,
  );
});

function command(before, after, cases) {
  const dir = mkdtempSync(join(tmpdir(), "toolscope-probes-"));
  const paths = ["before.json", "after.json", "cases.json"].map((x) =>
    join(dir, x),
  );
  [before, after, cases].forEach((x, i) =>
    writeFileSync(paths[i], JSON.stringify(x)),
  );
  const originals = paths.map((x) => readFileSync(x));
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("./probe-tool-baselines.mjs", import.meta.url)),
      ...paths,
    ],
    { encoding: "utf8", timeout: 12000 },
  );
  paths.forEach((x, i) => assert.deepEqual(readFileSync(x), originals[i]));
  assert.equal(result.error, undefined);
  return result;
}
test("actual command distinguishes success, regression and inconclusive without echoing values", () => {
  const before = snapshot(tool(base, outputBefore)),
    after = snapshot(tool(required, outputAfter));
  const good = command(
    before,
    after,
    suite(item("good", "input", { q: "PRIVATE-FIXTURE-SENTINEL" })),
  );
  assert.equal(good.status, 0, good.stderr);
  assert.equal(JSON.parse(good.stdout).compatibilityProven, false);
  assert.doesNotMatch(good.stdout + good.stderr, /PRIVATE-FIXTURE-SENTINEL/);
  const bad = command(before, after, suite(item("regression", "input", {})));
  assert.equal(bad.status, 1, bad.stderr);
  assert.equal(JSON.parse(bad.stdout).regressions, 1);
  const unknown = command(
    before,
    after,
    suite(item("invalid", "input", { q: 42 })),
  );
  assert.equal(unknown.status, 2, unknown.stderr);
  assert.equal(JSON.parse(unknown.stdout).invalidCases, 1);
  const foreign = command(
    before,
    { ...after, server: "Different" },
    suite(item("ok", "input", {})),
  );
  assert.equal(foreign.status, 2);
  assert.equal(foreign.stdout, "");
});
test("actual command terminates pathological schema evaluation with no partial success", () => {
  const s = snapshot(
    tool({
      type: "object",
      properties: { q: { type: "string", pattern: "^(a+)+$" } },
    }),
  );
  const result = command(
    s,
    s,
    suite(item("expensive", "input", { q: "a".repeat(40) + "!" })),
  );
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /5-second limit/);
});

test("JSON data validation ignores inherited object members and refuses OpenAPI nullable", () => {
  const schema = { type: "object", required: ["toString"] };
  const s = snapshot(tool(schema));
  assert.equal(
    evaluateProbeCases(s, s, suite(item("own-only", "input", {}))).cases[0]
      .before.status,
    "invalid",
  );
  const extension = snapshot(
    tool({
      type: "object",
      properties: { q: { type: "string", nullable: true } },
    }),
  );
  assert.equal(
    evaluateProbeCases(
      extension,
      extension,
      suite(item("extension", "input", { q: null })),
    ).unknown,
    1,
  );
});

test("saved report binds raw BOM, whitespace and multibyte bytes without exposing values or paths", () => {
  const s = snapshot(tool(base));
  const raw = [
    Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(JSON.stringify(s, null, 2) + "\r\n"),
    ]),
    Buffer.from(JSON.stringify(s) + "\n"),
    Buffer.from(
      JSON.stringify(
        suite(item("stable-id", "input", { q: "PRIVATE-隱私-🌍" })),
        null,
        2,
      ) + "\r\n",
    ),
  ];
  const dir = mkdtempSync(join(tmpdir(), "toolscope-bound-report-"));
  const paths = ["before.json", "after.json", "cases.json"].map((x) =>
    join(dir, x),
  );
  paths.forEach((path, i) => writeFileSync(path, raw[i]));
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("./probe-tool-baselines.mjs", import.meta.url)),
      ...paths,
    ],
    { encoding: "utf8", timeout: 12000 },
  );
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.format, "toolscope.probe-report/v2");
  assert.deepEqual(
    report.inputs,
    Object.fromEntries(
      ["before", "after", "cases"].map((key, i) => [
        key,
        {
          sha256: createHash("sha256").update(raw[i]).digest("hex"),
          bytes: raw[i].length,
        },
      ]),
    ),
  );
  assert.doesNotMatch(result.stdout, /PRIVATE|隱私|🌍/);
  assert.equal(result.stdout.includes(dir), false);
});

test("same labels with changed cases or schemas have distinct saved report identities", () => {
  const before = snapshot(tool(base)),
    after = snapshot(tool(required));
  const firstCases = suite(item("same-id", "input", { q: "first" }));
  const first = command(before, after, firstCases);
  const second = command(
    before,
    after,
    suite(item("same-id", "input", { q: "second" })),
  );
  const third = command(
    before,
    snapshot(tool({ ...required, minProperties: 1 })),
    firstCases,
  );
  for (const result of [first, second, third])
    assert.equal(result.status, 0, result.stderr);
  const [a, b, c] = [first, second, third].map((x) => JSON.parse(x.stdout));
  assert.equal(a.server, b.server);
  assert.equal(a.cases[0].id, b.cases[0].id);
  assert.deepEqual(a.inputs.before, b.inputs.before);
  assert.deepEqual(a.inputs.after, b.inputs.after);
  assert.notDeepEqual(a.inputs.cases, b.inputs.cases);
  assert.deepEqual(a.inputs.cases, c.inputs.cases);
  assert.notDeepEqual(a.inputs.after, c.inputs.after);
});

test("captured input text and digest remain one read when its file changes afterwards", async () => {
  const dir = mkdtempSync(join(tmpdir(), "toolscope-captured-input-")),
    path = join(dir, "input.json");
  const original = Buffer.from(JSON.stringify({ source: "first" }) + "\n");
  writeFileSync(path, original);
  const captured = await readJsonInput(path);
  writeFileSync(path, JSON.stringify({ source: "replacement" }));
  assert.deepEqual(JSON.parse(captured.text), { source: "first" });
  assert.equal(
    captured.sha256,
    createHash("sha256").update(original).digest("hex"),
  );
  assert.equal(captured.bytes, original.length);
  assert.notEqual(
    captured.sha256,
    createHash("sha256").update(readFileSync(path)).digest("hex"),
  );
});
