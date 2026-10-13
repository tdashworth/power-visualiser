import type { FuseResult, FuseResultMatch, IFuseOptions } from "fuse.js";
import type { Process, ProcessAction, ProcessEdge } from "@/data/flows";
import type React from "react";

export interface FlowDataSnapshot {
  flows: Process[];
  edges: ProcessEdge[];
  actions: ProcessAction[];
}

export interface SearchResult<TPayload = unknown> {
  id: string;
  categoryId: string;
  title: string;
  subtitle?: string;
  matches: readonly FuseResultMatch[];
  score?: number;
  payload: TPayload;
  /** Flow id to highlight on the map when this result is activated. */
  targetFlowId: string;
}

export interface SearchCategory<TItem = unknown, TPayload = TItem> {
  id: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
  getItems: (data: FlowDataSnapshot) => TItem[];
  fuseKeys: IFuseOptions<TItem>["keys"];
  toResult: (item: TItem, fuseResult: FuseResult<TItem>) => SearchResult<TPayload>;
  renderRow: (result: SearchResult<TPayload>) => React.ReactNode;
  /**
   * Optional alternative search path used when the query is detected as an
   * OData filter expression (e.g. `statecode eq 0 and name eq 'foo'`).
   * When provided and invoked, this bypasses Fuse and returns results directly.
   */
  odataSearch?: (data: FlowDataSnapshot, filter: string) => SearchResult<TPayload>[];
}

/**
 * Heuristic detection: returns true if the query looks like an OData filter
 * expression. Detects comparison operators (eq/ne/gt/lt/ge/le) as standalone
 * tokens or function-style predicates (contains/startswith/endswith).
 */
export function looksLikeODataFilter(query: string): boolean {
  if (!query || query.length < 5) return false;
  return (
    /\b[a-zA-Z_][\w]*\s+(eq|ne|gt|lt|ge|le)\s+\S/i.test(query) ||
    /\b(contains|startswith|endswith)\s*\(/i.test(query)
  );
}
