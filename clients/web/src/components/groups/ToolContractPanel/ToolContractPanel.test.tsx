/** User workflow: persist, reconnect, compare and export schemas without calls. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { captureContracts } from "../../../utils/toolContracts";
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

describe("baseline file workflow", () => {
  const key = "toolscope.contracts.local";
  function file(server = "local") {
    return new File(
      [
        JSON.stringify(
          captureContracts(server, tools, "2026-09-23T00:00:00.000Z"),
          null,
          2,
        ),
      ],
      "baseline.json",
      { type: "application/json" },
    );
  }
  function panel() {
    return renderWithMantine(
      <ToolContractPanel
        serverIdentity="local"
        tools={tools}
        incomplete={false}
      />,
    );
  }
  it("exports, imports into empty storage, reloads and compares without connecting", async () => {
    const user = userEvent.setup();
    const first = panel();
    await user.click(screen.getByRole("button", { name: "Save baseline" }));
    await user.click(screen.getByRole("button", { name: "Export baseline" }));
    const exported = vi.mocked(downloadJsonFile).mock.calls[0][1];
    await user.click(screen.getByRole("button", { name: "Clear baseline" }));
    await user.upload(
      screen.getByLabelText("Baseline JSON file"),
      new File([exported], "export.json", { type: "application/json" }),
    );
    expect(
      await screen.findByRole("button", { name: "Replace baseline" }),
    ).toBeEnabled();
    first.unmount();
    panel();
    await user.click(screen.getByRole("button", { name: "Compare tools" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loaded definitions match",
    );
  });
  it("requires replacement confirmation, preserves capture time, and supports cancellation", async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole("button", { name: "Save baseline" }));
    const previous = localStorage.getItem(key);
    await user.upload(screen.getByLabelText("Baseline JSON file"), file());
    expect(
      await screen.findByText("Replace saved baseline?"),
    ).toBeInTheDocument();
    expect(localStorage.getItem(key)).toBe(previous);
    await user.click(screen.getByRole("button", { name: "Cancel import" }));
    expect(localStorage.getItem(key)).toBe(previous);
    fireEvent.change(screen.getByLabelText("Baseline JSON file"), {
      target: { files: [] },
    });
    expect(localStorage.getItem(key)).toBe(previous);
    await user.upload(screen.getByLabelText("Baseline JSON file"), file());
    await user.click(
      await screen.findByRole("button", { name: "Confirm replacement" }),
    );
    expect(JSON.parse(localStorage.getItem(key)!).capturedAt).toBe(
      "2026-09-23T00:00:00.000Z",
    );
  });
  it("preserves saved data on invalid files and storage failure", async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole("button", { name: "Save baseline" }));
    const previous = localStorage.getItem(key);
    await user.upload(
      screen.getByLabelText("Baseline JSON file"),
      file("other"),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "different server",
    );
    expect(localStorage.getItem(key)).toBe(previous);
    await user.upload(
      screen.getByLabelText("Baseline JSON file"),
      new File(["{"], "invalid.json", { type: "application/json" }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(localStorage.getItem(key)).toBe(previous);
    await user.upload(screen.getByLabelText("Baseline JSON file"), file());
    const confirm = await screen.findByRole("button", {
      name: "Confirm replacement",
    });
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("Storage full");
    });
    try {
      await user.click(confirm);
      expect(screen.getByText("Error: Storage full")).toBeInTheDocument();
      expect(localStorage.getItem(key)).toBe(previous);
      expect(
        screen.getByRole("button", { name: "Export baseline" }),
      ).toBeEnabled();
    } finally {
      spy.mockRestore();
    }
    await user.click(screen.getByRole("button", { name: "Cancel import" }));
    await user.click(screen.getByRole("button", { name: "Compare tools" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loaded definitions match",
    );
  });
  it("allows import with incomplete live data but keeps comparing disabled", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <ToolContractPanel serverIdentity="local" tools={[]} incomplete />,
    );
    await user.upload(screen.getByLabelText("Baseline JSON file"), file());
    await screen.findByRole("button", { name: "Replace baseline" });
    expect(
      screen.getByRole("button", { name: "Compare tools" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Replace baseline" }),
    ).toBeDisabled();
  });
});
