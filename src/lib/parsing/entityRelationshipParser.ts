import type { EntityRelationship, EntityTable, CascadeBehaviour } from "@/data/flows";

/** Logical names of Dataverse system/ownership tables. */
export const SYSTEM_TABLES = new Set([
  "systemuser",
  "team",
  "businessunit",
  "owner",
  "organization",
  "principal",
]);

/** Referencing attributes that indicate an audit/ownership lookup. */
const SYSTEM_ATTRIBUTES = new Set([
  "createdby",
  "modifiedby",
  "createdonbehalfby",
  "modifiedonbehalfby",
  "owninguser",
  "owningteam",
  "owningbusinessunit",
  "ownerid",
  "organizationid",
]);

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function text(el: Element, tag: string): string {
  return el.querySelector(`:scope > ${tag}`)?.textContent?.trim() ?? "";
}

function cascade(el: Element, tag: string): CascadeBehaviour {
  const v = text(el, tag);
  return (v || "NoCascade") as CascadeBehaviour;
}

export interface EntityRelationshipParseResult {
  relationships: EntityRelationship[];
  tables: EntityTable[];
}

/**
 * Parse <EntityRelationships> and <Entities> from a solution's customizations.xml.
 *
 * Tables are keyed by lower-cased logical name; the display name keeps the first
 * casing encountered so `SystemUser` reads nicely in the UI.
 */
export function parseEntityRelationships(customizationsDoc: Document): EntityRelationshipParseResult {
  const relationships: EntityRelationship[] = [];
  const tableMap = new Map<string, EntityTable>();

  const upsertTable = (rawName: string, inSolution: boolean) => {
    const id = norm(rawName);
    if (!id) return;
    const existing = tableMap.get(id);
    if (existing) {
      if (inSolution) existing.inSolution = true;
      return;
    }
    tableMap.set(id, {
      id,
      name: rawName.trim(),
      inSolution,
      isSystem: SYSTEM_TABLES.has(id),
    });
  };

  // Tables shipped in the solution
  customizationsDoc.querySelectorAll("Entities > Entity").forEach((entityEl) => {
    const name = entityEl.querySelector(":scope > Name")?.textContent?.trim();
    if (name) upsertTable(name, true);
  });

  customizationsDoc
    .querySelectorAll("EntityRelationships > EntityRelationship")
    .forEach((relEl) => {
      const name = relEl.getAttribute("Name")?.trim();
      if (!name) return;

      const referencing = text(relEl, "ReferencingEntityName");
      const referenced = text(relEl, "ReferencedEntityName");

      // Many-to-many relationships use a different element shape
      const firstEntity = text(relEl, "FirstEntityName");
      const secondEntity = text(relEl, "SecondEntityName");

      const source = referencing || firstEntity;
      const target = referenced || secondEntity;
      if (!source || !target) return;

      const typeText = text(relEl, "EntityRelationshipType");
      const relationshipType: EntityRelationship["relationshipType"] =
        typeText.toLowerCase() === "manytomany" ? "ManyToMany" : "OneToMany";

      const referencingAttribute = text(relEl, "ReferencingAttributeName") || undefined;

      const rel: EntityRelationship = {
        name,
        relationshipType,
        referencingTable: norm(source),
        referencedTable: norm(target),
        referencingTableName: source.trim(),
        referencedTableName: target.trim(),
        referencingAttribute,
        isHierarchical: text(relEl, "IsHierarchical") === "1",
        cascadeAssign: cascade(relEl, "CascadeAssign"),
        cascadeDelete: cascade(relEl, "CascadeDelete"),
        cascadeReparent: cascade(relEl, "CascadeReparent"),
        cascadeShare: cascade(relEl, "CascadeShare"),
        cascadeUnshare: cascade(relEl, "CascadeUnshare"),
        description:
          relEl.querySelector("RelationshipDescription Description")?.getAttribute("description") ?? undefined,
        isSystem:
          SYSTEM_TABLES.has(norm(target)) ||
          SYSTEM_TABLES.has(norm(source)) ||
          SYSTEM_ATTRIBUTES.has(norm(referencingAttribute)),
      };

      relationships.push(rel);
      upsertTable(source, false);
      upsertTable(target, false);
    });

  return { relationships, tables: [...tableMap.values()] };
}
