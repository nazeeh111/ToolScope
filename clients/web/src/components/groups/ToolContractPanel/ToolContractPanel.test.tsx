/** User workflow: persist, reconnect, compare and export schemas without calls. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithMantine, screen } from "../../../test/renderWithMantine";
import { ToolContractPanel } from "./ToolContractPanel";
import { downloadJsonFile } from "../../../lib/downloadFile";
vi.mock("../../../lib/downloadFile", () => ({ downloadJsonFile: vi.fn() }));
const tools = [{ name: "lookup", inputSchema: { type: "object" as const } }];
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
describe("ToolContractPanel", () => {
  it("saves a baseline, restores on reconnect and compares current definitions", async () => {
    const user = userEvent.setup();
    const initial = renderWithMantine(
      <ToolContractPanel
        serverIdentity="local"
        tools={tools}
        incomplete={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Compare tools" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save baseline" }));
    initial.unmount();
    const next = [
      ...tools,
      { name: "new_tool", inputSchema: { type: "object" as const } },
    ];
    const view = renderWithMantine(
      <ToolContractPanel
        serverIdentity="local"
        tools={next}
        incomplete={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Compare tools" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 tool definition changed.",
    );
    expect(screen.getByText("new_tool")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export baseline" }));
    expect(downloadJsonFile).toHaveBeenCalledWith(
      "toolscope-schema-baseline.json",
      expect.stringContaining('"lookup"'),
    );
    view.rerender(
      <ToolContractPanel
        serverIdentity="local"
        tools={[
          ...next,
          { name: "another_tool", inputSchema: { type: "object" } },
        ]}
        incomplete={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Compare tools" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 tool definitions changed.",
    );
    view.rerender(
      <ToolContractPanel
        serverIdentity="local"
        tools={[{ ...tools[0], description: "Changed description" }]}
        incomplete={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Compare tools" }));
    expect(screen.getByText("lookup · description")).toBeInTheDocument();
    view.rerender(
      <ToolContractPanel
        serverIdentity="local"
        tools={tools}
        incomplete={false}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Compare tools" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loaded definitions match",
    );
    await user.click(screen.getByRole("button", { name: "Clear baseline" }));
    expect(
      screen.getByRole("button", { name: "Compare tools" }),
    ).toBeDisabled();
  });
  it("blocks incomplete lists and reports duplicate definitions", async () => {
    const user = userEvent.setup();
    const view = renderWithMantine(
      <ToolContractPanel serverIdentity="local" tools={tools} incomplete />,
    );
    expect(
      screen.getByRole("button", { name: "Save baseline" }),
    ).toBeDisabled();
    view.rerender(
      <ToolContractPanel
        serverIdentity="local"
        tools={[...tools, ...tools]}
        incomplete={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save baseline" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Duplicate tool name");
  });
  it("reports storage failure without claiming a successful save", async () => {
    const user = userEvent.setup();
    const spy = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("Storage is full");
      });
    try {
      renderWithMantine(
        <ToolContractPanel
          serverIdentity="local"
          tools={tools}
          incomplete={false}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Save baseline" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Storage is full");
      expect(
        screen.getByRole("button", { name: "Compare tools" }),
      ).toBeDisabled();
    } finally {
      spy.mockRestore();
    }
  });
  it("recovers when saved browser storage cannot be read", () => {
    const spy = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
    try {
      renderWithMantine(
        <ToolContractPanel
          serverIdentity="local"
          tools={tools}
          incomplete={false}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Save baseline" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Compare tools" }),
      ).toBeDisabled();
    } finally {
      spy.mockRestore();
    }
  });
  it("reports a comparison error for duplicate current definitions", async () => {
    const user = userEvent.setup();
    const view = renderWithMantine(
      <ToolContractPanel
        serverIdentity="local"
        tools={tools}
        incomplete={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save baseline" }));
    view.rerender(
      <ToolContractPanel
        serverIdentity="local"
        tools={[...tools, ...tools]}
        incomplete={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Compare tools" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Duplicate tool name");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("keeps a baseline available when clearing browser storage fails", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <ToolContractPanel
        serverIdentity="local"
        tools={tools}
        incomplete={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save baseline" }));
    const spy = vi
      .spyOn(window.localStorage, "removeItem")
      .mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
    try {
      await user.click(screen.getByRole("button", { name: "Clear baseline" }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Storage unavailable",
      );
      expect(
        screen.getByRole("button", { name: "Export baseline" }),
      ).toBeEnabled();
    } finally {
      spy.mockRestore();
    }
  });
});
