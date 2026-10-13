import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Card,
  Dropdown,
  Input,
  Label,
  Option,
  Switch,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Eye20Regular, EyeOff20Regular, Table24Regular } from "@fluentui/react-icons";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import EmptyState from "@/components/EmptyState";
import EntityGraph from "@/components/EntityGraph";
import { useFlowData } from "@/context/FlowDataContext";
import { usePersistedState } from "@/hooks/usePersistedState";
import {
  cascadeBehaviours,
  cascadeLabels,
  type CascadeBehaviour,
  type CascadeKey,
  type EntityRelationship,
} from "@/data/flows";

const setSerialize = <T,>(v: Set<T>) => JSON.stringify([...v]);
const setDeserialize = <T,>(raw: string) => new Set<T>(JSON.parse(raw) as T[]);

const RELATIONSHIP_TYPES: EntityRelationship["relationshipType"][] = ["OneToMany", "ManyToMany"];
const CASCADE_KEYS = Object.keys(cascadeLabels) as CascadeKey[];

export default function Relationships() {
  const { hasData, allRelationships, allTables } = useFlowData();

  const [search, setSearch] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [hiddenTableIds, setHiddenTableIds] = useState<Set<string>>(new Set());

  const [showSystem, setShowSystem] = usePersistedState("relationships.showSystem", false);
  const [showExternal, setShowExternal] = usePersistedState("relationships.showExternal", false);
  const [selectedTypes, setSelectedTypes] = usePersistedState<Set<string>>(
    "relationships.types",
    () => new Set(RELATIONSHIP_TYPES),
    { serialize: setSerialize, deserialize: setDeserialize<string> },
  );
  const [cascadeFilters, setCascadeFilters] = usePersistedState<Record<CascadeKey, CascadeBehaviour[]>>(
    "relationships.cascades",
    () =>
      CASCADE_KEYS.reduce(
        (acc, k) => ({ ...acc, [k]: [...cascadeBehaviours] }),
        {} as Record<CascadeKey, CascadeBehaviour[]>,
      ),
  );

  // Table ids considered "in solution" — external (lookup-only) tables are hidden by default.
  const solutionTableIds = useMemo(
    () => new Set(allTables.filter((t) => t.inSolution).map((t) => t.id)),
    [allTables],
  );

  const visibleRelationships = useMemo(
    () =>
      allRelationships.filter((r) => {
        if (!showSystem && r.isSystem) return false;
        if (
          !showExternal &&
          (!solutionTableIds.has(r.referencingTable) || !solutionTableIds.has(r.referencedTable))
        )
          return false;
        if (!selectedTypes.has(r.relationshipType)) return false;
        if (hiddenTableIds.has(r.referencingTable) || hiddenTableIds.has(r.referencedTable)) return false;
        return CASCADE_KEYS.every((k) => (cascadeFilters[k] ?? cascadeBehaviours).includes(r[k]));
      }),
    [allRelationships, showSystem, showExternal, solutionTableIds, selectedTypes, cascadeFilters, hiddenTableIds],
  );

  const visibleTableIds = useMemo(() => {
    const ids = new Set<string>();
    visibleRelationships.forEach((r) => {
      ids.add(r.referencingTable);
      ids.add(r.referencedTable);
    });
    return ids;
  }, [visibleRelationships]);

  const visibleTables = useMemo(
    () => allTables.filter((t) => visibleTableIds.has(t.id)),
    [allTables, visibleTableIds],
  );

  // Tables offered in the list: everything appearing in a relationship, respecting the
  // system and external toggles.
  const listTables = useMemo(() => {
    const inScope = new Set<string>();
    allRelationships.forEach((r) => {
      if (!showSystem && r.isSystem) return;
      if (!showExternal && (!solutionTableIds.has(r.referencingTable) || !solutionTableIds.has(r.referencedTable)))
        return;
      inScope.add(r.referencingTable);
      inScope.add(r.referencedTable);
    });
    const q = search.trim().toLowerCase();
    return allTables
      .filter((t) => inScope.has(t.id))
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.inSolution) - Number(a.inSolution) || a.name.localeCompare(b.name));
  }, [allTables, allRelationships, showSystem, showExternal, solutionTableIds, search]);

  const toggleTable = (id: string) =>
    setHiddenTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!hasData || allRelationships.length === 0) {
    return (
      <EmptyState
        icon={<Table24Regular />}
        title="No table relationships"
        description="Import a solution containing tables to visualise relationships between them."
      />
    );
  }

  return (
    <div className="flex flex-col flex-1" style={{ overflow: "hidden" }}>
      <Card style={{ margin: "8px 16px 16px 16px", padding: 0, height: "calc(100% - 16px)" }}>
        <ResizablePanelGroup direction="horizontal" style={{ flex: 1, overflow: "hidden" }}>
          <ResizablePanel
            defaultSize={30}
            minSize={15}
            maxSize={60}
            style={{
              borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                backgroundColor: tokens.colorNeutralBackground2,
                flexShrink: 0,
              }}
            >
              <Accordion collapsible defaultOpenItems="filters">
                <AccordionItem value="filters">
                  <AccordionHeader>Filters</AccordionHeader>
                  <AccordionPanel>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <Label size="small">Relationship types</Label>
                        <Dropdown
                          multiselect
                          size="small"
                          placeholder="All types"
                          selectedOptions={[...selectedTypes]}
                          value={selectedTypes.size === RELATIONSHIP_TYPES.length ? "All" : [...selectedTypes].join(", ")}
                          onOptionSelect={(_, d) => setSelectedTypes(new Set(d.selectedOptions))}
                        >
                          {RELATIONSHIP_TYPES.map((t) => (
                            <Option key={t} value={t} text={t}>
                              {t === "OneToMany" ? "One-to-Many" : "Many-to-Many"}
                            </Option>
                          ))}
                        </Dropdown>
                      </div>

                      {CASCADE_KEYS.map((k) => {
                        const selected = cascadeFilters[k] ?? cascadeBehaviours;
                        return (
                          <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <Label size="small">Cascade {cascadeLabels[k]}</Label>
                            <Dropdown
                              multiselect
                              size="small"
                              placeholder="Any"
                              selectedOptions={selected}
                              value={selected.length === cascadeBehaviours.length ? "Any" : selected.join(", ")}
                              onOptionSelect={(_, d) =>
                                setCascadeFilters((prev) => ({
                                  ...prev,
                                  [k]: d.selectedOptions as CascadeBehaviour[],
                                }))
                              }
                            >
                              {cascadeBehaviours.map((b) => (
                                <Option key={b} value={b} text={b}>
                                  {b}
                                </Option>
                              ))}
                            </Dropdown>
                          </div>
                        );
                      })}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Text size={200}>Show system relationships</Text>
                        <Switch checked={showSystem} onChange={(_, d) => setShowSystem(d.checked)} />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Text size={200}>Show external tables</Text>
                        <Switch checked={showExternal} onChange={(_, d) => setShowExternal(d.checked)} />
                      </div>

                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Eye20Regular />}
                        onClick={() => setHiddenTableIds(new Set())}
                        disabled={hiddenTableIds.size === 0}
                      >
                        Show all tables ({hiddenTableIds.size} hidden)
                      </Button>
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </div>

            <div style={{ padding: 8, flexShrink: 0 }}>
              <Input
                size="small"
                placeholder="Search tables…"
                value={search}
                onChange={(_, d) => setSearch(d.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "0 8px 8px" }}>
              {listTables.map((t) => {
                const hidden = hiddenTableIds.has(t.id);
                const isSelected = t.id === selectedTableId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTableId(isSelected ? null : t.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "4px 6px",
                      borderRadius: 4,
                      cursor: "pointer",
                      backgroundColor: isSelected ? tokens.colorNeutralBackground1Selected : undefined,
                      opacity: hidden ? 0.5 : 1,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Text size={200} truncate block wrap={false}>
                        {t.name}
                      </Text>
                      <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                        {t.inSolution ? "In solution" : "External"}
                        {t.isSystem ? " · System" : ""}
                      </Text>
                    </div>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={hidden ? <EyeOff20Regular /> : <Eye20Regular />}
                      aria-label={hidden ? `Show ${t.name}` : `Hide ${t.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTable(t.id);
                      }}
                    />
                  </div>
                );
              })}
              {listTables.length === 0 && (
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  No tables match the current filters.
                </Text>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={70} minSize={30} style={{ position: "relative" }}>
            <EntityGraph
              tables={visibleTables}
              relationships={visibleRelationships}
              selectedTableId={selectedTableId}
              onSelectTable={setSelectedTableId}
              onHideTable={(id) => setHiddenTableIds((prev) => new Set(prev).add(id))}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </Card>
    </div>
  );
}
