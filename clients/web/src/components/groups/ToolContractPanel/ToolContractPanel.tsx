/** ToolScope's explicit schema check. Saved definitions never contain call inputs/results. */
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import type { Tool } from "@modelcontextprotocol/client";
import {
  captureContracts,
  compareContracts,
  parseContracts,
  type ContractChange,
} from "../../../utils/toolContracts";
import { downloadJsonFile } from "../../../lib/downloadFile";

const Panel = Card.withProps({
  withBorder: true,
  padding: "md",
  flex: "0 0 auto",
});
const Actions = Group.withProps({ gap: "xs", mt: "xs" });
const Action = Button.withProps({ size: "compact-xs", variant: "light" });
const Caption = Text.withProps({ size: "xs", c: "dimmed" });
const ChangeList = ScrollArea.Autosize.withProps({
  mah: 180,
  offsetScrollbars: true,
});
const ChangeRow = Group.withProps({ gap: "xs", wrap: "nowrap" });
const ChangeName = Text.withProps({ size: "xs", truncate: "end" });

export interface ToolContractPanelProps {
  serverIdentity: string;
  tools: Tool[];
  incomplete: boolean;
}

export function ToolContractPanel({
  serverIdentity,
  tools,
  incomplete,
}: ToolContractPanelProps) {
  const storageKey = `toolscope.contracts.${encodeURIComponent(serverIdentity)}`;
  const [baseline, setBaseline] = useState(() => {
    try {
      return parseContracts(localStorage.getItem(storageKey), serverIdentity);
    } catch {
      return null;
    }
  });
  const [changes, setChanges] = useState<ContractChange[] | null>(null);
  const [comparedTools, setComparedTools] = useState<Tool[] | null>(null);
  const [error, setError] = useState("");
  const stale = comparedTools !== tools;

  function capture() {
    try {
      const snapshot = captureContracts(serverIdentity, tools);
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
      setBaseline(snapshot);
      setChanges(null);
      setError("");
    } catch (reason) {
      setError(String(reason));
    }
  }
  function compare() {
    if (!baseline) return;
    try {
      setChanges(compareContracts(baseline, tools));
      setComparedTools(tools);
      setError("");
    } catch (reason) {
      setError(String(reason));
    }
  }
  function exportBaseline() {
    if (baseline)
      downloadJsonFile(
        "toolscope-schema-baseline.json",
        JSON.stringify(baseline, null, 2),
      );
  }
  function clear() {
    try {
      localStorage.removeItem(storageKey);
      setBaseline(null);
      setChanges(null);
      setError("");
    } catch (reason) {
      setError(String(reason));
    }
  }

  return (
    <Panel>
      <Text fw={600}>Schema check</Text>
      <Caption>
        Save tool definitions, then compare after refreshing or reconnecting.
        Stored in this browser.
      </Caption>
      {incomplete && (
        <Caption>
          Resolve malformed or excluded tool entries, refresh the list, and load
          all pages before checking.
        </Caption>
      )}
      <Actions>
        <Action onClick={capture} disabled={incomplete}>
          {baseline ? "Replace baseline" : "Save baseline"}
        </Action>
        <Action onClick={compare} disabled={!baseline || incomplete}>
          Compare tools
        </Action>
        <Action onClick={exportBaseline} disabled={!baseline}>
          Export baseline
        </Action>
        <Action onClick={clear} disabled={!baseline}>
          Clear baseline
        </Action>
      </Actions>
      {baseline && (
        <Caption>
          Saved {new Date(baseline.capturedAt).toLocaleString()} ·{" "}
          {Object.keys(baseline.definitions).length} tools
        </Caption>
      )}
      {error && (
        <Alert color="red" title="Schema check failed">
          {error}
        </Alert>
      )}
      {changes && !incomplete && !stale && (
        <Stack gap="xs" mt="xs">
          <Text size="sm" role="status">
            {changes.length === 0
              ? "Loaded definitions match the baseline."
              : `${changes.length} tool definition${changes.length === 1 ? "" : "s"} changed.`}
          </Text>
          <ChangeList>
            {changes.map((change) => (
              <ChangeRow key={change.name}>
                <Badge size="xs">{change.kind}</Badge>
                <ChangeName
                  title={`${change.name}: ${change.fields.join(", ")}`}
                >
                  {change.name}
                  {change.fields.length > 0
                    ? ` · ${change.fields.join(", ")}`
                    : ""}
                </ChangeName>
              </ChangeRow>
            ))}
          </ChangeList>
        </Stack>
      )}
      {changes && stale && (
        <Caption>Tool list changed. Compare again for current results.</Caption>
      )}
    </Panel>
  );
}
