import { describe, it, expect, beforeEach } from "vitest";
import { StrictMode } from "react";
import { renderWithMantine, act } from "../test/renderWithMantine";
import { useScrollMemory, clearScrollMemory } from "./useScrollMemory";

// happy-dom doesn't lay out scrollable content, so we drive scrollTop/scrollLeft
// directly on the viewport node and assert the hook saves on unmount and
// restores on the next mount. A fixed-height div with the ref is enough.
function ScrollProbe({
  scrollKey,
  visible = true,
}: {
  scrollKey: string;
  visible?: boolean;
}) {
  const ref = useScrollMemory(scrollKey);
  return visible ? <div data-testid="viewport" ref={ref} /> : null;
}

describe("useScrollMemory", () => {
  beforeEach(() => {
    clearScrollMemory();
  });

  it("restores the saved scroll offset on remount under the same key", () => {
    const { getByTestId, unmount } = renderWithMantine(
      <ScrollProbe scrollKey="logs" />,
    );
    const viewport = getByTestId("viewport") as HTMLDivElement;
    // Simulate the user scrolling.
    viewport.scrollTop = 240;
    viewport.scrollLeft = 15;
    // Unmount (tab switch) captures the offset; remount restores it.
    unmount();

    const second = renderWithMantine(<ScrollProbe scrollKey="logs" />);
    const restored = second.getByTestId("viewport") as HTMLDivElement;
    expect(restored.scrollTop).toBe(240);
    expect(restored.scrollLeft).toBe(15);
  });

  it("does not cross-restore between different keys", () => {
    const first = renderWithMantine(<ScrollProbe scrollKey="logs" />);
    (first.getByTestId("viewport") as HTMLDivElement).scrollTop = 100;
    first.unmount();

    const other = renderWithMantine(<ScrollProbe scrollKey="history" />);
    expect((other.getByTestId("viewport") as HTMLDivElement).scrollTop).toBe(0);
  });

  it("forgets saved positions after clearScrollMemory()", () => {
    const first = renderWithMantine(<ScrollProbe scrollKey="logs" />);
    (first.getByTestId("viewport") as HTMLDivElement).scrollTop = 180;
    first.unmount();

    act(() => clearScrollMemory());

    const second = renderWithMantine(<ScrollProbe scrollKey="logs" />);
    expect((second.getByTestId("viewport") as HTMLDivElement).scrollTop).toBe(
      0,
    );
  });
  it("remembers a viewport that attaches after an initially empty render", () => {
    const first = renderWithMantine(
      <ScrollProbe scrollKey="logs" visible={false} />,
    );
    first.rerender(<ScrollProbe scrollKey="logs" />);
    const viewport = first.getByTestId("viewport") as HTMLDivElement;
    viewport.scrollTop = 240;
    viewport.scrollLeft = 15;
    first.unmount();
    const second = renderWithMantine(<ScrollProbe scrollKey="logs" />);
    expect((second.getByTestId("viewport") as HTMLDivElement).scrollTop).toBe(
      240,
    );
    expect((second.getByTestId("viewport") as HTMLDivElement).scrollLeft).toBe(
      15,
    );
  });

  it("restores a viewport removed and recreated by filtering", () => {
    const h = renderWithMantine(<ScrollProbe scrollKey="logs" />);
    (h.getByTestId("viewport") as HTMLDivElement).scrollTop = 180;
    h.rerender(<ScrollProbe scrollKey="logs" visible={false} />);
    h.rerender(<ScrollProbe scrollKey="logs" />);
    expect((h.getByTestId("viewport") as HTMLDivElement).scrollTop).toBe(180);
  });

  it("keeps the current position through ordinary rerenders", () => {
    const h = renderWithMantine(<ScrollProbe scrollKey="logs" />);
    (h.getByTestId("viewport") as HTMLDivElement).scrollTop = 180;
    h.rerender(<ScrollProbe scrollKey="logs" />);
    expect((h.getByTestId("viewport") as HTMLDivElement).scrollTop).toBe(180);
  });

  it("saves and restores independent positions when the key changes on one node", () => {
    const h = renderWithMantine(<ScrollProbe scrollKey="logs" />);
    (h.getByTestId("viewport") as HTMLDivElement).scrollTop = 180;
    h.rerender(<ScrollProbe scrollKey="other" />);
    (h.getByTestId("viewport") as HTMLDivElement).scrollTop = 90;
    h.rerender(<ScrollProbe scrollKey="logs" />);
    expect((h.getByTestId("viewport") as HTMLDivElement).scrollTop).toBe(180);
    h.rerender(<ScrollProbe scrollKey="other" />);
    expect((h.getByTestId("viewport") as HTMLDivElement).scrollTop).toBe(90);
  });

  it("keeps positions through StrictMode ref and effect checks", () => {
    const first = renderWithMantine(
      <StrictMode>
        <ScrollProbe scrollKey="logs" />
      </StrictMode>,
    );
    (first.getByTestId("viewport") as HTMLDivElement).scrollTop = 120;
    first.unmount();
    const second = renderWithMantine(
      <StrictMode>
        <ScrollProbe scrollKey="logs" />
      </StrictMode>,
    );
    expect((second.getByTestId("viewport") as HTMLDivElement).scrollTop).toBe(
      120,
    );
  });
});
