// Modified for ToolScope: workspace, schema workflow, or visual identity. See NOTICE.
import { Anchor, Text } from "@mantine/core";

/** The project's copyright notice. */
export const COPYRIGHT_NOTICE =
  "Copyright © Model Context Protocol a Series of LF Projects, LLC.";

// The copyrightBadge text variant styles the footer link.
const CopyrightText = Text.withProps({ variant: "copyrightBadge" });

/** Link to the local attribution and license notices. */
export function CopyrightBadge() {
  return (
    <CopyrightText>
      <Anchor href="/about.html" target="_blank" rel="noopener noreferrer">
        About &amp; licenses
      </Anchor>
    </CopyrightText>
  );
}
