/** Browser downloads, safe suggested filenames and HTTP(S) URL checks. */

/**
 * Click a temporary anchor to download a Blob. Attach it for Firefox support;
 * defer URL revocation until the scheduled download can read the Blob.
 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Download an in-memory JSON string as `filename`. */
export function downloadJsonFile(filename: string, json: string): void {
  downloadBlob(filename, new Blob([json], { type: "application/json" }));
}

/**
 * Derive a safe suggested filename from a resource URI: the last path segment,
 * stripped of control/format characters, path separators, and characters
 * disallowed in filenames on common platforms. Falls back to `"download"` when
 * nothing usable remains.
 */
export function fileNameFromUri(uri: string): string {
  /* v8 ignore next -- String.prototype.split always returns a non-empty array, so .pop() is never undefined; the `?? ""` fallback is unreachable. */
  const tail = uri.split(/[\\/]/).pop() ?? "";
  const safe = tail
    .replace(/[\p{Cc}\p{Cf}]+/gu, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim();
  return safe.length > 0 ? safe.slice(0, 255) : "download";
}

/**
 * Parse `url` and return it only if its scheme is `http:` or `https:`;
 * otherwise null. Shared http(s)-only allowlist for opening or downloading
 * server-supplied URLs.
 */
export function isHttpUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** Export categories supported by the Inspector. */
export type ExportKind =
  | "protocol"
  | "protocol-pinned"
  | "protocol-unpinned"
  | "logs"
  | "network"
  | "console";

/**
 * Build inspector-<kind>[-<encoded server id>]-<timestamp>.json.
 * Replace timestamp colons for Windows; omit an absent or empty server id.
 */
export function buildExportFilename(
  kind: ExportKind,
  serverId: string | undefined,
  now: Date = new Date(),
): string {
  const iso = now.toISOString().replace(/:/g, "-");
  const id = serverId ? encodeURIComponent(serverId) : undefined;
  const segments = ["inspector", kind, ...(id ? [id] : []), iso];
  return `${segments.join("-")}.json`;
}
