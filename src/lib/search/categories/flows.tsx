import { Flow20Regular } from "@fluentui/react-icons";
import { Tag, Text, tokens } from "@fluentui/react-components";
import type { Process } from "@/data/flows";
import { processTypeMeta, triggerMeta } from "@/data/flows";
import type { SearchCategory, SearchResult } from "../types";
import { findMatch, renderHighlighted } from "../highlight";

type FlowItem = Process & {
  _updateColumnsText: string;
  _triggerTypesText: string;
  _entityColumnsText: string;
};

export const flowsCategory: SearchCategory<FlowItem, Process> = {
  id: "flows",
  label: "Flows & Workflows",
  icon: <Flow20Regular />,
  color: "#0078D4",
  getItems: (data) =>
    data.flows.map((f) => ({
      ...f,
      _updateColumnsText: (f.updateColumns ?? []).join(", "),
      _triggerTypesText: f.triggerTypes.join(", "),
      _entityColumnsText: f.triggerTable
        ? (f.updateColumns ?? []).map((c) => `${f.triggerTable}.${c}`).join(" ")
        : "",
    })),
  fuseKeys: [
    { name: "name", weight: 3 },
    { name: "id", weight: 1 },
    { name: "triggerTable", weight: 2 },
    { name: "_updateColumnsText", weight: 1.5 },
    { name: "_entityColumnsText", weight: 2.5 },
    { name: "_triggerTypesText", weight: 0.5 },
    { name: "processType", weight: 0.3 },
    { name: "dataFilter", weight: 2 },
  ],
  toResult: (item, fuse) => ({
    id: item.id,
    categoryId: "flows",
    title: item.name,
    subtitle: processTypeMeta[item.processType].label,
    matches: fuse.matches ?? [],
    score: fuse.score,
    payload: item,
    targetFlowId: item.id,
  }),
  renderRow: (result: SearchResult<Process>) => {
    const flow = result.payload;
    const nameMatch = findMatch(result.matches, "name");
    const tableMatch = findMatch(result.matches, "triggerTable");
    const colsMatch = findMatch(result.matches, "_updateColumnsText");
    const filterMatch = findMatch(result.matches, "dataFilter");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Text weight="semibold" truncate wrap={false} style={{ fontSize: 13 }}>
            {renderHighlighted(flow.name, nameMatch?.indices)}
          </Text>
          {flow.isActive === false && (
            <Tag appearance="outline" size="small">
              Inactive
            </Tag>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            fontSize: 11,
            color: tokens.colorNeutralForeground3,
          }}
        >
          <span>{processTypeMeta[flow.processType].label}</span>
          {flow.triggerTypes.length > 0 && (
            <>
              <span>·</span>
              <span>{flow.triggerTypes.map((t) => triggerMeta[t]?.label ?? t).join(", ")}</span>
            </>
          )}
          {flow.triggerTable && (
            <>
              <span>·</span>
              <span>{renderHighlighted(flow.triggerTable, tableMatch?.indices)}</span>
            </>
          )}
          {flow.updateColumns && flow.updateColumns.length > 0 && (
            <Tag appearance="brand" size="small">
              {renderHighlighted(
                flow.updateColumns.join(", "),
                colsMatch?.indices,
              )}
            </Tag>
          )}
        </div>
        {(flow.dataFilter || filterMatch) && (
          <div
            style={{
              fontSize: 11,
              color: tokens.colorNeutralForeground3,
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={flow.dataFilter}
          >
            {renderHighlighted(flow.dataFilter ?? "", filterMatch?.indices)}
          </div>
        )}
      </div>
    );
  },
  odataSearch: (data, filter) => {
    const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    const needle = norm(filter);
    // Tokenise into "<col> <op> <val>" predicates so partial filters still match.
    const predicateRegex = /[a-zA-Z_][\w]*\s+(?:eq|ne|gt|lt|ge|le)\s+(?:'[^']*'|"[^"]*"|[^\s)]+)|(?:contains|startswith|endswith)\s*\([^)]*\)/gi;
    const tokens = (filter.match(predicateRegex) ?? []).map(norm);
    const results: SearchResult<Process>[] = [];
    for (const f of data.flows) {
      if (!f.dataFilter) continue;
      const hay = norm(f.dataFilter);
      let score: number | undefined;
      if (hay.includes(needle)) {
        score = 0;
      } else if (tokens.length > 0 && tokens.every((t) => hay.includes(t))) {
        score = 0.3;
      } else if (tokens.length > 0 && tokens.some((t) => hay.includes(t))) {
        score = 0.6;
      } else {
        continue;
      }
      results.push({
        id: `${f.id}::odata`,
        categoryId: "flows",
        title: f.name,
        subtitle: processTypeMeta[f.processType].label,
        matches: [],
        score,
        payload: f,
        targetFlowId: f.id,
      });
    }
    results.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    return results;
  },
};
