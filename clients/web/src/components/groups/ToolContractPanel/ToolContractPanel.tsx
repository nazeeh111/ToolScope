/** ToolScope's explicit schema check. Saved definitions never contain call inputs/results. */
import { useRef, useState } from "react";
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
  readContractFile,
  type ContractSnapshot,
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
  const [pendingImport, setPendingImport] = useState<ContractSnapshot | null>(
    null,
  );
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const stale = comparedTools !== tools;

  function persistImport(snapshot: ContractSnapshot) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
      setBaseline(snapshot);
      setChanges(null);
      setPendingImport(null);
      setError("");
    } catch (reason) {
      setError(String(reason));
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setPendingImport(null);
    try {
      const snapshot = await readContractFile(file, serverIdentity);
      setError("");
      if (baseline) setPendingImport(snapshot);
      else persistImport(snapshot);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setReading(false);
    }
  }

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
        <Action
          onClick={capture}
          disabled={incomplete || reading || !!pendingImport}
        >
          {baseline ? "Replace baseline" : "Save baseline"}
        </Action>
        <Action
          onClick={compare}
          disabled={!baseline || incomplete || reading || !!pendingImport}
        >
          Compare tools
        </Action>
        <Action onClick={exportBaseline} disabled={!baseline}>
          Export baseline
        </Action>
        <Action
          onClick={() => fileInput.current?.click()}
          disabled={reading || !!pendingImport}
        >
          {reading ? "Reading baseline…" : "Import baseline"}
        </Action>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Baseline JSON file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void importFile(file);
          }}
        />
        <Action
          onClick={clear}
          disabled={!baseline || reading || !!pendingImport}
        >
          Clear baseline
        </Action>
      </Actions>
      {pendingImport && (
        <Alert title="Replace saved baseline?">
          <Text size="sm">
            Imported capture:{" "}
            {new Date(pendingImport.capturedAt).toLocaleString()} ·{" "}
            {Object.keys(pendingImport.definitions).length} tools. Your current
            baseline stays saved until you confirm.
          </Text>
          <Actions>
            <Action onClick={() => persistImport(pendingImport)}>
              Confirm replacement
            </Action>
            <Action
              onClick={() => {
                setPendingImport(null);
                setError("");
              }}
            >
              Cancel import
            </Action>
          </Actions>
        </Alert>
      )}
      {baseline && (
        <Caption>
          Captured {new Date(baseline.capturedAt).toLocaleString()} ·{" "}
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
