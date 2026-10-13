import React, { useState, useMemo } from "react";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Dropdown,
  Option,
  Field,
  Button,
  Switch,
  Tooltip,
  Tag,
  Avatar,
  List,
  ListItem,
  TableCellLayout,
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
  Flash24Regular,
  Play20Regular,
  Info20Regular,
  Open20Regular,
  AddCircle20Regular,
  Clock20Regular,
  Cursor20Regular,
  Edit20Regular,
  Delete20Regular,
  QuestionCircle20Regular,
  Flow20Regular,
  Filter20Regular,
  PlugConnected20Regular,
} from "@fluentui/react-icons";
import { useTheme } from "next-themes";
import { useFlowData } from "@/context/FlowDataContext";
import { Process, ProcessEdge, TriggerType, triggerMeta } from "@/data/flows";
import { canDataSatisfyFilter } from "@/lib/filterValidator";
import { getFlowUrl } from "@/lib/flowHelpers";
import { trackEvent } from "@/lib/appInsights";
import { FileArchive } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ────────────────────────────────────────────────────────────────────────────
type Operation = "CreateRecord" | "UpdateRecord" | "DeleteRecord" | "CustomMessage";

const SEARCH_NODE_ID = "__search_action__";

const operationToTrigger: Record<Operation, TriggerType> = {
  CreateRecord: "dataverse-create",
  UpdateRecord: "dataverse-update",
  DeleteRecord: "dataverse-delete",
  CustomMessage: "custom-message",
};

const operationLabel: Record<Operation, string> = {
  CreateRecord: "Create",
  UpdateRecord: "Update",
  DeleteRecord: "Delete",
  CustomMessage: "Custom message",
};

const triggerIcon: Record<TriggerType, React.ReactElement> = {
  "dataverse-create": <AddCircle20Regular />,
  "dataverse-update": <Edit20Regular />,
  "dataverse-delete": <Delete20Regular />,
  "child-flow": <Flow20Regular />,
  "on-demand": <Cursor20Regular />,
  scheduled: <Clock20Regular />,
  "custom-message": <PlugConnected20Regular />,
  other: <QuestionCircle20Regular />,
};

const normalizeEntityName = (value: string | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/i?es$/, "").replace(/s$/, "");

const flowMatchesWhatIfTrigger = (
  flow: Process,
  selection: string,
  triggerType: TriggerType,
) => {
  if (triggerType === "custom-message") {
    if (!flow.triggerTypes.includes("custom-message")) return false;
    return (flow.uniqueName ?? "").trim().toLowerCase() === selection.trim().toLowerCase();
  }
  if (normalizeEntityName(flow.triggerTable) !== normalizeEntityName(selection)) return false;
  if (flow.triggerTypes.includes(triggerType)) return true;

  // Older cached imports may have Dataverse cloud-flow triggers parsed as "other".
  // If the trigger table is known, still include them as direct what-if candidates.
  return flow.processType === "cloud-flow" && flow.triggerTypes.includes("other");
};

// ────────────────────────────────────────────────────────────────────────────
// Result row components
// ────────────────────────────────────────────────────────────────────────────
interface WhatIfResult {
  flow: Process;
  isDirect: boolean;
  depth: number;
}

function getPrimaryTrigger(flow: Process): TriggerType {
  return flow.triggerTypes[0] ?? "other";
}

function WhatIfResultRow({ result, environmentId }: { result: WhatIfResult; environmentId: string | null }) {
  const primaryTrigger = getPrimaryTrigger(result.flow);
  const meta = triggerMeta[primaryTrigger] ?? triggerMeta.other;

  return (
    <ListItem style={{ padding: "8px 12px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
      <TableCellLayout
        media={
          <Avatar
            icon={triggerIcon[primaryTrigger] ?? triggerIcon.other}
            style={{
              backgroundColor: meta.color,
              color: tokens.colorNeutralForegroundInverted,
            }}
            size={32}
            shape={result.flow.processType === "classic-workflow" ? "square" : "circular"}
            aria-label={meta.label}
          />
        }
        description={
          <span style={{ fontSize: 12 }}>
            {meta.label}
            {result.flow.triggerTable ? ` · ${result.flow.triggerTable}` : ""}
          </span>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Text weight="semibold" style={{ fontSize: 13 }}>
            {result.flow.name}
          </Text>
          {result.isDirect && (
            <Tag appearance="brand" size="small">
              Direct
            </Tag>
          )}
          {environmentId && (
            <Tooltip content="Open in Power Automate" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Open20Regular />}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(getFlowUrl(environmentId, result.flow.id), "_blank", "noopener,noreferrer");
                }}
                aria-label="Open in Power Automate"
              />
            </Tooltip>
          )}
        </div>
      </TableCellLayout>
    </ListItem>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────
export default function WhatIf() {
  const { resolvedTheme } = useTheme();
  const fluentTheme = resolvedTheme === "dark" ? webDarkTheme : webLightTheme;
  const { allFlows, allEdges, hasData, environmentId, permanentlyHiddenIds } = useFlowData();

  const [entity, setEntity] = useState("");
  const [operation, setOperation] = useState<Operation>("CreateRecord");
  const [payload, setPayload] = useState("");
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
  const entities = useMemo(() => {
    const byNormalizedName = new Map<string, string>();
    const addEntity = (value: string | undefined) => {
      const entityName = value?.trim().toLowerCase();
      if (!entityName) return;
      const normalized = normalizeEntityName(entityName);
      const existing = byNormalizedName.get(normalized);
      if (!existing || entityName.length < existing.length) byNormalizedName.set(normalized, entityName);
    };

    allFlows.forEach((f) => addEntity(f.triggerTable));
    return [...byNormalizedName.values()].sort((a, b) => a.localeCompare(b));
  }, [allFlows]);

  const customMessages = useMemo(() => {
    const set = new Set<string>();
    allFlows.forEach((f) => {
      if (f.triggerTypes.includes("custom-message") && f.uniqueName) {
        set.add(f.uniqueName);
      }
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allFlows]);

  const isCustomMessageOp = operation === "CustomMessage";
  const selectionOptions = isCustomMessageOp ? customMessages : entities;
  const selectionLabel = isCustomMessageOp ? "Message" : "Entity";
  const selectionPlaceholder = isCustomMessageOp ? "Select message…" : "Select entity…";


  // Parse what-if payload
  const payloadProperties = useMemo(() => {
    if (!payload.trim()) return {};
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [payload]);

  const payloadInvalid = useMemo(() => {
    if (!payload.trim()) return false;
    try {
      JSON.parse(payload);
      return false;
    } catch {
      return true;
    }
  }, [payload]);

  const flowActiveMap = useMemo(() => {
    const m = new Map<string, boolean | undefined>();
    allFlows.forEach((f) => m.set(f.id, f.isActive));
    return m;
  }, [allFlows]);

  // What If results
  const whatIfResults = useMemo<WhatIfResult[]>(() => {
    if (!executed || !entity) return [];
    const triggerType = operationToTrigger[operation];

    const direct = new Set<string>();
    allFlows.forEach((f) => {
      if (hideInactive && f.isActive === false) return;
      if (!flowMatchesWhatIfTrigger(f, entity, triggerType)) return;
      if (
        triggerType === "dataverse-update" &&
        f.updateColumns &&
        f.updateColumns.length > 0 &&
        Object.keys(payloadProperties).length > 0
      ) {
        const keys = Object.keys(payloadProperties).map((k) => k.toLowerCase());
        if (!f.updateColumns.some((c) => keys.includes(c.toLowerCase()))) return;
      }
      if (f.dataFilter && Object.keys(payloadProperties).length > 0) {
        const filterResult = canDataSatisfyFilter(f.dataFilter, payloadProperties);
        if (!filterResult.result) return;
        if (hideOptimistic && filterResult.isOptimistic) return;
      }
      direct.add(f.id);
    });

    if (direct.size === 0) return [];

    // BFS for cascade depth
    const depths = new Map<string, number>();
    direct.forEach((id) => depths.set(id, 0));
    const queue: string[] = [...direct];
    while (queue.length) {
      const cur = queue.shift()!;
      const d = depths.get(cur)!;
      for (const e of allEdges) {
        if (hideOptimistic && e.isOptimistic) continue;
        if (hideInactive && flowActiveMap.get(e.target) === false) continue;
        if (e.source === cur && !depths.has(e.target)) {
          depths.set(e.target, d + 1);
          queue.push(e.target);
        }
      }
    }

    const flowMap = new Map(allFlows.map((f) => [f.id, f]));
    return [...depths.entries()]
      .map(([id, depth]) => {
        const flow = flowMap.get(id);
        if (!flow) return null;
        return { flow, depth, isDirect: direct.has(id) };
      })
      .filter((r): r is WhatIfResult => r !== null)
      .sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.flow.name.localeCompare(b.flow.name);
      });
  }, [executed, entity, operation, allFlows, allEdges, payloadProperties, hideOptimistic, hideInactive, flowActiveMap]);

  const directWhatIfResults = useMemo(() => whatIfResults.filter((r) => r.isDirect), [whatIfResults]);
  const directCount = directWhatIfResults.length;

  // Flows + edges for the Map view
  const mapFlows = useMemo<Process[]>(() => {
    if (!executed) return [];
    const directIds = new Set(directWhatIfResults.map((r) => r.flow.id));
    if (directIds.size === 0) return [];

    // Expand to include indirect flows via BFS along edges (downstream: source -> target)
    const allIds = new Set<string>(directIds);
    const queue: string[] = [...directIds];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of allEdges) {
        if (hideOptimistic && e.isOptimistic) continue;
        if (e.source === cur && !allIds.has(e.target)) {
          if (hideInactive && flowActiveMap.get(e.target) === false) continue;
          allIds.add(e.target);
          queue.push(e.target);
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
  }, [executed, directWhatIfResults, allFlows, allEdges, entity, hideOptimistic, hideInactive, flowActiveMap, hiddenIds, permanentlyHiddenIds]);

  const mapEdges = useMemo<ProcessEdge[]>(() => {
    const flowIds = new Set(mapFlows.map((f) => f.id).filter((id) => id !== SEARCH_NODE_ID));
    const existing = allEdges.filter((e) => {
      if (!flowIds.has(e.source) || !flowIds.has(e.target)) return false;
      if (hideOptimistic && e.isOptimistic) return false;
      if (hideInactive && (flowActiveMap.get(e.source) === false || flowActiveMap.get(e.target) === false)) return false;
      return true;
    });
    const directIds = new Set(directWhatIfResults.map((r) => r.flow.id).filter((id) => !hiddenIds.has(id)));
    const searchEdges: ProcessEdge[] = [...directIds].map((id) => ({
      source: SEARCH_NODE_ID,
      target: id,
      actionName: "matches",
      type: "triggers" as const,
    }));
    return [...searchEdges, ...existing];
  }, [mapFlows, allEdges, directWhatIfResults, hideOptimistic, hideInactive, flowActiveMap, hiddenIds]);

  const canExecute = !!entity && !payloadInvalid;

  const handleExecute = () => {
    setExecuted(true);
    trackEvent("what_if_search");
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
          Import a solution to use What If.
        </Text>
      </div>
    );
  }

  const noResults = executed && directWhatIfResults.length === 0;

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
                setOperation((data.optionValue as Operation) ?? "CreateRecord");
                setEntity("");
                resetExecuted();
              }}
            >
              {(["CreateRecord", "UpdateRecord", "DeleteRecord", "CustomMessage"] as Operation[]).map((op) => (
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


          <Field
            label="JSON payload (optional)"
            validationState={payloadInvalid ? "error" : "none"}
            validationMessage={payloadInvalid ? "Invalid JSON" : undefined}
          >
            <textarea
              value={payload}
              onChange={(e) => {
                setPayload(e.target.value);
                resetExecuted();
              }}
              placeholder='{"statuscode": 1, "field_name": "value"}'
              style={{
                minHeight: 100,
                fontFamily: tokens.fontFamilyMonospace,
                fontSize: 12,
                padding: 8,
                border: `1px solid ${tokens.colorNeutralStroke1}`,
                borderRadius: tokens.borderRadiusMedium,
                backgroundColor: tokens.colorNeutralBackground1,
                color: tokens.colorNeutralForeground1,
                resize: "vertical",
              }}
            />
          </Field>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Text size={200}>Hide optimistic</Text>
              <Tooltip
                content="Hide cascades inferred from optimistic dependency edges."
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
            icon={<Play20Regular />}
            disabled={!canExecute}
            onClick={handleExecute}
          >
            Simulate
          </Button>

          {executed && directWhatIfResults.length > 0 && (
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
                  {directCount}
                </Tag>{" "}
                directly triggered flow{directCount !== 1 ? "s" : ""}
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
                icon={<Flash24Regular />}
                title="Simulate a Dataverse change"
                description="Pick an entity and operation, then click Simulate to see which flows will fire and what cascades downstream."
              />
            )}

            {executed && noResults && (
              <EmptyState
                icon={<Filter20Regular />}
                title="No matches"
                description="No flows are triggered by this operation. Try a different entity or operation."
              />
            )}

            {executed && !noResults && resultView === "list" && (
              <List style={{ flex: 1 }}>
                {directWhatIfResults.map((r) => (
                  <WhatIfResultRow key={r.flow.id} result={r} environmentId={environmentId} />
                ))}
              </List>
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
