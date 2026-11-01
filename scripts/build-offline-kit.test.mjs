/** Exercise the distributable outside the checkout, including its safety boundaries. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const builder = fileURLToPath(
  new URL("./build-offline-kit.mjs", import.meta.url),
);

test("offline kit runs independently and preserves validation and existing outputs", () => {
  const directory = mkdtempSync(join(tmpdir(), "toolscope-kit-"));
  const kit = join(directory, "kit");
  const build = () =>
    spawnSync(process.execPath, [builder, kit], {
      cwd: directory,
      encoding: "utf8",
      timeout: 30000,
    });
  try {
    const built = build();
    assert.equal(built.status, 0, built.stderr);
    const command = join(kit, "scripts/compare-tool-baselines.mjs");
    const before = "examples/tool-baselines/before.json";
    const after = "examples/tool-baselines/after.json";
    const run = (...args) =>
      spawnSync(process.execPath, [command, ...args], {
        cwd: kit,
        encoding: "utf8",
        timeout: 5000,
      });
    const original = [
      readFileSync(join(kit, before)),
      readFileSync(join(kit, after)),
    ];
    const changed = run(before, after);
    assert.equal(changed.status, 1, changed.stderr);
    assert.deepEqual(JSON.parse(changed.stdout).changes, [
      { name: "inspect_part", kind: "added", fields: [] },
      { name: "lookup", kind: "changed", fields: ["description"] },
    ]);
    const matched = run(before, before);
    assert.equal(matched.status, 0, matched.stderr);
    assert.equal(JSON.parse(matched.stdout).matched, true);
    assert.equal(run("--help").status, 0);
    assert.match(run("--help").stdout, /scripts\/compare-tool-baselines\.mjs/);

    const duplicate = original[0]
      .toString()
      .replace('"format":', '"server":"forged","format":');
    const foreign = JSON.parse(original[0]);
    foreign.server = "another server";
    for (const bytes of [
      "{",
      duplicate,
      JSON.stringify(foreign),
      Buffer.alloc(4_000_001, 32),
      Buffer.from([0xc3, 0x28]),
    ]) {
      writeFileSync(join(kit, "invalid.json"), bytes);
      const result = run(before, "invalid.json");
      assert.equal(result.status, 2, result.stderr);
      assert.equal(result.stdout, "");
      assert.ok(result.stderr.length > 0);
    }
    for (const args of [[], [before, "missing.json"], [before, "."]]) {
      const result = run(...args);
      assert.equal(result.status, 2);
      assert.equal(result.stdout, "");
    }
    assert.deepEqual(
      [readFileSync(join(kit, before)), readFileSync(join(kit, after))],
      original,
    );

    const manifestBytes = readFileSync(join(kit, "manifest.json"));
    const manifest = JSON.parse(manifestBytes);
    assert.deepEqual(
      manifest.dependencies.map((pkg) => pkg.name),
      ["@modelcontextprotocol/core", "zod"],
    );
    assert.ok(manifest.files.LICENSE);
    assert.ok(manifest.source.inputs["core/toolContracts.ts"]);
    for (const [name, entry] of Object.entries(manifest.files)) {
      const bytes = readFileSync(join(kit, name));
      assert.equal(bytes.length, entry.bytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        entry.sha256,
      );
    }
    const sentinel = join(kit, "keep.txt");
    writeFileSync(sentinel, "existing output");
    assert.equal(build().status, 2);
    assert.equal(readFileSync(sentinel, "utf8"), "existing output");
    assert.deepEqual(readFileSync(join(kit, "manifest.json")), manifestBytes);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
