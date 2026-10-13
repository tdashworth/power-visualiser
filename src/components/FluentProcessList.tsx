import React, { useMemo, useState, useEffect, useRef } from "react";
import Fuse, { type FuseResultMatch } from "fuse.js";
import { renderHighlighted } from "@/lib/search/highlight";
import { SearchBox, List, ListItem, Avatar, TableCellLayout, tokens, Menu, MenuTrigger, MenuPopover, MenuList, Button } from "@fluentui/react-components";
import {
  AddCircle24Regular,
  Edit24Regular,
  Delete24Regular,
  Flow24Regular,
  Cursor24Regular,
  Clock24Regular,
  QuestionCircle24Regular,
  PlugConnected24Regular,
  ChevronRight20Regular,
  ChevronDown20Regular,
  DatabaseArrowDown20Regular,
  DatabaseArrowUp20Regular,
  Delete20Regular,
  Add20Regular,
  MoreHorizontal20Regular,
} from "@fluentui/react-icons";
import { Process, ProcessAction, TriggerType, triggerMeta, processTypeMeta } from "@/data/flows";
import FlowItemMenuItems from "@/components/FlowItemMenuItems";
import FlowDetailDialog from "@/components/FlowDetailDialog";

const triggerIconMap: Record<TriggerType, React.ReactElement> = {
  "dataverse-create": <AddCircle24Regular />,
  "dataverse-update": <Edit24Regular />,
  "dataverse-delete": <Delete24Regular />,
  "child-flow": <Flow24Regular />,
  "on-demand": <Cursor24Regular />,
  scheduled: <Clock24Regular />,
  "custom-message": <PlugConnected24Regular />,
  other: <QuestionCircle24Regular />,
};

const triggerColorMap: Record<TriggerType, string> = {
  "dataverse-create": "#107C10",
  "dataverse-update": "#CA5010",
  "dataverse-delete": "#D13438",
  "child-flow": "#0078D4",
  "on-demand": "#0078D4",
  scheduled: "#8764B8",
  "custom-message": "#0F6CBD",
  other: "#8A8886",
};

const operationIconMap: Record<string, React.ReactElement> = {
  CreateRecord: <Add20Regular />,
  UpdateRecord: <DatabaseArrowUp20Regular />,
  UpdateOnlyRecord: <DatabaseArrowUp20Regular />,
  DeleteRecord: <Delete20Regular />,
  PerformUnboundAction: <PlugConnected24Regular />,
  PerformBoundAction: <PlugConnected24Regular />,
};

const operationColorMap: Record<string, string> = {
  CreateRecord: "#107C10",
  UpdateRecord: "#CA5010",
  UpdateOnlyRecord: "#CA5010",
  DeleteRecord: "#D13438",
  PerformUnboundAction: "#0F6CBD",
  PerformBoundAction: "#0F6CBD",
};

const operationLabelMap: Record<string, string> = {
  CreateRecord: "Create",
  UpdateRecord: "Update",
  UpdateOnlyRecord: "Update Only",
  DeleteRecord: "Delete",
  PerformUnboundAction: "Custom API",
  PerformBoundAction: "Custom API (bound)",
};

interface FluentProcessListProps {
  processes: Process[];
  hiddenIds?: Set<string>;
  permanentlyHiddenIds?: Set<string>;
  onToggleVisibility?: (id: string) => void;
  onShowOnlyRelated?: (id: string) => void;
  onShowOnlyDirect?: (id: string) => void;
  onTogglePermanentlyHidden?: (id: string) => void;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
  environmentId?: string | null;
}

function ActionList({ actions, matches }: { actions: ProcessAction[]; matches?: readonly FuseResultMatch[] }) {
  return (
    <List style={{ paddingLeft: 56, paddingTop: 2, paddingBottom: 4 }}>
      {actions.map((action, idx) => {
        const opLabel = operationLabelMap[action.operationType] ?? action.operationType;
        const propsText = action.properties.length > 0 ? action.properties.join(", ") : "No properties";
        const color = operationColorMap[action.operationType] ?? "#8A8886";
        const isCustomApiCall =
          action.operationType === "PerformUnboundAction" ||
          action.operationType === "PerformBoundAction";
        const description = isCustomApiCall
          ? `${opLabel} · ${action.customActionName ?? "(unknown)"}${action.entityName ? ` · ${action.entityName}` : ""}`
          : `${opLabel} · ${action.entityName} · ${propsText}`;
        const entityMatch = matches?.find((m) => m.key === "actions.entityName" && m.value === action.entityName);

        return (
          <ListItem key={`${action.actionName}-${idx}`} style={{ padding: "2px 0" }}>
            <TableCellLayout
              media={
                <Avatar
                  icon={operationIconMap[action.operationType] ?? <DatabaseArrowDown20Regular />}
                  color="brand"
                  style={{
                    backgroundColor: color,
                    color: "#fff",
                  }}
                  size={24}
                  shape="square"
                  aria-label={action.operationType}
                />
              }
              description={
                entityMatch ? (
                  <>
                    {opLabel} · {renderHighlighted(action.entityName ?? "", entityMatch.indices)}
                    {isCustomApiCall ? ` · ${action.customActionName ?? ""}` : ` · ${propsText}`}
                  </>
                ) : (
                  description
                )
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
  );
}

export default function FluentProcessList({
  processes,
  hiddenIds = new Set(),
  permanentlyHiddenIds = new Set(),
  onToggleVisibility,
  onShowOnlyRelated,
  onShowOnlyDirect,
  onTogglePermanentlyHidden,
  selectedNodeId,
  onSelectNode,
  environmentId,
}: FluentProcessListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [detailFlow, setDetailFlow] = useState<Process | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (selectedNodeId && itemRefs.current.has(selectedNodeId)) {
      itemRefs.current.get(selectedNodeId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedNodeId]);

  const sortedProcesses = useMemo(
    () =>
      [...processes].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [processes]
  );

  const fuse = useMemo(
    () =>
      new Fuse(sortedProcesses, {
        keys: [
          { name: "name", weight: 2 },
          { name: "triggerTable", weight: 1 },
          { name: "actions.entityName", weight: 1 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeMatches: true,
        minMatchCharLength: 2,
      }),
    [sortedProcesses]
  );

  const filteredResults = useMemo<{ item: Process; matches?: readonly FuseResultMatch[] }[]>(() => {
    if (!search.trim()) return sortedProcesses.map((item) => ({ item }));
    return fuse.search(search.trim()).map((r) => ({ item: r.item, matches: r.matches }));
  }, [sortedProcesses, fuse, search]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (processes.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>
        No processes to display. Import a solution first.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ padding: "8px 8px 4px" }}>
        <SearchBox
          placeholder="Search by name or entity..."
          value={search}
          onChange={(_, data) => setSearch(data.value)}
          style={{ width: "100%" }}
        />
      </div>
      <List style={{ flex: 1, overflow: "auto", padding: "4px 8px" }}>
        {filteredResults.map(({ item, matches }) => {
          const nameMatch = matches?.find((m) => m.key === "name");
          const triggerTableMatch = matches?.find((m) => m.key === "triggerTable");
          const actionMatches = matches?.filter((m) => m.key === "actions.entityName") ?? [];
          const uniqueActionMatches = actionMatches.filter(
            (m, i) => actionMatches.findIndex((o) => o.value === m.value) === i,
          );
          const primaryTrigger = item.triggerTypes[0] ?? "other";
          const triggerLabels = item.triggerTypes.map((t) => triggerMeta[t]?.label ?? t).join(", ").replace(triggerMeta["custom-message"]?.label, item.uniqueName ?? "");
          const typeLabel = processTypeMeta[item.processType]?.label ?? item.processType;
          const secondaryText = `${typeLabel} · ${triggerLabels}`;
          const hasActions = item.actions && item.actions.length > 0;
          const isExpanded = expanded.has(item.id);
          const triggerColor = triggerColorMap[primaryTrigger] ?? triggerColorMap["other"];

          return (
            <React.Fragment key={item.id}>
              <ListItem
                ref={(el: HTMLElement | null) => {
                  if (el) itemRefs.current.set(item.id, el);
                  else itemRefs.current.delete(item.id);
                }}
                onClick={() => {
                  const newId = selectedNodeId === item.id ? null : item.id;
                  onSelectNode?.(newId);
                }}
                style={{
                  cursor: "pointer",
                  padding: "6px 8px",
                  opacity: hiddenIds.has(item.id) || permanentlyHiddenIds.has(item.id) ? 0.45 : 1,
                  fontStyle: permanentlyHiddenIds.has(item.id) ? "italic" : undefined,
                  backgroundColor: selectedNodeId === item.id ? tokens.colorNeutralBackground1Selected : undefined,
                }}
              >
                <TableCellLayout
                  media={
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {hasActions ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(item.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              toggleExpand(item.id);
                            }
                          }}
                          style={{
                            display: "flex",
                            width: 16,
                            justifyContent: "center",
                            color: tokens.colorNeutralForeground3,
                            cursor: "pointer",
                          }}
                        >
                          {isExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
                        </span>
                      ) : (
                        <span style={{ width: 16 }} />
                      )}
                      <Avatar
                        icon={triggerIconMap[primaryTrigger] ?? triggerIconMap["other"]}
                        color="colorful"
                        style={{
                          backgroundColor: triggerColor,
                          color: "#fff",
                        }}
                        shape="square"
                        size={36}
                        aria-label={primaryTrigger}
                      />
                    </div>
                  }
                  description={
                    <>
                      {hasActions
                        ? `${secondaryText} · ${item.actions!.length} action${item.actions!.length !== 1 ? "s" : ""}`
                        : secondaryText}
                      {triggerTableMatch && (
                        <span style={{ display: "block" }}>
                          Trigger table: {renderHighlighted(triggerTableMatch.value ?? "", triggerTableMatch.indices)}
                        </span>
                      )}
                      {uniqueActionMatches.length > 0 && (
                        <span style={{ display: "block" }}>
                          Action table{uniqueActionMatches.length > 1 ? "s" : ""}:{" "}
                          {uniqueActionMatches.map((m, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && ", "}
                              {renderHighlighted(m.value ?? "", m.indices)}
                            </React.Fragment>
                          ))}
                        </span>
                      )}
                    </>
                  }
                  truncate
                >
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {renderHighlighted(item.name, nameMatch?.indices)}
                    </span>
                    <Menu>
                      <MenuTrigger disableButtonEnhancement>
                        <Button
                          appearance="subtle"
                          icon={<MoreHorizontal20Regular />}
                          size="small"
                          onClick={(e) => e.stopPropagation()}
                          style={{ flexShrink: 0, marginLeft: 8, minWidth: 24 }}
                          aria-label="Actions"
                        />
                      </MenuTrigger>
                      <MenuPopover>
                        <MenuList>
                          <FlowItemMenuItems
                            flow={item}
                            isHidden={hiddenIds.has(item.id)}
                            isPermanentlyHidden={permanentlyHiddenIds.has(item.id)}
                            environmentId={environmentId}
                            onToggleVisibility={onToggleVisibility}
                            onShowOnlyRelated={onShowOnlyRelated}
                            onShowOnlyDirect={onShowOnlyDirect}
                            onTogglePermanentlyHidden={onTogglePermanentlyHidden}
                            onShowDetails={(id) => {
                              const f = processes.find((p) => p.id === id) ?? null;
                              setDetailFlow(f);
                            }}
                            stopPropagation
                          />
                        </MenuList>
                      </MenuPopover>
                    </Menu>
                  </div>
                </TableCellLayout>
              </ListItem>
              {hasActions && isExpanded && <ActionList actions={item.actions!} matches={matches} />}
            </React.Fragment>
          );
        })}
      </List>
      <FlowDetailDialog
        flow={detailFlow}
        environmentId={environmentId ?? ""}
        onClose={() => setDetailFlow(null)}
        onHideFlow={onTogglePermanentlyHidden}
      />
    </div>
  );
}
