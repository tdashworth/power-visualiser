import FlowGraph from "@/components/FlowGraph";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Button,
  Switch,
  Text,
  Tooltip,
  Dropdown,
  Option,
  Label,
  tokens,
  Card,
} from "@fluentui/react-components";
import { Eye20Regular, Info20Regular } from "@fluentui/react-icons";
import { FileArchive } from "lucide-react";
import { useTheme } from "next-themes";
import { useFlowData } from "@/context/FlowDataContext";
import FluentProcessList from "@/components/FluentProcessList";
import EmptyState from "@/components/EmptyState";
import { useGraphSelection } from "@/hooks/useGraphSelection";
import { triggerMeta, processTypeMeta, TriggerType, ProcessType } from "@/data/flows";
import { useEffect, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

const setSerialize = <T,>(v: Set<T>) => JSON.stringify([...v]);
const setDeserialize = <T,>(raw: string) => new Set<T>(JSON.parse(raw) as T[]);

export default function Fluent() {
  const { resolvedTheme } = useTheme();
  const fluentTheme = resolvedTheme === "dark" ? webDarkTheme : webLightTheme;
  const {
    allFlows,
    allEdges,
    environmentId,
    hasData,
    pendingSelection,
    setPendingSelection,
    permanentlyHiddenIds,
    togglePermanentlyHidden,
    clearPermanentlyHidden,
  } = useFlowData();

  const {
    selectedNodeId,
    setSelectedNodeId,
    hiddenIds,
    setHiddenIds,
    toggleVisibility,
    showOnlyRelated,
    showOnlyDirect,
    resetHidden,
  } = useGraphSelection(allFlows, allEdges);

  // Apply a pending selection (e.g. coming from global search) — reveal node if hidden, select it.
  useEffect(() => {
    if (!pendingSelection) return;
    const { flowId } = pendingSelection;
    if (hiddenIds.has(flowId)) {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(flowId);
        return next;
      });
    }
    setSelectedNodeId(flowId);
    setPendingSelection(null);
  }, [pendingSelection, hiddenIds, setHiddenIds, setSelectedNodeId, setPendingSelection]);

  const [hideOptimistic, setHideOptimistic] = usePersistedState("map.hideOptimistic", false);
  const [hideInactive, setHideInactive] = usePersistedState("map.hideInactive", true);

  const allTriggerTypes = useMemo(() => Object.keys(triggerMeta) as TriggerType[], []);
  const allProcessTypes = useMemo(() => Object.keys(processTypeMeta) as ProcessType[], []);
  const [selectedTriggers, setSelectedTriggers] = usePersistedState<Set<TriggerType>>(
    "map.selectedTriggers",
    () => new Set(Object.keys(triggerMeta) as TriggerType[]),
    { serialize: setSerialize, deserialize: setDeserialize<TriggerType> },
  );
  const [selectedProcessTypes, setSelectedProcessTypes] = usePersistedState<Set<ProcessType>>(
    "map.selectedProcessTypes",
    () => new Set(Object.keys(processTypeMeta) as ProcessType[]),
    { serialize: setSerialize, deserialize: setDeserialize<ProcessType> },
  );

  const matchesFilters = (f: (typeof allFlows)[number]) =>
    selectedProcessTypes.has(f.processType) &&
    (f.triggerTypes.length === 0 ? selectedTriggers.has("other") : f.triggerTypes.some((t) => selectedTriggers.has(t)));

  const visibleFlows = useMemo(
    () =>
      allFlows.filter(
        (f) =>
          !hiddenIds.has(f.id) &&
          !permanentlyHiddenIds.has(f.id) &&
          (!hideInactive || f.isActive !== false) &&
          matchesFilters(f),
      ),
    [allFlows, hiddenIds, permanentlyHiddenIds, hideInactive, selectedTriggers, selectedProcessTypes],
  );

  const visibleIds = useMemo(() => new Set(visibleFlows.map((f) => f.id)), [visibleFlows]);

  const visibleEdges = useMemo(
    () =>
      allEdges.filter(
        (e) => visibleIds.has(e.source) && visibleIds.has(e.target) && !(hideOptimistic && e.isOptimistic),
      ),
    [allEdges, visibleIds, hideOptimistic],
  );

  const listFlows = useMemo(
    () => allFlows.filter((f) => (!hideInactive || f.isActive !== false) && matchesFilters(f)),
    [allFlows, hideInactive, selectedTriggers, selectedProcessTypes],
  );

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
          Import a solution to use Power Visualiser.
        </Text>
      </div>
    );
  }

  const sidebarHeader = (
    <div
      style={{
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground2,
        flexShrink: 0,
      }}
    >
      <Accordion collapsible>
        <AccordionItem value="filters">
          <AccordionHeader>Filters</AccordionHeader>
          <AccordionPanel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Label size="small">Process types</Label>
                <Dropdown
                  multiselect
                  size="small"
                  placeholder="All process types"
                  selectedOptions={Array.from(selectedProcessTypes)}
                  value={
                    selectedProcessTypes.size === allProcessTypes.length
                      ? "All"
                      : Array.from(selectedProcessTypes)
                        .map((p) => processTypeMeta[p].label)
                        .join(", ")
                  }
                  onOptionSelect={(_, data) => setSelectedProcessTypes(new Set(data.selectedOptions as ProcessType[]))}
                >
                  {allProcessTypes.map((p) => (
                    <Option key={p} value={p} text={processTypeMeta[p].label}>
                      {processTypeMeta[p].label}
                    </Option>
                  ))}
                </Dropdown>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Label size="small">Trigger types</Label>
                <Dropdown
                  multiselect
                  size="small"
                  placeholder="All trigger types"
                  selectedOptions={Array.from(selectedTriggers)}
                  value={
                    selectedTriggers.size === allTriggerTypes.length
                      ? "All"
                      : Array.from(selectedTriggers)
                        .map((t) => triggerMeta[t].label)
                        .join(", ")
                  }
                  onOptionSelect={(_, data) => setSelectedTriggers(new Set(data.selectedOptions as TriggerType[]))}
                >
                  {allTriggerTypes.map((t) => (
                    <Option key={t} value={t} text={triggerMeta[t].label}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: triggerMeta[t].color,
                          marginRight: 6,
                        }}
                      />
                      {triggerMeta[t].label}
                    </Option>
                  ))}
                </Dropdown>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Text size={200}>Hide optimistic</Text>
                  <Tooltip content="Hide edges inferred from optimistic dependencies." relationship="description">
                    <Info20Regular style={{ color: tokens.colorNeutralForeground3, width: 14, height: 14 }} />
                  </Tooltip>
                </div>
                <Switch checked={hideOptimistic} onChange={(_, data) => setHideOptimistic(data.checked)} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Text size={200}>Hide inactive</Text>
                <Switch checked={hideInactive} onChange={(_, data) => setHideInactive(data.checked)} />
              </div>

              <Button
                appearance="subtle"
                size="small"
                icon={<Eye20Regular />}
                onClick={resetHidden}
                disabled={hiddenIds.size === 0}
              >
                Show all ({hiddenIds.size} hidden)
              </Button>

              {permanentlyHiddenIds.size > 0 && (
                <Button appearance="subtle" size="small" icon={<Eye20Regular />} onClick={clearPermanentlyHidden}>
                  Restore permanently hidden ({permanentlyHiddenIds.size})
                </Button>
              )}
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );

  return (
    // <FluentProvider theme={fluentTheme} className="flex flex-1 w-full" style={{ overflow: "hidden" }}>
    <div className="flex flex-col flex-1" style={{ overflow: "hidden" }}>
      <Card style={{ margin: "8px 16px 16px 16px", padding: 0, height: "calc(100% - 16px)" }}>
        <ResizablePanelGroup direction="horizontal" style={{ flex: 1, overflow: "hidden" }}>
          <ResizablePanel
            defaultSize={33}
            minSize={15}
            maxSize={60}
            style={{
              borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              // backgroundColor: tokens.colorNeutralBackground1,
            }}
          >
            {sidebarHeader}
            <FluentProcessList
              processes={listFlows}
              hiddenIds={hiddenIds}
              permanentlyHiddenIds={permanentlyHiddenIds}
              onToggleVisibility={toggleVisibility}
              onTogglePermanentlyHidden={togglePermanentlyHidden}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              environmentId={environmentId}
              onShowOnlyRelated={showOnlyRelated}
              onShowOnlyDirect={showOnlyDirect}
            />
            {/* </Card> */}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={67} minSize={30} style={{ position: "relative" }}>
            {/* <Card style={{ margin: "8px 16px 8px 8px", height: "calc(100% - 16px)", padding: 0 }}> */}
            <FlowGraph
              flows={visibleFlows}
              edges={visibleEdges}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              hiddenIds={hiddenIds}
              onToggleVisibility={toggleVisibility}
              onShowOnlyRelated={showOnlyRelated}
              onShowOnlyDirect={showOnlyDirect}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </Card>
    </div>
    // </FluentProvider>
  );
}
