import { ProcessAction } from "@/data/flows";

/**
 * Parse a classic workflow XAML body and extract Create/Update/Delete entity
 * activities along with the attributes set immediately before them via
 * SetEntityProperty.
 *
 * Strategy: walk the DOM in document order. Maintain a per-entity-reference
 * accumulator of pending SetEntityProperty attribute names. When a
 * CreateEntity/UpdateEntity/DeleteEntity activity is encountered, flush the
 * accumulator for that Entity reference into a ProcessAction.
 */
export function parseClassicWorkflowXaml(flowId: string, xamlText: string): ProcessAction[] {
  const actions: ProcessAction[] = [];

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xamlText, "text/xml");
  } catch {
    return actions;
  }
  if (!doc?.documentElement) return actions;

  // pending[entityRef] = { entityName, properties: [] }
  const pending = new Map<string, { entityName: string; properties: string[] }>();

  const walk = (node: Element) => {
    const tag = node.localName;

    if (tag === "SetEntityProperty") {
      const entityRef = node.getAttribute("Entity") ?? "";
      const entityName = (node.getAttribute("EntityName") ?? "").toLowerCase();
      const attribute = (node.getAttribute("Attribute") ?? "").toLowerCase();
      if (entityRef && attribute) {
        const slot = pending.get(entityRef) ?? { entityName, properties: [] };
        if (!slot.properties.includes(attribute)) slot.properties.push(attribute);
        if (!slot.entityName && entityName) slot.entityName = entityName;
        pending.set(entityRef, slot);
      }
    } else if (tag === "CreateEntity" || tag === "UpdateEntity" || tag === "DeleteEntity") {
      const entityRef = node.getAttribute("Entity") ?? "";
      const entityName = (node.getAttribute("EntityName") ?? "").toLowerCase();
      const actionName = node.getAttribute("DisplayName") ?? tag;
      const slot = pending.get(entityRef);
      const properties = slot?.properties ?? [];
      const resolvedEntity = entityName || slot?.entityName || "";

      const operationType =
        tag === "CreateEntity"
          ? "CreateRecord"
          : tag === "UpdateEntity"
          ? "UpdateRecord"
          : "DeleteRecord";

      actions.push({
        flowId,
        actionName,
        path: [],
        operationType,
        entityName: resolvedEntity,
        properties,
        propertyValues: {},
      });

      // Reset accumulator for this entity reference so subsequent activities
      // don't inherit attributes from the previous one.
      pending.delete(entityRef);
    } else if (tag === "InvokeSdkMessageActivity") {
      const entityName = (node.getAttribute("SdkMessageEntityName") ?? "").toLowerCase();
      const actionName = node.getAttribute("DisplayName") ?? tag;
      const sdkMessageName = node.getAttribute("SdkMessageName");

      actions.push({
        flowId,
        actionName,
        path: [],
        operationType: entityName ? "PerformBoundAction" : "PerformUnboundAction",
        entityName: entityName,
        // TODO: propertyValues should be populated with the parameters passed to the custom API, but this is not currently implemented.
        properties: [],
        propertyValues: {},
        customActionName: (entityName ? "Microsoft.Dynamics.CRM." : "") + sdkMessageName,
      });
    }

    // Recurse into children (Element children only).
    for (let i = 0; i < node.children.length; i++) {
      walk(node.children[i] as Element);
    }
  };

  walk(doc.documentElement);
  return actions;
}
