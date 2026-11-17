/** Finite schema witnesses. No tool invocation, coercion or compatibility proof. */
import Ajv from "ajv";
import Ajv2019 from "ajv/dist/2019.js";
import Ajv2020 from "ajv/dist/2020.js";
import { importContracts } from "../../core/toolContracts.ts";
import { exactMultipleOf, parseProbeJson } from "./probe-numbers.mjs";

export function importProbeContracts(raw, server) {
  const parsed = parseProbeJson(raw);
  // Definitions are JSON strings inside the export, so check their original
  // numeric tokens before importContracts canonicalizes them.
  if (parsed?.definitions && typeof parsed.definitions === "object") {
    for (const definition of Object.values(parsed.definitions)) {
      if (typeof definition === "string") parseProbeJson(definition);
    }
  }
  return importContracts(raw, server);
}

export function parseProbeCases(raw) {
  if (new TextEncoder().encode(raw).length > 1_000_000)
    throw new Error("Probe suite exceeds the 1,000,000-byte limit.");
  const suite = parseProbeJson(raw);
  if (
    !suite ||
    typeof suite !== "object" ||
    Array.isArray(suite) ||
    Object.keys(suite).sort().join(",") !== "cases,format" ||
    suite.format !== "toolscope.probes/v1" ||
    !Array.isArray(suite.cases) ||
    suite.cases.length < 1 ||
    suite.cases.length > 256
  )
    throw new Error("Expected toolscope.probes/v1 with 1..256 cases.");
  const ids = new Set();
  for (const item of suite.cases) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).sort().join(",") !== "direction,id,tool,value" ||
      typeof item.id !== "string" ||
      !/^[a-zA-Z0-9_.-]{1,80}$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.tool !== "string" ||
      !item.tool.trim() ||
      item.tool.length > 256 ||
      !["input", "output"].includes(item.direction) ||
      (item.direction === "input" &&
        (!item.value ||
          typeof item.value !== "object" ||
          Array.isArray(item.value)))
    )
      throw new Error("Invalid probe case or duplicate case ID.");
    ids.add(item.id);
  }
  return suite;
}

function compile(schema) {
  if (schema === undefined) return { reason: "schema-missing" };
  const dialect =
    typeof schema === "object" && schema !== null ? schema.$schema : undefined;
  const Constructor =
    dialect === undefined ||
    dialect === "https://json-schema.org/draft/2020-12/schema"
      ? Ajv2020
      : dialect === "https://json-schema.org/draft/2019-09/schema"
        ? Ajv2019
        : [
              "http://json-schema.org/draft-07/schema#",
              "http://json-schema.org/draft-07/schema",
            ].includes(dialect)
          ? Ajv
          : null;
  if (!Constructor) return { reason: "unsupported-dialect" };
  try {
    const ajv = new Constructor({
      strictSchema: true,
      strictTypes: false,
      strictTuples: false,
      strictRequired: false,
      allowUnionTypes: true,
      allErrors: false,
      ownProperties: true,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false,
      // Missing references and unknown formats fail compilation. Never fetch schemas.
      logger: false,
    });
    // OpenAPI nullable is an Ajv extension, not a JSON Schema assertion.
    ajv.removeKeyword("nullable");
    // Floating division rejects valid decimals such as 0.3 / 0.1. A tolerance
    // would accept near misses; exact decimal divisibility does neither.
    ajv.removeKeyword("multipleOf");
    ajv.addKeyword({
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      metaSchema: { type: "number", exclusiveMinimum: 0 },
      validate: exactMultipleOf,
      errors: false,
    });
    const validate = ajv.compile(schema);
    if (validate.$async) return { reason: "async-schema" };
    return { validate };
  } catch {
    return { reason: "unsupported-schema" };
  }
}

export function evaluateProbeCases(before, after, suite) {
  const cache = new Map();
  function check(snapshot, side, item) {
    const key = JSON.stringify([side, item.tool, item.direction]);
    if (!cache.has(key)) {
      cache.set(
        key,
        Object.hasOwn(snapshot.definitions, item.tool)
          ? compile(
              JSON.parse(snapshot.definitions[item.tool])[
                item.direction === "input" ? "inputSchema" : "outputSchema"
              ],
            )
          : { reason: "tool-missing" },
      );
    }
    const compiled = cache.get(key);
    if (!compiled.validate)
      return { status: "unknown", reason: compiled.reason };
    try {
      return { status: compiled.validate(item.value) ? "valid" : "invalid" };
    } catch {
      return { status: "unknown", reason: "validation-failed" };
    }
  }
  const cases = suite.cases.map((item) => {
    const old = check(before, "before", item),
      current = check(after, "after", item);
    let verdict = "unknown";
    if (old.status !== "unknown" && current.status !== "unknown") {
      if (item.direction === "input") {
        verdict =
          old.status === "invalid"
            ? "invalid-reference-case"
            : current.status === "invalid"
              ? "input-regression"
              : "accepted-example";
      } else {
        verdict =
          current.status === "invalid"
            ? "invalid-current-case"
            : old.status === "invalid"
              ? "output-regression"
              : "accepted-example";
      }
    }
    // Values and validator error text never enter the report.
    return {
      id: item.id,
      tool: item.tool,
      direction: item.direction,
      before: old,
      after: current,
      verdict,
    };
  });
  return {
    server: before.server,
    scope: "supplied-examples-only",
    compatibilityProven: false,
    regressions: cases.filter((item) =>
      ["input-regression", "output-regression"].includes(item.verdict),
    ).length,
    unknown: cases.filter((item) => item.verdict === "unknown").length,
    invalidCases: cases.filter((item) => item.verdict.startsWith("invalid-"))
      .length,
    cases,
  };
}
