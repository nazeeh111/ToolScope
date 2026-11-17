/** Synthetic MCP stdio fixture: advertised contract changes, not instrument readings. */
import { createInterface } from "node:readline";
let revision = 1;
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const schema = () => ({
  name: "read_voltage",
  description: "Synthetic voltage-contract example; no sensor or hardware.",
  inputSchema: {
    type: "object",
    properties: {
      unit: { type: "string", enum: revision === 1 ? ["V", "mV"] : ["V"] },
    },
    required: ["unit"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      value: { type: "number" },
      unit: { type: "string", enum: ["V", "mV"] },
      status: {
        type: "string",
        enum: revision === 1 ? ["ready"] : ["ready", "warming"],
      },
    },
    required: ["value", "unit", "status"],
    additionalProperties: false,
  },
});
for await (const line of createInterface({ input: process.stdin })) {
  try {
    const m = JSON.parse(line);
    if (m.id === undefined) continue;
    let result;
    switch (m.method) {
      case "initialize":
        result = {
          protocolVersion: m.params.protocolVersion,
          capabilities: {
            tools: { listChanged: true },
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: "ToolScope synthetic voltage fixture",
            version: "1.0.0",
          },
          instructions:
            "Only synthetic public examples. No hardware, credentials, model or provider.",
        };
        break;
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = {
          tools: [
            schema(),
            {
              name: "advance_contract",
              description:
                "Switch the task-owned synthetic definition from revision1 to revision2.",
              inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
              },
            },
          ],
        };
        break;
      case "tools/call":
        if (m.params.name === "advance_contract") {
          revision = 2;
          result = {
            content: [
              { type: "text", text: "Synthetic contract is now revision 2." },
            ],
          };
        } else if (m.params.name === "read_voltage") {
          const u = m.params.arguments?.unit;
          if (!["V", "mV"].includes(u) || (revision === 2 && u === "mV")) {
            result = {
              isError: true,
              content: [
                {
                  type: "text",
                  text: "Unit refused by the current synthetic input contract.",
                },
              ],
            };
          } else {
            const value = {
              value: u === "V" ? 3.3 : 3300,
              unit: u,
              status: revision === 1 ? "ready" : "warming",
            };
            result = {
              content: [{ type: "text", text: JSON.stringify(value) }],
              structuredContent: value,
            };
          }
        } else throw Error("Unknown tool");
        break;
      case "resources/list":
        result = {
          resources: [
            {
              uri: "fixture://scope",
              name: "Synthetic scope",
              mimeType: "text/plain",
              description: "Public fixture provenance and limits",
            },
          ],
        };
        break;
      case "resources/templates/list":
        result = { resourceTemplates: [] };
        break;
      case "resources/read":
        if (m.params.uri !== "fixture://scope")
          throw Error("Unknown fixture resource");
        result = {
          contents: [
            {
              uri: "fixture://scope",
              mimeType: "text/plain",
              text: "Public synthetic voltage-contract fixture. Values are fixed examples, not measured data. ToolScope inspects schema changes; finite probes do not prove semantic compatibility or security.",
            },
          ],
        };
        break;
      case "prompts/list":
        result = {
          prompts: [
            {
              name: "review_contract",
              description: "Prepare a review prompt without calling a model",
              arguments: [],
            },
          ],
        };
        break;
      case "prompts/get":
        if (m.params.name !== "review_contract")
          throw Error("Unknown fixture prompt");
        result = {
          description: "Synthetic contract-review prompt; no model is invoked",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Inspect whether old millivolt calls and old ready-only consumers accept the new advertised voltage contract.",
              },
            },
          ],
        };
        break;
      default:
        send({
          jsonrpc: "2.0",
          id: m.id,
          error: {
            code: -32601,
            message: "Method unsupported by this bounded fixture",
          },
        });
        continue;
    }
    send({ jsonrpc: "2.0", id: m.id, result });
    if (m.method === "tools/call" && m.params.name === "advance_contract")
      send({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
  } catch (e) {
    send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid synthetic fixture request" },
    });
  }
}
