import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, fireEvent, waitFor } from "@testing-library/react";
import type { ReadResourceResult } from "@modelcontextprotocol/client";
import { renderWithMantine, screen } from "../../../test/renderWithMantine";
import { ResourceLink } from "./ResourceLink";
// Keep assertions on ownership of the exact result, not Ace's virtualization.
vi.mock("../../elements/ContentViewer/ContentViewer", () => ({
  ContentViewer: ({ block }: { block: { text: string } }) => (
    <pre data-testid="read-result">{block.text}</pre>
  ),
}));
const result = (uri: string): ReadResourceResult => ({
  contents: [{ uri, text: `body:${uri}`, mimeType: "text/plain" }],
});
async function expand(uri: string) {
  await userEvent
    .setup({ delay: null })
    .click(screen.getByRole("button", { name: `Expand resource ${uri}` }));
}
function show(
  uri: string,
  onReadResource: (uri: string) => Promise<ReadResourceResult>,
) {
  return <ResourceLink uri={uri} onReadResource={onReadResource} />;
}

describe("ResourceLink URI association", () => {
  it("does not show the previous URI's cached result when the same mounted row receives a new URI", async () => {
    const read = vi.fn(async (uri: string) => result(uri));
    const { rerender } = renderWithMantine(show("synthetic:a", read));
    await expand("synthetic:a");
    await waitFor(() =>
      expect(screen.getByTestId("read-result")).toHaveTextContent(
        "body:synthetic:a",
      ),
    );
    rerender(show("synthetic:b", read));
    expect(screen.queryByTestId("read-result")).not.toBeInTheDocument();
    await expand("synthetic:b");
    await waitFor(() =>
      expect(screen.getByTestId("read-result")).toHaveTextContent(
        "body:synthetic:b",
      ),
    );
    expect(read.mock.calls).toEqual([["synthetic:a"], ["synthetic:b"]]);
  });
  it("does not let a pending read from an old URI populate or block the new URI", async () => {
    let resolveA!: (value: ReadResourceResult) => void;
    const pendingA = new Promise<ReadResourceResult>((resolve) => {
      resolveA = resolve;
    });
    const read = vi.fn((uri: string) =>
      uri === "synthetic:a" ? pendingA : Promise.resolve(result(uri)),
    );
    const { rerender } = renderWithMantine(show("synthetic:a", read));
    await expand("synthetic:a");
    rerender(show("synthetic:b", read));
    expect(
      screen.getByRole("button", { name: "Expand resource synthetic:b" }),
    ).toBeInTheDocument();
    await expand("synthetic:b");
    await waitFor(() =>
      expect(screen.getByTestId("read-result")).toHaveTextContent(
        "body:synthetic:b",
      ),
    );
    await act(async () => {
      resolveA(result("synthetic:a"));
      await pendingA;
    });
    expect(screen.getByTestId("read-result")).toHaveTextContent(
      "body:synthetic:b",
    );
    expect(screen.getByTestId("read-result")).not.toHaveTextContent(
      "body:synthetic:a",
    );
  });
  it("keeps caching through collapse and unrelated metadata rerenders for the same URI", async () => {
    const read = vi.fn(async (uri: string) => result(uri));
    const { rerender } = renderWithMantine(show("synthetic:a", read));
    await expand("synthetic:a");
    await waitFor(() =>
      expect(screen.getByTestId("read-result")).toHaveTextContent(
        "body:synthetic:a",
      ),
    );
    rerender(
      <ResourceLink uri="synthetic:a" name="new label" onReadResource={read} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse resource synthetic:a" }),
    );
    await expand("synthetic:a");
    expect(read).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("read-result")).toHaveTextContent(
      "body:synthetic:a",
    );
  });
  it("continues retrying a failed read when re-expanded", async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("synthetic failure"))
      .mockResolvedValueOnce(result("synthetic:a"));
    renderWithMantine(show("synthetic:a", read));
    await expand("synthetic:a");
    await waitFor(() =>
      expect(screen.getByText("synthetic failure")).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse resource synthetic:a" }),
    );
    await expand("synthetic:a");
    await waitFor(() =>
      expect(screen.getByTestId("read-result")).toHaveTextContent(
        "body:synthetic:a",
      ),
    );
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("stays non-expandable without a read callback", () => {
    renderWithMantine(<ResourceLink uri="synthetic:a" />);
    expect(
      screen.queryByRole("button", { name: /Expand resource/ }),
    ).not.toBeInTheDocument();
  });
});
