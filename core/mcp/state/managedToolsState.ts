// Modified for ToolScope: observable tool-list readiness. See NOTICE.
/**
 * ManagedToolsState: holds the full tool list, in sync with the server.
 * A thin subclass of ManagedListState — behavior lives in the base (#1444).
 */

import type { InspectorClientProtocol } from "../inspectorClientProtocol.js";
import type { RequestMetadata } from "../types.js";
import type { CacheMode } from "@modelcontextprotocol/client";
import type { Tool } from "@modelcontextprotocol/client";
import {
  ManagedListState,
  DEFAULT_LIST_CHANGED_DEBOUNCE_MS,
  type ManagedListEventMap,
} from "./managedListState.js";

export interface ManagedToolsStateEventMap extends ManagedListEventMap {
  toolsChange: Tool[];
  readyChange: boolean;
}

export class ManagedToolsState extends ManagedListState<
  Tool,
  ManagedToolsStateEventMap
> {
  private ready = false;
  private pendingLoads = 0;

  getReady(): boolean {
    return this.ready && this.client?.getStatus() === "connected";
  }

  override async refresh(
    metadata?: RequestMetadata,
    cacheMode?: CacheMode,
  ): Promise<Tool[]> {
    this.pendingLoads++;
    this.ready = false;
    this.dispatchTypedEvent("readyChange", false);
    try {
      return await super.refresh(metadata, cacheMode);
    } finally {
      this.pendingLoads--;
      this.ready =
        this.pendingLoads === 0 &&
        this.getError() === null &&
        this.client?.getStatus() === "connected";
      this.dispatchTypedEvent("readyChange", this.ready);
    }
  }

  constructor(
    client: InspectorClientProtocol,
    debounceMs = DEFAULT_LIST_CHANGED_DEBOUNCE_MS,
  ) {
    super(client, {
      listMethod: "tools/list",
      changeEvent: "toolsChange",
      listChangedEvent: "toolsListChanged",
      capabilityKey: "tools",
      deferWhenPaginated: true,
      supportsIndicator: true,
      debounceMs,
      fetchAll: async (c, cacheMode, metadata) => {
        const result = await c.listAllTools({ cacheMode, metadata });
        return result.tools;
      },
    });
  }

  getTools(): Tool[] {
    return this.getItems();
  }
}
