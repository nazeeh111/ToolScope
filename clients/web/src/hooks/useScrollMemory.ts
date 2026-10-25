import { useCallback, useRef } from "react";

// Scroll positions survive a screen unmount by living in this module-scope map
// rather than React state: the screens unmount on tab switch (#1417), so a
// component-local ref would be lost, and threading every scroll position up to
// App would balloon the prop surface for what is purely ephemeral DOM state.
// Keyed by a caller-supplied stable region id (e.g. "logs-stream").
const scrollPositions = new Map<string, { x: number; y: number }>();

/**
 * Forget all remembered scroll positions. App calls this on disconnect so a new
 * session's screens start at the top, matching the clear-on-disconnect rule the
 * lifted selection/filter state follows (#1417).
 */
export function clearScrollMemory(): void {
  scrollPositions.clear();
}

/**
 * Remember and restore a scroll container's position across detach/reattach.
 * Returns a stable ref to attach to a Mantine scroll area's `viewportRef`.
 * Following the node rather than the owner's mount also covers an initially
 * empty stream and filtering that temporarily removes its viewport.
 */
export function useScrollMemory(key: string) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  return useCallback(
    (viewport: HTMLDivElement | null) => {
      const previous = viewportRef.current;
      if (previous === viewport) return;
      if (previous) {
        scrollPositions.set(key, {
          x: previous.scrollLeft,
          y: previous.scrollTop,
        });
      }
      viewportRef.current = viewport;
      if (viewport) {
        const saved = scrollPositions.get(key);
        if (saved) viewport.scrollTo({ left: saved.x, top: saved.y });
      }
    },
    [key],
  );
}
