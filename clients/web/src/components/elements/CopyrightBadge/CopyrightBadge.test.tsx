/** Required notices remain available through the local About document. */
import { describe, it, expect } from "vitest";
import { renderWithMantine, screen } from "../../../test/renderWithMantine";
import { CopyrightBadge, COPYRIGHT_NOTICE } from "./CopyrightBadge";
describe("CopyrightBadge", () => {
  it("links to the local licenses and attribution document", () => {
    renderWithMantine(<CopyrightBadge />);
    expect(
      screen.getByRole("link", { name: "About & licenses" }),
    ).toHaveAttribute("href", "/about.html");
  });
  it("preserves the upstream attribution text", () => {
    expect(COPYRIGHT_NOTICE).toMatch(
      /Model Context Protocol.*Series of LF Projects, LLC\./,
    );
  });
});
