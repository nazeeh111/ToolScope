import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode, Suspense } from "react";
import { renderHook } from "@testing-library/react";
import { useObjectUrl } from "./useObjectUrl";

// Allow queued React work to settle before inspecting resource cleanup.
const flushMicrotasks = () => Promise.resolve();

describe("useObjectUrl", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an object URL for a blob and revokes it on unmount", async () => {
    const blob = new Blob(["x"], { type: "text/plain" });
    const { result, unmount } = renderHook(() => useObjectUrl(blob));
    expect(result.current).toBe("blob:mock-url");
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    unmount();
    await flushMicrotasks();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("revokes the previous URL when the blob changes", async () => {
    // Unique URLs distinguish the released resource from its replacement.
    let n = 0;
    vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:url-${n++}`);
    const first = new Blob(["a"]);
    const second = new Blob(["b"]);
    const { rerender } = renderHook(({ blob }) => useObjectUrl(blob), {
      initialProps: { blob: first },
    });
    rerender({ blob: second });
    await flushMicrotasks();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:url-0");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });

  it("keeps the committed URL live under StrictMode double-invoke", async () => {
    // StrictMode replays layout setup and cleanup. The replay publishes a
    // fresh URL, so releasing the first resource must not kill the URL the
    // committed preview receives.
    let n = 0;
    const revoked: string[] = [];
    vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:url-${n++}`);
    vi.mocked(URL.revokeObjectURL).mockImplementation((url) => {
      revoked.push(url as string);
    });
    const blob = new Blob(["x"]);
    const { result } = renderHook(() => useObjectUrl(blob), {
      wrapper: StrictMode,
    });
    await flushMicrotasks();
    expect(result.current).toBeDefined();
    expect(revoked).not.toContain(result.current);
  });

  it("releases every URL allocated for a StrictMode preview", async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    vi.mocked(URL.createObjectURL).mockImplementation(() => {
      const url = `blob:preview-${created.length}`;
      created.push(url);
      return url;
    });
    vi.mocked(URL.revokeObjectURL).mockImplementation((url) => {
      revoked.push(url as string);
    });
    const blob = new Blob(["preview"]);
    const { result, unmount } = renderHook(() => useObjectUrl(blob), {
      wrapper: StrictMode,
    });
    await flushMicrotasks();
    expect(created).toContain(result.current);
    expect(revoked).not.toContain(result.current);
    unmount();
    await flushMicrotasks();
    expect(new Set(revoked)).toEqual(new Set(created));
    expect(revoked).toHaveLength(created.length);
  });

  it("does not allocate for a preview that suspends before committing", () => {
    const pending = new Promise<void>(() => {});
    const blob = new Blob(["preview"]);
    const { unmount } = renderHook(
      () => {
        useObjectUrl(blob);
        throw pending;
      },
      {
        wrapper: ({ children }) => (
          <Suspense fallback={null}>{children}</Suspense>
        ),
      },
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    unmount();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
