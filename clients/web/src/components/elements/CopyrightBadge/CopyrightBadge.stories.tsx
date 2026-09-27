import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CopyrightBadge } from "./CopyrightBadge";

const meta: Meta<typeof CopyrightBadge> = {
  title: "Elements/CopyrightBadge",
  component: CopyrightBadge,
};

export default meta;
type Story = StoryObj<typeof CopyrightBadge>;

// The footer link opens the local attribution and license document.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "About & licenses" });
    await expect(link).toHaveAttribute("href", "/about.html");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  },
};
