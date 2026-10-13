import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Dropdown,
  Option,
  Input,
  Field,
  Button,
  Switch,
  Tooltip,
  Tag,
  Avatar,
  List,
  ListItem,
  TableCellLayout,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  TabList,
  Tab,
  Text,
  tokens,
  Card,
} from "@fluentui/react-components";
import FlowGraph from "@/components/FlowGraph";
import EmptyState from "@/components/EmptyState";
import { useGraphSelection } from "@/hooks/useGraphSelection";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  Search24Regular,
  Info20Regular,
  Open20Regular,
  AddCircle20Regular,
  Delete20Regular,
  DatabaseArrowUp20Regular,
  Flow20Regular,
  Filter20Regular,
  Edit20Regular,
} from "@fluentui/react-icons";
import { useTheme } from "next-themes";
import { useFlowData } from "@/context/FlowDataContext";
import { Process, ProcessAction, ProcessEdge } from "@/data/flows";
import { canDataSatisfyFilter } from "@/lib/filterValidator";
import { getFlowUrl } from "@/lib/flowHelpers";
import { trackEvent } from "@/lib/appInsights";
import { FileArchive } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ────────────────────────────────────────────────────────────────────────────
type Operation = "any" | "CreateRecord" | "UpdateRecord" | "DeleteRecord" | "CustomMessage";

const SEARCH_NODE_ID = "__search_action__";

const operationLabel: Record<Operation, string> = {
  any: "Any operation",
  CreateRecord: "Create",
  UpdateRecord: "Update",
  DeleteRecord: "Delete",
  CustomMessage: "Custom message",
};

const operationIcon: Record<string, React.ReactElement> = {
  CreateRecord: <AddCircle20Regular />,
  UpdateRecord: <DatabaseArrowUp20Regular />,
  UpdateOnlyRecord: <DatabaseArrowUp20Regular />,
  DeleteRecord: <Delete20Regular />,
  PerformUnboundAction: <Edit20Regular />,
  PerformBoundAction: <Edit20Regular />,
};

const operationColor: Record<string, string> = {
  CreateRecord: "#107C10",
  UpdateRecord: "#CA5010",
  UpdateOnlyRecord: "#CA5010",
  DeleteRecord: "#D13438",
  PerformUnboundAction: "#0078D4",
  PerformBoundAction: "#0078D4",
};

const opShortLabel = (op: string) =>
  op === "CreateRecord"
    ? "Create"
    : op === "DeleteRecord"
      ? "Delete"
      : op === "PerformUnboundAction" || op === "PerformBoundAction"
        ? "Custom message"
        : "Update";

const parseColumns = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const normalizeEntityName = (value: string | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/i?es$/, "").replace(/s$/, "");

const matchesOperation = (action: ProcessAction, op: Operation) => {
  if (op === "any") return true;
  if (op === "CustomMessage")
    return action.operationType === "PerformUnboundAction" || action.operationType === "PerformBoundAction";
  if (op === "UpdateRecord")
    return action.operationType === "UpdateRecord" || action.operationType === "UpdateOnlyRecord";
  return action.operationType === op;
};

// ────────────────────────────────────────────────────────────────────────────
// Result row components
// ────────────────────────────────────────────────────────────────────────────
interface WhereGroup {
  flowId: string;
  flowName: string;
  actions: ProcessAction[];
}

function WhereResultRow({ group, environmentId }: { group: WhereGroup; environmentId: string | null }) {
  return (
    <AccordionItem value={group.flowId}>
      <AccordionHeader expandIconPosition="start">
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
          <Avatar
            icon={<Flow20Regular />}
            style={{ backgroundColor: "#0078D4", color: "#fff" }}
            size={28}
            shape="circular"
            aria-label="Flow"
          />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Text weight="semibold" truncate wrap={false} style={{ fontSize: 13 }}>
              {group.flowName}
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {group.actions.length} matching action{group.actions.length !== 1 ? "s" : ""}
            </Text>
          </div>
          {environmentId && (
            <Tooltip content="Open in Power Automate" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Open20Regular />}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(getFlowUrl(environmentId, group.flowId), "_blank", "noopener,noreferrer");
                }}
                aria-label="Open in Power Automate"
              />
            </Tooltip>
          )}
          <Tag appearance="brand" size="small">
            {group.actions.length}
          </Tag>
        </div>
      </AccordionHeader>
      <AccordionPanel>
        <List style={{ paddingLeft: 40 }}>
          {group.actions.map((action, i) => {
            const color = operationColor[action.operationType] ?? "#8A8886";
            const propsText = action.properties.length > 0 ? action.properties.join(", ") : "No properties set";
            return (
              <ListItem key={`${action.actionName}-${i}`} style={{ padding: "4px 0" }}>
                <TableCellLayout
                  media={
                    <Avatar
                      icon={operationIcon[action.operationType] ?? <Edit20Regular />}
                      style={{ backgroundColor: color, color: "#fff" }}
                      size={24}
                      shape="square"
                      aria-label={action.operationType}
                    />
                  }
                  description={
                    <span style={{ fontSize: 12 }} title={JSON.stringify(action.propertyValues)}>
                      {opShortLabel(action.operationType)} · {action.entityName} · {propsText}
                      {action.path.length > 0 && (
                        <span style={{ color: tokens.colorNeutralForeground3 }}>
                          {" — "}
                          {action.path.join(" › ")}
                        </span>
                      )}
                    </span>
                  }
                  truncate
                  style={{ fontSize: 13 }}
                >
                  {action.actionName}
                </TableCellLayout>
              </ListItem>
            );
          })}
        </List>
      </AccordionPanel>
    </AccordionItem>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────
export default function Where() {
  const { resolvedTheme } = useTheme();
  const fluentTheme = resolvedTheme === "dark" ? webDarkTheme : webLightTheme;
  const { allFlows, allEdges, allActions, hasData, environmentId, permanentlyHiddenIds } = useFlowData();
  const [searchParams] = useSearchParams();

  const [entity, setEntity] = useState("");
  const [operation, setOperation] = useState<Operation>("any");
  const [columns, setColumns] = useState("");
  const [odataFilter, setOdataFilter] = useState("");
  const [hideOptimistic, setHideOptimistic] = useState(false);
  const [hideInactive, setHideInactive] = useState(true);
  const [executed, setExecuted] = useState(false);
  const [resultView, setResultView] = useState<"list" | "map">("list");
  const {
    selectedNodeId,
    setSelectedNodeId,
    hiddenIds,
    setHiddenIds,
    toggleVisibility,
    showOnlyRelated,
    showOnlyDirect,
  } = useGraphSelection(allFlows, allEdges, SEARCH_NODE_ID);

  // Entity options
  const entities = useMemo(() => {
    const byNormalizedName = new Map<string, string>();
    const addEntity = (value: string | undefined) => {
      const entityName = value?.trim().toLowerCase();
      if (!entityName) return;
      const normalized = normalizeEntityName(entityName);
      const existing = byNormalizedName.get(normalized);
      if (!existing || entityName.length < existing.length) byNormalizedName.set(normalized, entityName);
    };

    allActions.forEach((a) => addEntity(a.entityName));
    return [...byNormalizedName.values()].sort((a, b) => a.localeCompare(b));
  }, [allActions]);

  const customMessages = useMemo(() => {
    const set = new Set<string>();
    allFlows.forEach((f) => {
      if (f.triggerTypes.includes("custom-message") && f.uniqueName) set.add(f.uniqueName);
    });
    allActions.forEach((a) => {
      if (a.customActionName) set.add(a.customActionName);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allFlows, allActions]);

  const isCustomMessageOp = operation === "CustomMessage";
  const selectionOptions = isCustomMessageOp ? customMessages : entities;
  const selectionLabel = isCustomMessageOp ? "Message" : "Entity";
  const selectionPlaceholder = isCustomMessageOp ? "Select message…" : "Select entity…";

  // Initialize from URL params
  useEffect(() => {
    const paramEntity = searchParams.get("entity");
    if (!paramEntity || entities.length === 0) return;
    const lower = paramEntity.toLowerCase();
    const matched =
      entities.find((c) => c.toLowerCase() === lower) ??
      entities.find((c) => {
        const cl = c.toLowerCase();
        return cl.replace(/i?es$/, "").replace(/s$/, "") === lower.replace(/i?es$/, "").replace(/s$/, "");
      }) ??
      paramEntity;
    setEntity(matched);
    const op = searchParams.get("operation");
    if (op === "CreateRecord" || op === "UpdateRecord" || op === "DeleteRecord" || op === "any" || op === "CustomMessage") {
      setOperation(op);
    }
    setColumns(searchParams.get("columns") ?? "");
    setOdataFilter(searchParams.get("filter") ?? "");
    setExecuted(true);
  }, [entities, searchParams]);

  const columnList = useMemo(() => parseColumns(columns), [columns]);

  const flowNameMap = useMemo(() => {
    const m = new Map<string, string>();
    allFlows.forEach((f) => m.set(f.id, f.name));
    return m;
  }, [allFlows]);

  const flowActiveMap = useMemo(() => {
    const m = new Map<string, boolean | undefined>();
    allFlows.forEach((f) => m.set(f.id, f.isActive));
    return m;
  }, [allFlows]);

  // Where results
  const whereGroups = useMemo<WhereGroup[]>(() => {
    if (!executed || !entity) return [];
    const trimmed = odataFilter.trim();
    const matching = allActions.filter((action) => {
      if (hideInactive && flowActiveMap.get(action.flowId) === false) return false;
      if (isCustomMessageOp) {
        if (action.operationType !== "PerformUnboundAction" && action.operationType !== "PerformBoundAction") return false;
        if ((action.customActionName ?? "").toLowerCase() !== entity.toLowerCase()) return false;
      } else {
        if (normalizeEntityName(action.entityName) !== normalizeEntityName(entity)) return false;
        if (!matchesOperation(action, operation)) return false;
      }
      if (columnList.length > 0 && !columnList.some((c) => action.properties.includes(c))) return false;
      if (trimmed) {
        const r = canDataSatisfyFilter(trimmed, action.propertyValues);
        if (!r.result) return false;
        if (hideOptimistic && r.isOptimistic) return false;
      }
      return true;
    });
    const grouped = new Map<string, ProcessAction[]>();
    matching.forEach((a) => {
      const list = grouped.get(a.flowId) ?? [];
      list.push(a);
      grouped.set(a.flowId, list);
    });
    return [...grouped.entries()]
      .map(([flowId, actions]) => ({
        flowId,
        flowName: flowNameMap.get(flowId) ?? flowId,
        actions,
      }))
      .sort((a, b) => a.flowName.localeCompare(b.flowName));
  }, [executed, entity, operation, isCustomMessageOp, allActions, columnList, odataFilter, hideOptimistic, hideInactive, flowNameMap, flowActiveMap]);

  // Flows + edges for the Map view
  const mapFlows = useMemo<Process[]>(() => {
    if (!executed) return [];
    const directIds = new Set(whereGroups.map((g) => g.flowId));
    if (directIds.size === 0) return [];

    // Expand to include indirect flows via BFS along edges (upstream: target -> source)
    const allIds = new Set<string>(directIds);
    const queue: string[] = [...directIds];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of allEdges) {
        if (hideOptimistic && e.isOptimistic) continue;
        if (e.target === cur && !allIds.has(e.source)) {
          if (hideInactive && flowActiveMap.get(e.source) === false) continue;
          allIds.add(e.source);
          queue.push(e.source);
        }
      }
    }

    const searchNode: Process = {
      id: SEARCH_NODE_ID,
      name: "Search",
      processType: "cloud-flow",
      triggerTypes: ["other"],
      triggerTable: entity || undefined,
    };
    return [searchNode, ...allFlows.filter((f) => allIds.has(f.id) && !hiddenIds.has(f.id) && !permanentlyHiddenIds.has(f.id))];
  }, [executed, whereGroups, allFlows, allEdges, entity, hideOptimistic, hideInactive, flowActiveMap, hiddenIds, permanentlyHiddenIds]);

  const mapEdges = useMemo<ProcessEdge[]>(() => {
    const flowIds = new Set(mapFlows.map((f) => f.id).filter((id) => id !== SEARCH_NODE_ID));
    const existing = allEdges.filter((e) => {
      if (!flowIds.has(e.source) || !flowIds.has(e.target)) return false;
      if (hideOptimistic && e.isOptimistic) return false;
      if (hideInactive && (flowActiveMap.get(e.source) === false || flowActiveMap.get(e.target) === false)) return false;
      return true;
    });
    const directIds = new Set(whereGroups.map((g) => g.flowId).filter((id) => !hiddenIds.has(id)));
    const searchEdges: ProcessEdge[] = [...directIds].map((id) => ({
      source: id,
      target: SEARCH_NODE_ID,
      actionName: "matches",
      type: "triggers" as const,
    }));
    return [...searchEdges, ...existing];
  }, [mapFlows, allEdges, whereGroups, hideOptimistic, hideInactive, flowActiveMap, hiddenIds]);

  const canExecute = !!entity;

  const handleExecute = () => {
    setExecuted(true);
    trackEvent("where_search");
  };

  const resetExecuted = () => {
    setExecuted(false);
    setHiddenIds(new Set());
  };

  // ── Empty state (no data imported) ────────────────────────────────────────
  if (!hasData) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <FileArchive style={{ width: 40, height: 40, color: tokens.colorNeutralForeground3 }} />
        <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
          Import a solution to use Where.
        </Text>
      </div>
    );
  }

  const noResults = executed && whereGroups.length === 0;

  const totalActions = useMemo(() => whereGroups.reduce((s, g) => s + g.actions.length, 0), [whereGroups]);

  return (
      <Card style={{ margin: "8px 16px 16px 16px", padding: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <ResizablePanelGroup direction="horizontal" style={{ flex: 1, minHeight: 0 }}>
          <ResizablePanel
            defaultSize={28}
            minSize={20}
            maxSize={45}
            style={{
              borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
              padding: 16,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              backgroundColor: tokens.colorNeutralBackground2,
            }}
          >
            <Field label="Operation">
              <Dropdown
                value={operationLabel[operation]}
                selectedOptions={[operation]}
                onOptionSelect={(_, data) => {
                  const next = (data.optionValue as Operation) ?? "any";
                  setOperation(next);
                  // Switching to/from CustomMessage swaps the selection list, so clear it.
                  if ((next === "CustomMessage") !== isCustomMessageOp) setEntity("");
                  resetExecuted();
                }}
              >
                {(["any", "CreateRecord", "UpdateRecord", "DeleteRecord", "CustomMessage"] as Operation[]).map((op) => (
                  <Option key={op} value={op} text={operationLabel[op]}>
                    {operationLabel[op]}
                  </Option>
                ))}
              </Dropdown>
            </Field>

            <Field label={selectionLabel}>
              <Dropdown
                placeholder={selectionPlaceholder}
                value={entity ? (isCustomMessageOp ? entity.replace(/^Microsoft\.Dynamics\.CRM\./i, "") : entity) : ""}
                selectedOptions={entity ? [entity] : []}
                onOptionSelect={(_, data) => {
                  setEntity(data.optionValue ?? "");
                  resetExecuted();
                }}
              >
                {selectionOptions.map((e) => (
                  <Option key={e} value={e} text={isCustomMessageOp ? e.replace(/^Microsoft\.Dynamics\.CRM\./i, "") : e}>
                    {isCustomMessageOp ? e.replace(/^Microsoft\.Dynamics\.CRM\./i, "") : e}
                  </Option>
                ))}
              </Dropdown>
            </Field>


            <Field label="Columns (optional, comma-separated)">
              <Input
                value={columns}
                onChange={(_, data) => {
                  setColumns(data.value);
                  resetExecuted();
                }}
                placeholder="statuscode, name"
              />
            </Field>

            <Field label="OData filter (optional)">
              <Input
                value={odataFilter}
                onChange={(_, data) => {
                  setOdataFilter(data.value);
                  resetExecuted();
                }}
                placeholder="statuscode eq 1"
              />
            </Field>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Text size={200}>Hide optimistic</Text>
                <Tooltip
                  content="Hide results where the filter match was assumed due to missing or dynamic data."
                  relationship="description"
                >
                  <Info20Regular style={{ color: tokens.colorNeutralForeground3, width: 14, height: 14 }} />
                </Tooltip>
              </div>
              <Switch
                checked={hideOptimistic}
                onChange={(_, data) => {
                  setHideOptimistic(data.checked);
                  resetExecuted();
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Text size={200}>Hide inactive</Text>
              <Switch
                checked={hideInactive}
                onChange={(_, data) => {
                  setHideInactive(data.checked);
                  resetExecuted();
                }}
              />
            </div>

            <Button
              appearance="primary"
              icon={<Search24Regular />}
              disabled={!canExecute}
              onClick={handleExecute}
            >
              Search
            </Button>

            {executed && whereGroups.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: 8,
                  borderRadius: tokens.borderRadiusMedium,
                  backgroundColor: tokens.colorNeutralBackground3,
                }}
              >
                <Text size={200}>
                  <Tag appearance="brand" size="small">
                    {totalActions}
                  </Tag>{" "}
                  action{totalActions !== 1 ? "s" : ""} across{" "}
                  <Tag appearance="brand" size="small">
                    {whereGroups.length}
                  </Tag>{" "}
                  flow{whereGroups.length !== 1 ? "s" : ""}
                </Text>
              </div>
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* ── Results panel ───────────────────────────────────────────── */}
          <ResizablePanel
            defaultSize={72}
            minSize={40}
            style={{
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {executed && !noResults && (
              <div
                style={{
                  borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                  padding: "0 12px",
                  flexShrink: 0,
                }}
              >
                <TabList
                  selectedValue={resultView}
                  onTabSelect={(_, data) => setResultView(data.value as "list" | "map")}
                  size="small"
                >
                  <Tab value="list">List</Tab>
                  <Tab value="map">Map</Tab>
                </TabList>
              </div>
            )}

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: resultView === "map" && executed && !noResults ? "hidden" : "auto",
                padding: resultView === "map" && executed && !noResults ? 0 : 16,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {!executed && (
                <EmptyState
                  icon={<Search24Regular />}
                  title="Search Dataverse actions"
                  description="Pick an entity (and optionally narrow by operation, columns or OData filter) to see every flow that touches it."
                />
              )}

              {executed && noResults && (
                <EmptyState
                  icon={<Filter20Regular />}
                  title="No matches"
                  description="No actions match these filters. Try broadening the operation or removing the column/OData filter."
                />
              )}

              {executed && !noResults && resultView === "list" && (
                <Accordion multiple collapsible defaultOpenItems={whereGroups.map((g) => g.flowId)}>
                  {whereGroups.map((g) => (
                    <WhereResultRow key={g.flowId} group={g} environmentId={environmentId} />
                  ))}
                </Accordion>
              )}

              {executed && !noResults && resultView === "map" && (
                <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
                  <FlowGraph
                    flows={mapFlows}
                    edges={mapEdges}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                    hiddenIds={hiddenIds}
                    onToggleVisibility={toggleVisibility}
                    onHideFlow={(id) => toggleVisibility(id)}
                    onShowOnlyRelated={showOnlyRelated}
                    onShowOnlyDirect={showOnlyDirect}
                  />
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </Card>
  );
}

