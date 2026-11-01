/** Bundle the existing comparison command with its examples and license notices. */
import { build } from "vite";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const usage = "Usage: node scripts/build-offline-kit.mjs OUTPUT_DIRECTORY";
const command = "scripts/compare-tool-baselines.mjs";
const packages = ["@modelcontextprotocol/core", "zod"];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const portable = (path) => path.split(sep).join("/");

async function buildKit(destination) {
  const result = await build({
    root,
    configFile: false,
    envDir: false,
    publicDir: false,
    logLevel: "error",
    ssr: { target: "node", noExternal: true },
    build: {
      ssr: command,
      target: "node24",
      write: false,
      minify: false,
      copyPublicDir: false,
      rolldownOptions: {
        output: { entryFileNames: command, codeSplitting: false },
      },
    },
  });
  const outputs = Array.isArray(result)
    ? result.flatMap((item) => item.output)
    : result.output;
  const [chunk] = outputs;
  if (
    outputs.length !== 1 ||
    chunk.type !== "chunk" ||
    chunk.fileName !== command ||
    chunk.dynamicImports.length !== 0 ||
    chunk.imports.some((name) => !isBuiltin(name))
  ) {
    throw new Error("Expected one comparison module with only Node built-ins.");
  }

  const inputs = {};
  const bundledPackages = new Set();
  for (const id of Object.keys(chunk.modules).sort()) {
    const name = portable(relative(root, id));
    if (name.startsWith("../") || name.includes("\0")) {
      throw new Error("Unexpected bundle input outside the source tree.");
    }
    if (name.startsWith("node_modules/")) {
      const parts = name.slice("node_modules/".length).split("/");
      const pkg = parts[0].startsWith("@")
        ? parts.slice(0, 2).join("/")
        : parts[0];
      if (!packages.includes(pkg)) {
        throw new Error(
          `Review license handling for new bundled package: ${pkg}`,
        );
      }
      bundledPackages.add(pkg);
    }
    inputs[name] = digest(await readFile(id));
  }

  const files = new Map([[command, Buffer.from(chunk.code)]]);
  for (const name of [
    "LICENSE",
    "examples/tool-baselines/before.json",
    "examples/tool-baselines/after.json",
  ]) {
    files.set(name, await readFile(join(root, name)));
  }
  const dependencies = [];
  for (const name of [...bundledPackages].sort()) {
    const directory = join(root, "node_modules", name);
    const pkg = JSON.parse(
      await readFile(join(directory, "package.json"), "utf8"),
    );
    const notices = (await readdir(directory, { withFileTypes: true }))
      .filter(
        (entry) =>
          entry.isFile() && /^(license|notice|copying)(\.|$)/i.test(entry.name),
      )
      .map((entry) => entry.name)
      .sort();
    if (!notices.some((file) => /^license(\.|$)/i.test(file))) {
      throw new Error(`Missing license for ${name}`);
    }
    const paths = notices.map((file) => `third-party/${name}/${file}`);
    for (let index = 0; index < notices.length; index++) {
      files.set(paths[index], await readFile(join(directory, notices[index])));
    }
    dependencies.push({
      name,
      version: pkg.version,
      license: pkg.license,
      notices: paths,
    });
  }

  files.set(
    "README.txt",
    Buffer.from(`ToolScope offline comparison kit

Requires Node.js 24. No npm install, server, browser or account is needed.
From this extracted directory, run:

node scripts/compare-tool-baselines.mjs examples/tool-baselines/before.json examples/tool-baselines/after.json

The synthetic example exits 1: inspect_part was added and lookup's description changed.
Compare before.json with itself for exit 0. Invalid inputs return 2 on stderr.
Neither input is modified. To compare your own exported definitions:

node scripts/compare-tool-baselines.mjs baseline.json current.json

Both files must identify the same catalog server. Capture time and object-key order
are ignored; array order matters. This compares supplied definitions, not live
behavior, backward compatibility or authenticated server history. No tools are called.

Source, full desktop app and format limits:
https://github.com/nazeeh111/ToolScope
https://github.com/nazeeh111/ToolScope/blob/main/docs/offline-comparison.md

This file bundles the existing command and shared validator without source edits.
manifest.json records source and output SHA-256 hashes and bundled package versions.
The command is compiled from scripts/compare-tool-baselines.mjs and core/toolContracts.ts.

ToolScope is adapted from MCP Inspector by its maintainers and community:
https://github.com/modelcontextprotocol/inspector
Upstream baseline: 1e31c78fbf81a989e8eb47021c6281d7876ad7fd (v2.8.0).
ToolScope adaptations by nazeeh111. Independent derivative, not an official release.
New code: Apache-2.0. Documentation: CC-BY-4.0. Original terms are in LICENSE.
Bundled dependency notices are preserved under third-party/.
`),
  );

  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const vite = JSON.parse(
    await readFile(join(root, "node_modules/vite/package.json"), "utf8"),
  );
  const manifest = {
    format: "toolscope.offline-kit/v1",
    source: {
      repository: "https://github.com/nazeeh111/ToolScope",
      commit: git("rev-parse", "HEAD"),
      tree: git("rev-parse", "HEAD^{tree}"),
      dirty: git("status", "--porcelain", "--untracked-files=all") !== "",
      inputs,
    },
    build: { node: process.versions.node, vite: vite.version },
    dependencies,
    files: Object.fromEntries(
      [...files].map(([name, bytes]) => [
        name,
        { bytes: bytes.length, sha256: digest(bytes) },
      ]),
    ),
  };
  files.set(
    "manifest.json",
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
  );

  // Claim a new directory before writing; never replace an existing output.
  await mkdir(destination);
  for (const [name, bytes] of files) {
    const path = join(destination, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: "wx" });
  }
  console.log(`Offline kit written to ${destination}`);
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  console.log(usage);
} else if (args.length !== 1 || args[0].startsWith("-")) {
  console.error(usage);
  process.exitCode = 2;
} else {
  try {
    await buildKit(resolve(args[0]));
  } catch (error) {
    console.error(`ToolScope kit: ${error.message}`);
    process.exitCode = 2;
  }
}
