/** Bounded regular-file admission shared by offline contract commands. */
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { MAX_IMPORT_BYTES } from "../../core/toolContracts.ts";

export async function readJsonInput(path) {
  // Nonblocking open prevents a FIFO supplied as a filename from hanging admission.
  const file = await open(
    path,
    constants.O_RDONLY | (constants.O_NONBLOCK ?? 0),
  );
  try {
    const info = await file.stat();
    if (!info.isFile())
      throw new Error("Baseline input must be a regular file.");
    if (info.size > MAX_IMPORT_BYTES)
      throw new Error("Baseline file exceeds the 4,000,000-byte import limit.");
    // Read at most limit+1 even if the file grows after stat().
    const bytes = Buffer.alloc(MAX_IMPORT_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await file.read(
        bytes,
        length,
        bytes.length - length,
        length,
      );
      if (read.bytesRead === 0) break;
      length += read.bytesRead;
    }
    if (length > MAX_IMPORT_BYTES)
      throw new Error("Baseline file exceeds the 4,000,000-byte import limit.");
    try {
      const captured = bytes.subarray(0, length);
      return {
        text: new TextDecoder("utf-8", { fatal: true }).decode(captured),
        sha256: createHash("sha256").update(captured).digest("hex"),
        bytes: captured.length,
      };
    } catch {
      throw new Error("Baseline file must contain valid UTF-8.");
    }
  } finally {
    await file.close();
  }
}
