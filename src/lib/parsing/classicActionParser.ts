import JSZip from "jszip";
import { Process, TriggerType } from "@/data/flows";
import { readZipEntry } from "./zipUtils";
import { parseClassicWorkflowXaml } from "./classicWorkflowXamlParser";

/**
 * Extract classic actions (Category 3) from customizations.xml.
 * For each, also load the associated XAML file from the zip
 * and extract Create/Update/Delete entity activities with the properties they set.
 *
 * Classic actions are custom workflow activities that can be invoked
 * via `PerformUnboundAction` / `PerformBoundAction` — the workflow's `Name`
 * attribute is the message name used by callers.
 */
export async function parseClassicActions(
  zip: JSZip,
  customizationsDoc: Document,
  solutionDoc: Document,
): Promise<Process[]> {
  const actions: Process[] = [];

  const publisherPrefix = solutionDoc.querySelector("SolutionManifest > Publisher > CustomizationPrefix")?.textContent;

  const workflowElements = customizationsDoc.querySelectorAll("Workflows > Workflow");

  for (const el of workflowElements) {
    const category = el.querySelector("Category")?.textContent ?? "";
    if (category !== "3") continue;

    const name = el.getAttribute("Name") ?? "Unknown";
    const id = (el.getAttribute("WorkflowId") ?? "").replace(/[{}]/g, "");

    const primaryEntity = (el.querySelector("PrimaryEntity")?.textContent ?? "").trim().toLowerCase();

    const triggerTypes: TriggerType[] = ["custom-message"];

    
    const uniqueName = el.querySelector("UniqueName")?.textContent?.trim();

    const stateCode = el.querySelector("StateCode")?.textContent?.trim();
    const isActive = stateCode !== "0";

    // Locate and parse the XAML body (if present) for record actions.
    const xamlFileName = el.querySelector("XamlFileName")?.textContent ?? "";
    let actionList: Process["actions"] = [];
    if (xamlFileName) {
      const xamlPath = xamlFileName.startsWith("/") ? xamlFileName.substring(1) : xamlFileName;
      try {
        const xamlText = await readZipEntry(zip, xamlPath);
        actionList = parseClassicWorkflowXaml(id, xamlText);
      } catch {
        console.warn(`Could not read XAML ${xamlPath} for action ${name}`);
      }
    }

    actions.push({
      id,
      name,
      processType: "classic-workflow",
      triggerTypes,
      triggerTable: primaryEntity || undefined,
      updateColumns: undefined,
      executionMode: "sync",
      isActive,
      actions: actionList,
      // TODO: this will be wrong if the action is created with a different publisher prefix than the solution's publisher
      uniqueName: `${primaryEntity ? "Microsoft.Dynamics.CRM." : ""}${publisherPrefix}_${uniqueName}`,
    });
  }

  return actions;
}
