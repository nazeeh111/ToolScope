/** ToolScope's connection workspace explains the existing inspection workflow. */
import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
const Intro = Stack.withProps({ gap: "md", mb: "lg" });
const Top = Group.withProps({ justify: "space-between", align: "flex-start" });
const Heading = Title.withProps({ order: 3, size: "h2", fw: 600 });
const Detail = Text.withProps({ size: "sm", c: "dimmed" });
const Step = Paper.withProps({ withBorder: true, p: "md", radius: "sm" });
const Steps = SimpleGrid.withProps({ cols: { base: 1, sm: 3 }, spacing: "sm" });
const StepLabel = Text.withProps({
  size: "xs",
  fw: 700,
  c: "var(--inspector-brand-primary)",
});
const Actions = Group.withProps({ gap: "xs", wrap: "nowrap" });
const Secondary = Button.withProps({ variant: "default", size: "sm" });
export function WorkspaceIntro({
  onAdd,
  onImport,
}: {
  onAdd: () => void;
  onImport: () => void;
}) {
  return (
    <Intro>
      <Top>
        <Stack gap="xs">
          <Badge variant="light">MCP development</Badge>
          <Heading>Inspect tools and server behavior</Heading>
          <Detail>
            Connect a server, send requests, and check its tool definitions.
          </Detail>
        </Stack>
        <Actions>
          <Button onClick={onAdd}>Add connection</Button>
          <Secondary onClick={onImport}>Import catalog</Secondary>
        </Actions>
      </Top>
      <Steps>
        <Step>
          <StepLabel>01 · CONNECT</StepLabel>
          <Text fw={600}>Local or remote servers</Text>
          <Detail>
            Use the bundled stdio examples, or add an HTTP endpoint or local
            command.
          </Detail>
        </Step>
        <Step>
          <StepLabel>02 · EXERCISE</StepLabel>
          <Text fw={600}>Requests and responses</Text>
          <Detail>
            Call tools, read resources, preview prompts, and inspect protocol
            messages.
          </Detail>
        </Step>
        <Step>
          <StepLabel>03 · COMPARE</StepLabel>
          <Text fw={600}>Tool schema baselines</Text>
          <Detail>
            Save definitions in Tools. Reconnect or refresh, then compare
            changes.
          </Detail>
        </Step>
      </Steps>
    </Intro>
  );
}
