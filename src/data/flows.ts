export type TriggerType = "dataverse-create" | "dataverse-update" | "dataverse-delete" | "child-flow" | "on-demand" | "scheduled" | "custom-message" | "other";

export type ProcessType = "cloud-flow" | "classic-workflow" | "custom-api" | "plugin-step";

export interface Process {
  id: string;
  name: string;
  processType: ProcessType;
  triggerTypes: TriggerType[];
  /** For custom APIs: the unique (logical) name used by callers in actionName params. */
  uniqueName?: string;
  triggerTable?: string;
  updateColumns?: string[];
  dataFilter?: string;
  executionMode?: "sync" | "async";
  isActive?: boolean;
  /** For plugin steps: 10=PreValidation, 20=PreOperation, 40=PostOperation. */
  pluginStage?: number;
  /** Unique names of solutions this process was found in. May be null/undefined for legacy cached data. */
  solutions?: string[];
  actions?: ProcessAction[];
  childCalls?: ChildFlowCall[];
}

export interface ProcessAction {
  flowId: string;
  actionName: string;
  path: string[];
  operationType:
    | "CreateRecord"
    | "UpdateRecord"
    | "UpdateOnlyRecord"
    | "DeleteRecord"
    | "PerformUnboundAction"
    | "PerformBoundAction";
  entityName: string;
  properties: string[];
  propertyValues: Record<string, unknown>;
  /** For PerformUnboundAction/PerformBoundAction: the custom API unique name being invoked. */
  customActionName?: string;
}

export interface ChildFlowCall {
  flowId: string;
  actionName: string;
  targetFlowId: string;
}

export interface ProcessEdge {
  source: string;
  target: string;
  actionName: string;
  type: "calls" | "triggers";
  targetExecutionMode?: "sync" | "async";
  isOptimistic?: boolean;
}

export const triggerMeta: Record<TriggerType, { color: string; label: string; icon: string }> = {
  "dataverse-create": { color: "hsl(142, 71%, 45%)", label: "Dataverse Create", icon: "plus-circle" },
  "dataverse-update": { color: "hsl(38, 92%, 50%)", label: "Dataverse Update", icon: "pencil" },
  "dataverse-delete": { color: "hsl(0, 72%, 51%)", label: "Dataverse Delete", icon: "trash-2" },
  "child-flow":       { color: "hsl(217, 91%, 60%)", label: "Child Flow", icon: "git-branch" },
  "on-demand":        { color: "hsl(217, 91%, 60%)", label: "On-Demand", icon: "mouse-pointer-click" },
  "scheduled":        { color: "hsl(270, 60%, 55%)", label: "Scheduled", icon: "clock" },
  "custom-message":   { color: "hsl(210, 90%, 45%)", label: "Custom Message", icon: "plug" },
  "other":            { color: "hsl(0, 0%, 50%)", label: "Other", icon: "help-circle" },
};

export const processTypeMeta: Record<ProcessType, { label: string; shape: "circle" | "square" | "diamond" | "hexagon" }> = {
  "cloud-flow":        { label: "Cloud Flow", shape: "circle" },
  "classic-workflow":  { label: "Classic Workflow", shape: "square" },
  "custom-api":        { label: "Custom API", shape: "diamond" },
  "plugin-step":       { label: "Plugin Step", shape: "hexagon" },
};


export interface FlowTrigger {
  entityName: string;
  onCreate: boolean;
  onUpdate: boolean;
  onDelete: boolean;
  onUpdateColumns: string[];
  dataFilter: string;
  executionMode: "sync" | "async";
}

// ── Table / entity relationships ────────────────────────────────────────────

export type CascadeBehaviour =
  | "NoCascade"
  | "Cascade"
  | "Active"
  | "UserOwned"
  | "RemoveLink"
  | "Restrict";

export const cascadeBehaviours: CascadeBehaviour[] = [
  "NoCascade",
  "Cascade",
  "Active",
  "UserOwned",
  "RemoveLink",
  "Restrict",
];

export type CascadeKey =
  | "cascadeAssign"
  | "cascadeDelete"
  | "cascadeReparent"
  | "cascadeShare"
  | "cascadeUnshare";

export const cascadeLabels: Record<CascadeKey, string> = {
  cascadeAssign: "Assign",
  cascadeDelete: "Delete",
  cascadeReparent: "Reparent",
  cascadeShare: "Share",
  cascadeUnshare: "Unshare",
};

export interface EntityTable {
  /** Lower-cased logical name. */
  id: string;
  /** Display name as found in the customizations file. */
  name: string;
  /** True when the table itself is defined in an imported solution. */
  inSolution: boolean;
  /** True for Dataverse system/ownership tables (SystemUser, Team, ...). */
  isSystem: boolean;
}

export interface EntityRelationship {
  name: string;
  relationshipType: "OneToMany" | "ManyToMany";
  /** Lower-cased logical names. */
  referencingTable: string;
  referencedTable: string;
  referencingTableName: string;
  referencedTableName: string;
  referencingAttribute?: string;
  isHierarchical: boolean;
  cascadeAssign: CascadeBehaviour;
  cascadeDelete: CascadeBehaviour;
  cascadeReparent: CascadeBehaviour;
  cascadeShare: CascadeBehaviour;
  cascadeUnshare: CascadeBehaviour;
  description?: string;
  /** True for ownership/audit relationships (SystemUser, Team, BusinessUnit, Owner). */
  isSystem: boolean;
}
