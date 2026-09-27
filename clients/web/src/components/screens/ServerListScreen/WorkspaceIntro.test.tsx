/** Workspace actions delegate to the established connection/import dialogs. */
import { expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithMantine, screen } from "../../../test/renderWithMantine";
import { WorkspaceIntro } from "./WorkspaceIntro";
it("opens the connection and catalog workflows", async () => {
  const onAdd = vi.fn();
  const onImport = vi.fn();
  renderWithMantine(<WorkspaceIntro onAdd={onAdd} onImport={onImport} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add connection" }));
  await user.click(screen.getByRole("button", { name: "Import catalog" }));
  expect(onAdd).toHaveBeenCalledOnce();
  expect(onImport).toHaveBeenCalledOnce();
  expect(screen.getByText("Tool schema baselines")).toBeInTheDocument();
});
