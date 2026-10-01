/** Exercise the actual offline comparison command with independently authored files. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const command = fileURLToPath(
  new URL("./compare-tool-baselines.mjs", import.meta.url),
);
const tool = {
  name: "lookup",
  inputSchema: { type: "object", properties: { id: { type: "string" } } },
};
const snapshot = (
  tools,
  server = "local",
  capturedAt = "2026-09-27T00:00:00.000Z",
) => ({
  format: "toolscope.schema/v1",
  server,
  capturedAt,
  definitions: Object.fromEntries(
    tools.map((item) => [item.name, JSON.stringify(item)]),
  ),
});

function inFiles(before, after, check) {
  const directory = mkdtempSync(join(tmpdir(), "toolscope-compare-"));
  const first = join(directory, "baseline.json");
  const second = join(directory, "current.json");
  const encode = (value) =>
    typeof value === "string" || Buffer.isBuffer(value)
      ? value
      : JSON.stringify(value);
  writeFileSync(first, encode(before));
  writeFileSync(second, encode(after));
  const original = [readFileSync(first), readFileSync(second)];
  try {
    const result = spawnSync(process.execPath, [command, first, second], {
      encoding: "utf8",
      timeout: 5000,
    });
    check(result, first, second);
    assert.deepEqual(
      [readFileSync(first), readFileSync(second)],
      original,
      "Comparison must not change either input",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("matches reordered definitions while ignoring capture-time differences", () => {
  const reordered = {
    inputSchema: { properties: { id: { type: "string" } }, type: "object" },
    name: "lookup",
  };
  inFiles(
    snapshot([tool]),
    snapshot([reordered], "local", "2026-09-30T00:00:00.000Z"),
    (result) => {
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {
        format: "toolscope.comparison/v1",
        server: "local",
        matched: true,
        changes: [],
      });
    },
  );
});

test("reports deterministic changed fields, additions and removals with exit 1", () => {
  inFiles(
    snapshot([tool, { name: "old", inputSchema: { type: "object" } }]),
    snapshot([
      { name: "new", inputSchema: { type: "object" } },
      {
        ...tool,
        description: "Updated",
        inputSchema: { type: "object", required: ["id"] },
      },
    ]),
    (result) => {
      assert.equal(result.status, 1, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {
        format: "toolscope.comparison/v1",
        server: "local",
        matched: false,
        changes: [
          {
            name: "lookup",
            kind: "changed",
            fields: ["description", "inputSchema"],
          },
          { name: "new", kind: "added", fields: [] },
          { name: "old", kind: "removed", fields: [] },
        ],
      });
    },
  );
});

test("refuses invalid and foreign baselines without a successful JSON report", () => {
  const valid = snapshot([tool]);
  const nestedDuplicate = {
    ...valid,
    definitions: {
      lookup:
        '{"name":"lookup","inputSchema":{"type":"object","properties":{"id":{},"id":{}}}}',
    },
  };
  const rawDuplicate = JSON.stringify(valid).replace(
    '"format":',
    '"server":"forged","format":',
  );
  for (const invalid of [
    "{",
    "null",
    rawDuplicate,
    nestedDuplicate,
    { ...valid, format: "other" },
    snapshot([tool], "another"),
  ]) {
    inFiles(valid, invalid, (result) => {
      assert.equal(result.status, 2);
      assert.equal(result.stdout, "");
      assert.ok(result.stderr.length > 0);
    });
  }
});

test("rejects non-finite numbers and malformed UTF-8", () => {
  const valid = snapshot([tool]);
  const overflow = {
    ...valid,
    definitions: {
      lookup:
        '{"name":"lookup","inputSchema":{"type":"object"},"x-value":1e400}',
    },
  };
  const invalidUtf8 = Buffer.concat([
    Buffer.from('{"bad":"'),
    Buffer.from([0xc3, 0x28]),
    Buffer.from('"}'),
  ]);
  for (const invalid of [overflow, invalidUtf8])
    inFiles(valid, invalid, (result) => {
      assert.equal(result.status, 2);
      assert.equal(result.stdout, "");
    });
});

test("rejects oversize regular files and non-file inputs with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "toolscope-compare-size-"));
  const big = join(directory, "large.json");
  const valid = join(directory, "valid.json");
  writeFileSync(big, "{}");
  truncateSync(big, 4_000_001);
  writeFileSync(valid, JSON.stringify(snapshot([tool])));
  try {
    for (const path of [big, directory, join(directory, "missing.json")]) {
      const result = spawnSync(process.execPath, [command, path, valid], {
        encoding: "utf8",
        timeout: 5000,
      });
      assert.equal(result.status, 2);
      assert.equal(result.stdout, "");
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("help succeeds and missing arguments fail clearly", () => {
  const help = spawnSync(process.execPath, [command, "--help"], {
    encoding: "utf8",
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /baseline.*current/i);
  const missing = spawnSync(process.execPath, [command], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.equal(missing.stdout, "");
});
