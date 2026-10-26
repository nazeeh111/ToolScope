import { describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StdioServerConfig } from "@inspector/core/mcp/types.js";
import { renderWithMantine, screen } from "../../../test/renderWithMantine";
import { ServerConfigModal } from "./ServerConfigModal";

// Explicit edit intent must survive a return to the initial textarea value.
const MODES = ["edit", "clone"] as const;
function open(mode: "edit" | "clone", config: StdioServerConfig) {
  const props = {
    opened: true,
    mode,
    initialId: "synthetic",
    initialConfig: config,
    existingIds: [],
    onClose: vi.fn(),
    onSubmit: vi.fn(),
  };
  const view = renderWithMantine(<ServerConfigModal {...props} />);
  if (mode === "clone")
    fireEvent.change(screen.getByLabelText(/Server ID/i), {
      target: { value: "cloned" },
    });
  return { props, ...view };
}
async function submit(
  mode: "edit" | "clone",
  onSubmit: ReturnType<typeof vi.fn>,
) {
  await userEvent.setup({ delay: null }).click(
    screen.getByRole("button", {
      name: mode === "edit" ? "Save" : "Add",
      exact: true,
    }),
  );
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  return onSubmit.mock.calls[0];
}
function edit(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("ServerConfigModal explicit editing intent", () => {
  it.each(MODES)(
    "allows edit then clear of a single empty argument in %s mode",
    async (mode) => {
      const { props } = open(mode, {
        type: "stdio",
        command: "synthetic-command",
        args: [""],
      });
      expect(screen.getByLabelText(/Arguments/i)).toHaveValue("");
      edit(/Arguments/i, "temporary");
      edit(/Arguments/i, "");
      expect(await submit(mode, props.onSubmit)).toEqual([
        mode === "edit" ? "synthetic" : "cloned",
        { type: "stdio", command: "synthetic-command" },
      ]);
    },
  );
  it.each(MODES)(
    "honors the Clear button after editing a single empty argument in %s mode",
    async (mode) => {
      const { props } = open(mode, {
        type: "stdio",
        command: "synthetic-command",
        args: [""],
      });
      edit(/Arguments/i, "temporary");
      const field = screen.getByLabelText(/Arguments/i);
      const wrapper = field.closest('[class*="Input-wrapper"]');
      expect(wrapper).not.toBeNull();
      await userEvent
        .setup({ delay: null })
        .click(
          within(wrapper as HTMLElement).getByRole("button", { name: "Clear" }),
        );
      expect(field).toHaveValue("");
      expect(await submit(mode, props.onSubmit)).toEqual([
        mode === "edit" ? "synthetic" : "cloned",
        { type: "stdio", command: "synthetic-command" },
      ]);
    },
  );
  it.each(MODES)(
    "parses an explicitly edited ambiguous env field even when its text returns to the initial value in %s mode",
    async (mode) => {
      const { props } = open(mode, {
        type: "stdio",
        command: "synthetic-command",
        env: { NOTE: "first\nEXTRA=second" },
      });
      const text = "NOTE=first\nEXTRA=second";
      expect(screen.getByLabelText(/Environment/i)).toHaveValue(text);
      edit(/Environment/i, "TEMP=value");
      edit(/Environment/i, text);
      expect(await submit(mode, props.onSubmit)).toEqual([
        mode === "edit" ? "synthetic" : "cloned",
        {
          type: "stdio",
          command: "synthetic-command",
          env: { NOTE: "first", EXTRA: "second" },
        },
      ]);
    },
  );
  it("resets edit intent when the modal reopens", async () => {
    const { props, rerender } = open("edit", {
      command: "synthetic-command",
      args: [""],
    });
    edit(/Arguments/i, "temporary");
    edit(/Arguments/i, "");
    rerender(<ServerConfigModal {...props} opened={false} />);
    rerender(<ServerConfigModal {...props} />);
    edit(/Working directory/i, "/synthetic/changed");
    expect(await submit("edit", props.onSubmit)).toEqual([
      "synthetic",
      {
        type: "stdio",
        command: "synthetic-command",
        args: [""],
        cwd: "/synthetic/changed",
      },
    ]);
  });
  it("resets edit intent when a new initial config arrives while open", async () => {
    const { props, rerender } = open("edit", {
      type: "stdio",
      command: "synthetic-command",
      args: [""],
    });
    edit(/Arguments/i, "temporary");
    edit(/Environment/i, "TEMP=value");
    const initialConfig: StdioServerConfig = {
      type: "stdio",
      command: "other-command",
      args: [" padded "],
      env: { NOTE: "first\nEXTRA=second" },
    };
    rerender(<ServerConfigModal {...props} initialConfig={initialConfig} />);
    edit(/Working directory/i, "/synthetic/changed");
    expect(await submit("edit", props.onSubmit)).toEqual([
      "synthetic",
      { ...initialConfig, cwd: "/synthetic/changed" },
    ]);
  });
});
