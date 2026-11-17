/** Exact base-ten arithmetic for the offline probe file boundary. */
import { parseUniqueJson } from "../../core/toolContracts.ts";

// Canonical coefficient/exponent, without constructing a huge power of ten.
// Call only on valid JSON numeric tokens or finite Number strings.
function decimal(token) {
  const [mantissa, power = "0"] = token.toLowerCase().split("e");
  const negative = mantissa.startsWith("-");
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const point = unsigned.indexOf(".");
  let digits = unsigned.replace(".", "").replace(/^0+/, "");
  if (!digits) return { coefficient: "0", exponent: 0 };
  const trimmed = digits.replace(/0+$/, "");
  const exponent =
    Number(power) -
    (point < 0 ? 0 : unsigned.length - point - 1) +
    digits.length -
    trimmed.length;
  return {
    coefficient: (negative ? "-" : "") + trimmed,
    exponent,
  };
}

/** Reject changed decimal values before JSON.parse rounding can affect a verdict. */
export function parseProbeJson(raw) {
  const parsed = parseUniqueJson(raw);
  // Strings are consumed whole, including escaped quotes and embedded digits.
  for (const match of raw.matchAll(
    /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
  )) {
    const token = match[0];
    if (token.startsWith('"')) continue;
    const original = decimal(token);
    const captured = decimal(String(Number(token)));
    if (
      original.coefficient !== captured.coefficient ||
      original.exponent !== captured.exponent
    )
      throw new Error(
        "Probe JSON number loses decimal precision; no report generated.",
      );
  }
  return parsed;
}

/** Public files admit only numbers whose shortest decimal retains their value. */
export function exactMultipleOf(divisor, value) {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor <= 0)
    return false;
  const numerator = decimal(String(value));
  const denominator = decimal(String(divisor));
  const shift = numerator.exponent - denominator.exponent;
  const a = BigInt(numerator.coefficient);
  const b = BigInt(denominator.coefficient);
  return shift >= 0
    ? (a * 10n ** BigInt(shift)) % b === 0n
    : a % (b * 10n ** BigInt(-shift)) === 0n;
}
