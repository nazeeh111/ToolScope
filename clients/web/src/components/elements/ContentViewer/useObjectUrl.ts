import { useLayoutEffect, useState } from "react";

/** Subscribe to the lifetime of a committed browser resource. */
function subscribeToObjectUrl(blob: Blob, publish: (url: string) => void) {
  const url = URL.createObjectURL(blob);
  publish(url);
  return () => URL.revokeObjectURL(url);
}

/**
 * Keep a committed preview's object URL live and release it when its blob
 * changes or the preview unmounts. Memoize the Blob in the caller.
 *
 * Render must not allocate browser resources: StrictMode can discard a render,
 * and a suspended preview may never commit. The layout subscription owns both
 * allocation and cleanup. Publishing there updates the preview before paint;
 * StrictMode's second setup publishes a fresh URL after releasing the first.
 */
export function useObjectUrl(blob: Blob): string {
  const [url, setUrl] = useState("");
  useLayoutEffect(() => subscribeToObjectUrl(blob, setUrl), [blob]);
  return url;
}
