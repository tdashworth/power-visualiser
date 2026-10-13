import JSZip from "jszip";
import { ChildFlowCall, Process, ProcessAction, TriggerType } from "@/data/flows";
import { readZipEntry } from "./zipUtils";
import { Trigger } from "@radix-ui/react-tooltip";

/**
 * Extract all cloud flows (Category 5) from the solution zip.
 * Returns the internal flow objects with parsed triggers and raw clientData.
 */
export async function parseCloudFlows(zip: JSZip, customizationsDoc: Document): Promise<Process[]> {
  const workflows: Process[] = [];
  const workflowElements = customizationsDoc.querySelectorAll("Workflows > Workflow");

  for (const el of workflowElements) {
    const categoryEl = el.querySelector("Category");
    if (!categoryEl || categoryEl.textContent !== "5") continue;

    const jsonFileNameEl = el.querySelector("JsonFileName");
    if (!jsonFileNameEl?.textContent) continue;

    const jsonPath = jsonFileNameEl.textContent.startsWith("/")
      ? jsonFileNameEl.textContent.substring(1)
      : jsonFileNameEl.textContent;

    let clientData: string;
    try {
      clientData = await readZipEntry(zip, jsonPath);
    } catch {
      console.warn(`Could not read ${jsonPath} from zip`);
      continue;
    }

    const id = (el.getAttribute("WorkflowId") ?? "").replace(/[{}]/g, "");
    const name = el.getAttribute("Name") ?? "Unknown";
    const stateCode = el.querySelector("StateCode")?.textContent?.trim();
    const isActive = stateCode !== "0";

    const parsedClientData = JSON.parse(clientData);

    const { actions, childCalls } = parseCloudFlowActions(id, parsedClientData);
    const trigger = calculateTrigger(parsedClientData);

    workflows.push({
      id,
      name,
      processType: "cloud-flow",
      triggerTypes: trigger?.triggers,
      triggerTable: trigger?.entityName,
      dataFilter: trigger?.dataFilter,
      updateColumns: trigger?.onUpdateColumns,
      executionMode: trigger?.executionMode,
      isActive,
      actions,
      childCalls,
    });
  }

  return workflows;
}

/**
 * Parse all Dataverse actions and child flow calls from a cloud flow's clientData.
 */
export function parseCloudFlowActions(
  id: string,
  clientData: any,
): {
  actions: ProcessAction[];
  childCalls: ChildFlowCall[];
} {
  const actions: ProcessAction[] = [];
  const childCalls: ChildFlowCall[] = [];

  try {
    const actionsObj = clientData?.properties?.definition?.actions;
    if (!actionsObj) return { actions, childCalls };

    walkActions(actionsObj, [], id, actions, childCalls);
  } catch (e) {
    console.warn(`Flow "${id}" action parsing failed:`, e);
  }

  return { actions, childCalls };
}

// ── Action tree walking ─────────────────────────────────────────────────────

function walkActions(
  actionsObj: Record<string, any>,
  parentPath: string[],
  flowId: string,
  actions: ProcessAction[],
  childCalls: ChildFlowCall[],
) {
  for (const [name, value] of Object.entries(actionsObj)) {
    const cleanName = name.replace(/_/g, " ");
    const currentPath = [...parentPath, cleanName];

    try {
      const type = value?.type;

      switch (type) {
        case "Scope":
        case "Foreach":
        case "Until":
          if (value.actions) {
            walkActions(value.actions, currentPath, flowId, actions, childCalls);
          }
          break;

        case "If":
          if (value.actions) {
            walkActions(value.actions, currentPath, flowId, actions, childCalls);
          }
          if (value.else?.actions) {
            walkActions(value.else.actions, [...parentPath, `${cleanName} (else)`], flowId, actions, childCalls);
          }
          break;

        case "Switch":
          if (value.default?.actions) {
            walkActions(value.default.actions, [...parentPath, `${cleanName} (default)`], flowId, actions, childCalls);
          }
          if (value.cases) {
            for (const [caseName, caseVal] of Object.entries(value.cases) as [string, any][]) {
              if (caseVal.actions) {
                walkActions(
                  caseVal.actions,
                  [...parentPath, `${cleanName} (${caseName.replace(/_/g, " ")})`],
                  flowId,
                  actions,
                  childCalls,
                );
              }
            }
          }
          break;

        case "Workflow": {
          const workflowId = value?.inputs?.host?.workflowReferenceName;
          if (workflowId) {
            childCalls.push({
              flowId: flowId,
              actionName: cleanName,
              targetFlowId: workflowId,
            });
          }
          break;
        }

        case "OpenApiConnection": {
          const connApiId = value?.inputs?.host?.apiId;
          if (connApiId !== "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps") break;

          const operationId = value?.inputs?.host?.operationId;
          const isCrud =
            operationId === "CreateRecord" ||
            operationId === "UpdateRecord" ||
            operationId === "UpdateOnlyRecord" ||
            operationId === "DeleteRecord";
          const isCustomApi =
            operationId === "PerformUnboundAction" ||
            operationId === "PerformBoundAction";
          if (!isCrud && !isCustomApi) break;

          const rawEntity = value?.inputs?.parameters?.entityName ?? "";
          const entityName = String(rawEntity).trim().toLowerCase();
          const customActionName = isCustomApi
            ? String(value?.inputs?.parameters?.actionName ?? "").trim().toLowerCase() || undefined
            : undefined;

          const propertyNames: string[] = [];
          const properties: Record<string, unknown> = {};

          if (value?.inputs?.parameters) {
            for (const [key, val] of Object.entries(value.inputs.parameters)) {
              if (key === "entityName") continue;
              if (key === "recordId") continue;
              if (isCustomApi && key === "actionName") continue;
              const cleanProp = key.replace("item/", "").replace("@odata.bind", "").trim().toLowerCase();
              propertyNames.push(cleanProp);
              properties[cleanProp] = val;
            }
          }

          actions.push({
            flowId,
            actionName: cleanName,
            path: currentPath,
            operationType: operationId as ProcessAction["operationType"],
            entityName,
            properties: propertyNames,
            propertyValues: { ...properties },
            customActionName,
          });
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.warn(`Action "${name}" in flow "${flowId}" failed:`, e);
    }
  }
}

// ── Trigger helpers ─────────────────────────────────────────────────────────

export function calculateTrigger(clientData: any): Trigger {
  if (!clientData?.properties?.definition?.triggers)
    return {
      triggers: ["other" as const],
      executionMode: "sync" as const,
    };

  const firstTrigger = Object.values(clientData?.properties?.definition?.triggers)[0] as any;

  if (firstTrigger?.type === "Recurrence")
    return {
      triggers: ["scheduled" as const],
      executionMode: "sync" as const,
    };

  if (firstTrigger?.type === "Request" && firstTrigger?.kind === "Button")
    return {
      triggers: ["child-flow" as const],
      executionMode: "sync" as const,
    };

  if (firstTrigger?.type === "Request" && firstTrigger?.kind === "ApiConnection")
    return {
      triggers: ["on-demand" as const],
      executionMode: "sync" as const,
    };

  const apiId = firstTrigger?.inputs?.host?.apiId;
  if (apiId !== "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps")
    return {
      triggers: ["other" as const],
      executionMode: "sync" as const,
    };

  const message = firstTrigger?.inputs?.parameters?.["subscriptionRequest/message"];

  const filteringAttrs: string = firstTrigger?.inputs?.parameters?.["subscriptionRequest/filteringattributes"] ?? "";

  const triggers = [] as TriggerType[];
  if (message === 1 || message === 4) triggers.push("dataverse-create" as const);
  if (message === 3 || message === 4) triggers.push("dataverse-update" as const);
  if (triggers.length === 0) triggers.push("other" as const);

  return {
    triggers: triggers,
    executionMode: "async",
    entityName: (firstTrigger?.inputs?.parameters?.["subscriptionRequest/entityname"] ?? "").trim().toLowerCase(),
    onUpdateColumns: filteringAttrs
      .split(",")
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => s !== ""),
    dataFilter: firstTrigger?.inputs?.parameters?.["subscriptionRequest/filterexpression"] ?? "",
  };
}


interface Trigger {
  triggers: TriggerType[];
  executionMode: "async" | "sync";
  entityName?: string;
  onUpdateColumns?: string[];
  dataFilter?: string;
}
