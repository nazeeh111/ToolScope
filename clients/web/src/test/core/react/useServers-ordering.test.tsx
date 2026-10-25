/** Catalog response-ordering regressions using only in-memory fetch fixtures. */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useServers } from "@inspector/core/react/useServers";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture() {
  let order = ["alpha", "beta"];
  let getGate: ReturnType<typeof deferred> | undefined;
  let putGate: ReturnType<typeof deferred> | undefined;
  let failGet = false;
  let failPut = false;
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/events")) return new Response(null, { status: 204 });
    if (init?.method === "POST") {
      order.push((JSON.parse(String(init.body)) as { id: string }).id);
      return Response.json({ ok: true });
    }
    if (init?.method === "PUT") {
      const gate = putGate;
      putGate = undefined;
      if (gate) await gate.promise;
      if (failPut)
        return Response.json({ error: "reorder rejected" }, { status: 409 });
      order = (JSON.parse(String(init.body)) as { order: string[] }).order;
      return Response.json({ ok: true });
    }
    const snapshot = Object.fromEntries(
      order.map((id) => [id, { type: "stdio", command: id }]),
    );
    const gate = getGate;
    getGate = undefined;
    const fails = failGet;
    failGet = false;
    if (gate) await gate.promise;
    return fails
      ? Response.json({ error: "old read failed" }, { status: 500 })
      : Response.json({ mcpServers: snapshot });
  };
  return {
    fetchFn,
    holdGet(fail = false) {
      getGate = deferred();
      failGet = fail;
      return getGate;
    },
    holdPut(reject = false) {
      putGate = deferred();
      failPut = reject;
      return putGate;
    },
    setOrder(ids: string[]) {
      order = ids;
    },
  };
}

async function mount(f: ReturnType<typeof fixture>) {
  const hook = renderHook(() =>
    useServers({ baseUrl: "http://fixture.invalid", fetchFn: f.fetchFn }),
  );
  await waitFor(() =>
    expect(hook.result.current.servers.map((s) => s.id)).toEqual([
      "alpha",
      "beta",
    ]),
  );
  return hook;
}

function ids(hook: Awaited<ReturnType<typeof mount>>) {
  return hook.result.current.servers.map((s) => s.id);
}

describe("useServers catalog response ordering", () => {
  it("keeps a newer completed refresh when an older read resolves last", async () => {
    const f = fixture();
    const h = await mount(f);
    const gate = f.holdGet();
    let old!: Promise<void>;
    act(() => {
      old = h.result.current.refresh();
    });
    f.setOrder(["beta", "alpha"]);
    await act(async () => {
      await h.result.current.refresh();
    });
    await act(async () => {
      gate.resolve();
      await old;
    });
    expect(ids(h)).toEqual(["beta", "alpha"]);
  });

  it("does not surface an older read failure after a newer refresh succeeds", async () => {
    const f = fixture();
    const h = await mount(f);
    const gate = f.holdGet(true);
    let old!: Promise<void>;
    act(() => {
      old = h.result.current.refresh();
    });
    await act(async () => {
      await h.result.current.refresh();
    });
    await act(async () => {
      gate.resolve();
      await old;
    });
    expect(h.result.current.error).toBeUndefined();
  });

  it("keeps a completed reorder when a pre-write read resolves last", async () => {
    const f = fixture();
    const h = await mount(f);
    const gate = f.holdGet();
    let old!: Promise<void>;
    act(() => {
      old = h.result.current.refresh();
    });
    await act(async () => {
      await h.result.current.reorderServers(["beta", "alpha"]);
    });
    await act(async () => {
      gate.resolve();
      await old;
    });
    expect(ids(h)).toEqual(["beta", "alpha"]);
  });

  it("keeps optimistic order when a read begun during the PUT returns old disk order", async () => {
    const f = fixture();
    const h = await mount(f);
    const put = f.holdPut();
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.reorderServers(["beta", "alpha"]);
    });
    await act(async () => {
      await h.result.current.refresh();
    });
    expect(ids(h)).toEqual(["beta", "alpha"]);
    await act(async () => {
      put.resolve();
      await pending;
    });
    expect(ids(h)).toEqual(["beta", "alpha"]);
  });

  it("ignores a read begun during the PUT that resolves after its final reload", async () => {
    const f = fixture();
    const h = await mount(f);
    const put = f.holdPut();
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.reorderServers(["beta", "alpha"]);
    });
    const get = f.holdGet();
    let stale!: Promise<void>;
    act(() => {
      stale = h.result.current.refresh();
    });
    await act(async () => {
      put.resolve();
      await pending;
    });
    await act(async () => {
      get.resolve();
      await stale;
    });
    expect(ids(h)).toEqual(["beta", "alpha"]);
  });

  it("ignores an older post-write reload after a newer refresh", async () => {
    const f = fixture();
    const h = await mount(f);
    const get = f.holdGet();
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.addServer("gamma", {
        type: "stdio",
        command: "g",
      });
    });
    // Let POST settle and the gated reload capture its snapshot.
    await act(async () => {
      await Promise.resolve();
    });
    f.setOrder(["gamma", "beta", "alpha"]);
    await act(async () => {
      await h.result.current.refresh();
    });
    await act(async () => {
      get.resolve();
      await pending;
    });
    expect(ids(h)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("reconciles the final disk order after overlapping reorders settle", async () => {
    const f = fixture();
    const h = await mount(f);
    const put = f.holdPut();
    let first!: Promise<void>;
    act(() => {
      first = h.result.current.reorderServers(["beta", "alpha"]);
    });
    await act(async () => {
      await h.result.current.reorderServers(["alpha", "beta"]);
    });
    expect(ids(h)).toEqual(["alpha", "beta"]);
    await act(async () => {
      put.resolve();
      await first;
    });
    expect(ids(h)).toEqual(["beta", "alpha"]);
  });

  it("reloads a successful reorder in the background and keeps reload failure distinct", async () => {
    const f = fixture();
    const h = await mount(f);
    const get = f.holdGet(true);
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.reorderServers(["beta", "alpha"]);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.result.current.loading).toBe(false);
    await act(async () => {
      get.resolve();
      await expect(pending).resolves.toBeUndefined();
    });
    expect(ids(h)).toEqual(["beta", "alpha"]);
    expect(h.result.current.error).toBe("old read failed");
  });

  it("restores disk order and rejects a failed reorder", async () => {
    const f = fixture();
    const h = await mount(f);
    const put = f.holdPut(true);
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.reorderServers(["beta", "alpha"]);
    });
    expect(ids(h)).toEqual(["beta", "alpha"]);
    await act(async () => {
      put.resolve();
      await expect(pending).rejects.toThrow("reorder rejected");
    });
    expect(ids(h)).toEqual(["alpha", "beta"]);
    expect(h.result.current.error).toBeUndefined();
  });

  it("still displays a current refresh failure", async () => {
    const f = fixture();
    const h = await mount(f);
    const gate = f.holdGet(true);
    let pending!: Promise<void>;
    act(() => {
      pending = h.result.current.refresh();
    });
    await act(async () => {
      gate.resolve();
      await pending;
    });
    expect(h.result.current.error).toBe("old read failed");
    expect(h.result.current.loading).toBe(false);
  });
});
