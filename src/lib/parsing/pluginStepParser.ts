import { Process, TriggerType } from "@/data/flows";

/**
 * Parse Dataverse Plugin Steps (SdkMessageProcessingStep) from customizations.xml.
 *
 * Each step is exported as a leaf process with a hexagon shape. Outgoing edges are
 * not introspectable (compiled assembly); incoming edges are resolved via the
 * existing `targetByUniqueName` lookup when `triggerTypes` includes `custom-message`.
 */

// Built-in SdkMessage GUIDs → message name. Lower-case, no braces.
const SDK_MESSAGE_BY_ID: Record<string, string> = {
  "9ebdbb1b-ea3e-db11-86a7-000a3a5473e8": "Create",
  "20bebb1b-ea3e-db11-86a7-000a3a5473e8": "Update",
  "a1bdbb1b-ea3e-db11-86a7-000a3a5473e8": "Delete",
  "16e7c888-3b24-448b-b7da-ebfe9b681762": "Associate",
  "bdfc191d-fc56-493a-a6b1-cb0c47a22ecc": "Disassociate",
};

const stripBraces = (s: string) => s.replace(/[{}]/g, "").trim().toLowerCase();

function resolveMessageName(stepEl: Element): string | undefined {
  const named = stepEl.querySelector("SdkMessageName")?.textContent?.trim();
  if (named) return named;
  const idRaw = stepEl.querySelector("SdkMessageId")?.textContent;
  if (!idRaw) return undefined;
  const id = stripBraces(idRaw);
  return SDK_MESSAGE_BY_ID[id] ?? `SdkMessage ${id.slice(0, 8)}`;
}

export function messageToTrigger(messageName: string): TriggerType[] {
  switch (messageName) {
    case "Create":
      return ["dataverse-create"];
    case "Update":
      return ["dataverse-update"];
    case "Delete":
      return ["dataverse-delete"];
    default:
      return ["custom-message"];
  }
}

export function parsePluginSteps(customizationsDoc: Document): Process[] {
  const steps: Process[] = [];
  const stepEls = customizationsDoc.querySelectorAll("SdkMessageProcessingSteps > SdkMessageProcessingStep");

  stepEls.forEach((stepEl) => {
    const idAttr = stepEl.getAttribute("SdkMessageProcessingStepId");
    if (!idAttr) return;
    const id = "PluginStep-" + stripBraces(idAttr);

    const messageName = resolveMessageName(stepEl);
    if (!messageName) return;

    const name = stepEl.getAttribute("Name") ?? stepEl.querySelector("Description")?.textContent?.trim() ?? messageName;

    const triggerTypes = messageToTrigger(messageName);

    const modeText = stepEl.querySelector("Mode")?.textContent?.trim();
    const executionMode: "sync" | "async" = modeText === "1" ? "async" : "sync";

    const stateCodeText = stepEl.querySelector("StateCode")?.textContent?.trim();
    const isActive = stateCodeText ? stateCodeText === "0" : true;

    const stageText = stepEl.querySelector("Stage")?.textContent?.trim();
    const pluginStage = stageText ? Number(stageText) : undefined;

    const filtering = stepEl.querySelector("FilteringAttributes")?.textContent?.trim();
    const updateColumns =
      messageName === "Update" && filtering
        ? filtering
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const triggerTable = stepEl.querySelector("PrimaryEntity")?.textContent?.trim() || undefined;

    steps.push({
      id,
      name,
      processType: "plugin-step",
      triggerTypes,
      triggerTable,
      updateColumns,
      executionMode,
      isActive,
      pluginStage,
      uniqueName: triggerTypes[0] === "custom-message" ? messageName : undefined,
      actions: [],
      childCalls: [],
    });
  });

  return steps;
}
