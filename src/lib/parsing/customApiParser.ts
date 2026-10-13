import { Process } from "@/data/flows";
import JSZip from "jszip";

/**
 * Parse all Dataverse Custom APIs from a solution's customizations.xml.
 *
 * Custom APIs are exported under <ImportExportXml><CustomApis><CustomApi> ... </CustomApi></CustomApis>.
 * They represent server-side, synchronously-executed Dataverse operations that flows / workflows
 * can invoke through `PerformUnboundAction` / `PerformBoundAction`.
 */
export async function parseCustomApis(zip: JSZip): Promise<Process[]> {
  const apis: Process[] = [];

  const files = zip.folder("customapis")?.filter((_, file) => file.name.endsWith("/customapi.xml")) ?? [];

  for (const file of files) {
    console.log(`Found custom API file in zip: ${file.name}`);
    const fileContent = await file.async("string");
    const fileDoc = new DOMParser().parseFromString(fileContent, "text/xml");

    const uniqueName = fileDoc.querySelector("customapi")?.getAttribute("uniquename")?.trim();
    const boundEntity = fileDoc.querySelector("boundentitylogicalname")?.textContent;

    apis.push({
      id: "CustomApi-" + (uniqueName ?? "Unknown"),
      name: fileDoc.querySelector("displayname")?.getAttribute("default") ?? "Unknown",
      processType: "custom-api",
      triggerTypes: ["custom-message"],
      triggerTable: boundEntity,
      executionMode: "sync",
      isActive: true,
      actions: [],
      childCalls: [],
      uniqueName: `${boundEntity ? "Microsoft.Dynamics.CRM." : ""}${uniqueName}`,
    });
  }

  return apis;
}
