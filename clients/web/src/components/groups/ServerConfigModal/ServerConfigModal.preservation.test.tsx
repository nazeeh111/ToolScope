import { describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StdioServerConfig } from "@inspector/core/mcp/types.js";
import { renderWithMantine, screen } from "../../../test/renderWithMantine";
import { ServerConfigModal } from "./ServerConfigModal";

// Synthetic props only: onSubmit records the payload and never launches or saves.
function open(config: StdioServerConfig, mode: "edit" | "clone" = "edit") {
  const onSubmit = vi.fn();
  renderWithMantine(
    <ServerConfigModal
      opened
      mode={mode}
      initialId="synthetic"
      initialConfig={config}
      existingIds={[]}
      onSubmit={onSubmit}
      onClose={vi.fn()}
    />,
  );
  return onSubmit;
}
async function save(onSubmit: ReturnType<typeof vi.fn>, label = "Save") {
  await userEvent
    .setup({ delay: null })
    .click(screen.getByRole("button", { name: label, exact: true }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  return onSubmit.mock.calls[0];
}

describe("ServerConfigModal configuration preservation", () => {
  it.each([
    [""],
    ["", "  padded \t", "\t", "last", ""],
    ["embedded\nnewline", "carriage\rreturn"],
  ])(
    "preserves unchanged args %# when only the working directory changes",
    async (...args: string[]) => {
      const onSubmit = open({
        type: "stdio",
        command: "synthetic-command",
        args,
      });
      fireEvent.change(screen.getByLabelText(/Working directory/i), {
        target: { value: "/synthetic/changed" },
      });
      expect(await save(onSubmit)).toEqual([
        "synthetic",
        {
          type: "stdio",
          command: "synthetic-command",
          args,
          cwd: "/synthetic/changed",
        },
      ]);
    },
  );

  it("preserves unchanged environment values when only the id changes", async () => {
    const env = {
      EMPTY: "",
      PADDED: " leading and trailing \t",
      TABS: "\t\t",
      EQUALS: "a=b=",
    };
    const onSubmit = open({ type: "stdio", command: "synthetic-command", env });
    fireEvent.change(screen.getByLabelText(/Server ID/i), {
      target: { value: "renamed" },
    });
    expect(await save(onSubmit)).toEqual([
      "renamed",
      { type: "stdio", command: "synthetic-command", env },
    ]);
  });

  it("preserves an unchanged multiline environment value without reparsing it as extra entries", async () => {
    const env = { NOTE: "first\nsecond\rthird" };
    const onSubmit = open({ type: "stdio", command: "synthetic-command", env });
    fireEvent.change(screen.getByLabelText(/Working directory/i), {
      target: { value: "/synthetic/changed" },
    });
    expect(await save(onSubmit)).toEqual([
      "synthetic",
      {
        type: "stdio",
        command: "synthetic-command",
        env,
        cwd: "/synthetic/changed",
      },
    ]);
  });

  it("preserves unchanged args and env in clone mode", async () => {
    const args = ["", " padded ", ""];
    const env = { VALUE: "ends in space " };
    const onSubmit = open(
      { type: "stdio", command: "synthetic-command", args, env },
      "clone",
    );
    fireEvent.change(screen.getByLabelText(/Server ID/i), {
      target: { value: "cloned" },
    });
    expect(await save(onSubmit, "Add")).toEqual([
      "cloned",
      { type: "stdio", command: "synthetic-command", args, env },
    ]);
  });

  it("preserves leading and trailing value whitespace after an explicit environment edit", async () => {
    const onSubmit = open({
      type: "stdio",
      command: "synthetic-command",
      env: { OLD: "value" },
    });
    fireEvent.change(screen.getByLabelText(/Environment/i), {
      target: { value: "  \n  KEY = leading \t\nEMPTY=\nTABS=\t\t\nEQ=a=b=\n" },
    });
    expect(await save(onSubmit)).toEqual([
      "synthetic",
      {
        type: "stdio",
        command: "synthetic-command",
        env: { KEY: " leading \t", EMPTY: "", TABS: "\t\t", EQ: "a=b=" },
      },
    ]);
  });

  it("retains the existing one-argument-per-line edit behavior", async () => {
    const onSubmit = open({
      type: "stdio",
      command: "synthetic-command",
      args: ["old"],
    });
    fireEvent.change(screen.getByLabelText(/Arguments/i), {
      target: { value: "  next  \n\n --flag\t\n" },
    });
    expect(await save(onSubmit)).toEqual([
      "synthetic",
      { type: "stdio", command: "synthetic-command", args: ["next", "--flag"] },
    ]);
  });

  it("allows explicitly clearing populated args and env", async () => {
    const onSubmit = open({
      type: "stdio",
      command: "synthetic-command",
      args: ["old"],
      env: { OLD: "value " },
    });
    fireEvent.change(screen.getByLabelText(/Arguments/i), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(/Environment/i), {
      target: { value: "" },
    });
    expect(await save(onSubmit)).toEqual([
      "synthetic",
      { type: "stdio", command: "synthetic-command" },
    ]);
  });

  it("still rejects a whitespace-only environment key", async () => {
    const onSubmit = open({ type: "stdio", command: "synthetic-command" });
    fireEvent.change(screen.getByLabelText(/Environment/i), {
      target: { value: "   =value" },
    });
    await userEvent
      .setup({ delay: null })
      .click(screen.getByRole("button", { name: "Save", exact: true }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Invalid env/);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
