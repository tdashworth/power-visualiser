import { ChildFlowCall, Process, ProcessAction, ProcessEdge } from "@/data/flows";
import { canDataSatisfyFilter } from "@/lib/filterValidator";

/**
 * Given the full set of deduplicated flows, collected actions, and child flow calls,
 * resolve all edges (both direct child-flow calls and trigger-based connections).
 */
export function resolveEdges(
  flowMap: Map<string, Process>,
  actions: ProcessAction[],
  childCalls: ChildFlowCall[]
): ProcessEdge[] {
  const edges: ProcessEdge[] = [];

  // 1. Direct child flow calls
  for (const call of childCalls) {
    const target = flowMap.get(call.targetFlowId);
    if (target) {
      edges.push({
        source: call.flowId,
        target: call.targetFlowId,
        actionName: call.actionName,
        type: "calls",
        targetExecutionMode: target.executionMode,
      });
    }
  }

  // 2. Trigger-based edges: a Dataverse action in one flow may trigger another
  for (const action of actions) {
    if (
      action.operationType === "PerformUnboundAction" ||
      action.operationType === "PerformBoundAction"
    ) {
      continue;
    }
    for (const candidate of flowMap.values()) {
      if (!candidate.triggerTable) continue;
      if (!action.entityName.startsWith(candidate.triggerTable)) continue;

      const isCreateMatch = action.operationType === "CreateRecord" && candidate.triggerTypes.includes("dataverse-create");
      const isUpdateMatch =
        (action.operationType === "UpdateRecord" || action.operationType === "UpdateOnlyRecord") &&
        candidate.triggerTypes.includes("dataverse-update");
      const isDeleteMatch = action.operationType === "DeleteRecord" && candidate.triggerTypes.includes("dataverse-delete");
      if (!isCreateMatch && !isUpdateMatch && !isDeleteMatch) continue;

      if (
        (candidate.updateColumns?.length ?? 0) > 0 &&
        !candidate.updateColumns!.some((col) => action.properties.includes(col))
      ) {
        continue;
      }

      const filterResult = canDataSatisfyFilter(candidate.dataFilter, action.propertyValues);
      if (!filterResult.result) continue;

      edges.push({
        source: action.flowId,
        target: candidate.id,
        actionName: action.actionName,
        type: "triggers",
        targetExecutionMode: candidate.executionMode,
        isOptimistic: filterResult.isOptimistic,
      });
    }
  }

  // 3. Custom API / Classic Action invocation edges (synchronous calls)
  const targetByUniqueName = new Map<string, Process>();
  for (const proc of flowMap.values()) {
    if (
      (proc.processType === "custom-api" || proc.triggerTypes.includes("custom-message")) &&
      proc.uniqueName
    ) {
      targetByUniqueName.set(proc.uniqueName.toLowerCase(), proc);
    }
  }
  for (const action of actions) {
    if (
      action.operationType !== "PerformUnboundAction" &&
      action.operationType !== "PerformBoundAction"
    ) {
      continue;
    }
    const key = action.customActionName?.toLowerCase();
    if (!key) continue;
    const target = targetByUniqueName.get(key);
    if (!target) continue;
    edges.push({
      source: action.flowId,
      target: target.id,
      actionName: action.actionName,
      type: "calls",
      targetExecutionMode: "sync",
      isOptimistic: false,
    });
  }

  return deduplicateEdges(edges);
}

function deduplicateEdges(edges: ProcessEdge[]): ProcessEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.source}|${e.target}|${e.actionName}|${e.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
