import React from "react";
import { Edit20Regular, AddCircle20Regular, Delete20Regular, DatabaseArrowUp20Regular } from "@fluentui/react-icons";
import { Tag, Text, tokens } from "@fluentui/react-components";
import type { ProcessAction } from "@/data/flows";
import type { SearchCategory, SearchResult } from "../types";
import { findMatch, renderHighlighted } from "../highlight";
import { canDataSatisfyFilter } from "@/lib/filterValidator";

type ActionItem = ProcessAction & {
  _flowName: string;
  _propertiesText: string;
  _propertyValuesText: string;
  _entityColumnsText: string;
  _entityValuesText: string;
  _key: string;
};

const operationIcon: Record<string, React.ReactElement> = {
  CreateRecord: <AddCircle20Regular />,
  UpdateRecord: <DatabaseArrowUp20Regular />,
  UpdateOnlyRecord: <DatabaseArrowUp20Regular />,
  DeleteRecord: <Delete20Regular />,
};

const operationColor: Record<string, string> = {
  CreateRecord: "#107C10",
  UpdateRecord: "#CA5010",
  UpdateOnlyRecord: "#CA5010",
  DeleteRecord: "#D13438",
  PerformUnboundAction: "#0F6CBD",
  PerformBoundAction: "#0F6CBD",
};

const opShortLabel = (op: string) => {
  if (op === "CreateRecord") return "Create";
  if (op === "DeleteRecord") return "Delete";
  if (op === "PerformUnboundAction") return "Custom API";
  if (op === "PerformBoundAction") return "Custom API";
  return "Update";
};

export const actionsCategory: SearchCategory<ActionItem, ProcessAction & { flowName: string }> = {
  id: "actions",
  label: "Actions",
  icon: <Edit20Regular />,
  color: "#CA5010",
  getItems: (data) => {
    const flowNames = new Map(data.flows.map((f) => [f.id, f.name]));
    return data.actions.map((a, i) => ({
      ...a,
      _flowName: flowNames.get(a.flowId) ?? a.flowId,
      _propertiesText: a.properties.join(", "),
      _propertyValuesText: JSON.stringify(a.propertyValues ?? {}, null, 2),
      _entityColumnsText: a.entityName ? a.properties.map((p) => `${a.entityName}.${p}`).join(" ") : "",
      _entityValuesText: a.entityName
        ? Object.entries(a.propertyValues ?? {})
            .map(([k, v]) => `${a.entityName}.${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
            .join(" ")
        : "",
      _key: `${a.flowId}::${a.actionName}::${i}`,
    }));
  },
  fuseKeys: [
    { name: "actionName", weight: 3 },
    { name: "entityName", weight: 2 },
    { name: "customApiName", weight: 3 },
    { name: "_propertiesText", weight: 2 },
    { name: "_entityColumnsText", weight: 2.5 },
    { name: "_entityValuesText", weight: 2 },
    { name: "_propertyValuesText", weight: 1.5 },
  ],
  toResult: (item, fuse) => ({
    id: item._key,
    categoryId: "actions",
    title: item.actionName,
    subtitle: item._flowName,
    matches: fuse.matches ?? [],
    score: fuse.score,
    payload: { ...item, flowName: item._flowName },
    targetFlowId: item.flowId,
  }),
  renderRow: (result: SearchResult<ProcessAction & { flowName: string }>) => {
    const a = result.payload;
    const nameMatch = findMatch(result.matches, "actionName");
    const entityMatch = findMatch(result.matches, "entityName");
    const propsMatch = findMatch(result.matches, "_propertiesText");
    const valuesMatch = findMatch(result.matches, "_propertyValuesText");
    const color = operationColor[a.operationType] ?? "#8A8886";
    return (
      <div
        style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}
        title={JSON.stringify(a.propertyValues, null, 2)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Text weight="semibold" truncate wrap={false} style={{ fontSize: 13 }}>
            {renderHighlighted(a.actionName, nameMatch?.indices)}
          </Text>
          <Tag appearance="filled" size="small" style={{ backgroundColor: color, color: "#fff" }}>
            {opShortLabel(a.operationType)}
          </Tag>
          <Text size={200} truncate wrap={false} style={{ color: tokens.colorNeutralForeground3 }}>
            in {a.flowName}
          </Text>
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
          <span>{renderHighlighted(a.entityName, entityMatch?.indices)}</span>
          {a.properties.length > 0 && (
            <>
              <span>·</span>
              <span>{renderHighlighted(a.properties.join(", "), propsMatch?.indices)}</span>
            </>
          )}
          {valuesMatch && <span>{renderHighlighted(valuesMatch.value ?? "", valuesMatch.indices)}</span>}
        </div>
      </div>
    );
  },
  odataSearch: (data, filter) => {
    const flowNames = new Map(data.flows.map((f) => [f.id, f.name]));
    const results: SearchResult<ProcessAction & { flowName: string }>[] = [];
    data.actions.forEach((a, i) => {
      // Lowercase keys for the validator
      const lcValues: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(a.propertyValues ?? {})) {
        lcValues[k.toLowerCase()] = v;
      }
      const { result, isOptimistic } = canDataSatisfyFilter(filter, lcValues);
      if (!result || isOptimistic == true) return;
      const flowName = flowNames.get(a.flowId) ?? a.flowId;
      results.push({
        id: `${a.flowId}::${a.actionName}::${i}::odata`,
        categoryId: "actions",
        title: a.actionName,
        subtitle: flowName,
        matches: [],
        score: isOptimistic ? 0.5 : 1,
        payload: { ...a, flowName },
        targetFlowId: a.flowId,
      });
    });
    // Definite matches first
    results.sort((x, y) => (x.score ?? 0) - (y.score ?? 0));
    return results;
  },
};

// silence unused icon import lint
void operationIcon;
