import JSZip from "jszip";
import { Process, TriggerType } from "@/data/flows";
import { readZipEntry } from "./zipUtils";
import { parseClassicWorkflowXaml } from "./classicWorkflowXamlParser";

/**
 * Extract classic workflows (Category 0) from customizations.xml.
 * For each, also load the associated XAML file from the zip
 * and extract Create/Update/Delete entity activities with the properties they set.
 */
export async function parseClassicWorkflows(
  zip: JSZip,
  customizationsDoc: Document
): Promise<Process[]> {
  const workflows: Process[] = [];
  const workflowElements = customizationsDoc.querySelectorAll("Workflows > Workflow");

  for (const el of workflowElements) {
    const category = el.querySelector("Category")?.textContent ?? "";
    if (category !== "0") continue;

    const name = el.getAttribute("Name") ?? "Unknown";
    const id = (el.getAttribute("WorkflowId") ?? "").replace(/[{}]/g, "");

    const primaryEntity = (el.querySelector("PrimaryEntity")?.textContent ?? "").trim().toLowerCase();

    const triggerTypes: TriggerType[] = [];

    if (el.querySelector("OnDemand")?.textContent === "1") {
      triggerTypes.push("on-demand");
    }
    if (el.querySelector("TriggerOnCreate")?.textContent === "1") {
      triggerTypes.push("dataverse-create");
    }
    if (el.querySelector("TriggerOnDelete")?.textContent === "1") {
      triggerTypes.push("dataverse-delete");
    }
    const updateAttrList = el.querySelector("TriggerOnUpdateAttributeList")?.textContent ?? "";
    if (updateAttrList.trim().length > 0) {
      triggerTypes.push("dataverse-update");
    }
    if (triggerTypes.length === 0) {
      triggerTypes.push("other");
    }

    const onUpdateColumns = updateAttrList
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s !== "");

    const modeEl = el.querySelector("Mode");
    const executionMode: "sync" | "async" = modeEl?.textContent === "1" ? "sync" : "async";

    const stateCode = el.querySelector("StateCode")?.textContent?.trim();
    const isActive = stateCode !== "0";

    // Locate and parse the XAML body (if present) for record actions.
    const xamlFileName = el.querySelector("XamlFileName")?.textContent ?? "";
    let actions: Process["actions"] = [];
    if (xamlFileName) {
      const xamlPath = xamlFileName.startsWith("/") ? xamlFileName.substring(1) : xamlFileName;
      try {
        const xamlText = await readZipEntry(zip, xamlPath);
        actions = parseClassicWorkflowXaml(id, xamlText);
      } catch {
        console.warn(`Could not read XAML ${xamlPath} for workflow ${name}`);
      }
    }

    workflows.push({
      id,
      name,
      processType: "classic-workflow",
      triggerTypes,
      triggerTable: primaryEntity || undefined,
      updateColumns: onUpdateColumns,
      executionMode,
      isActive,
      actions,
      uniqueName: undefined,
    });
  }

  return workflows;
}
