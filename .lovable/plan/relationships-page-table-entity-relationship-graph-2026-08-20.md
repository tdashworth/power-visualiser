# Relationships page — table/entity relationship graph

A new "Relationships" page that visualises Dataverse tables as nodes and entity relationships as edges, parsed from `customizations.xml` in imported solutions.

## What gets built

**Parsing**
- Read `<EntityRelationships>` from `customizations.xml` during solution import.
- Capture per relationship: name, type (OneToMany / ManyToMany), referencing table, referenced table, referencing attribute, hierarchical flag, and the five cascade settings (Assign, Delete, Reparent, Share, Unshare).
- Tables become nodes derived from both ends of each relationship, name-normalised (lowercased logical names) so `SystemUser` and `systemuser` merge.
- Tables defined in the solution's `<Entities>` section are marked as "in solution"; tables only referenced by a relationship are marked "external".
- Multiple ZIPs merge and deduplicate by relationship name, matching how processes already merge.

**Page (route `/relationships`, new left-nav item)**
- Split layout consistent with Map: left panel with table list + filters, right panel with the graph.
- Graph: tables as nodes, relationships as directed edges (referencing table -> referenced table), pan/zoom, click a node to highlight it and its direct relationships, hover an edge for a tooltip with relationship name, attribute and cascade settings.
- Left list: searchable list of tables with per-table show/hide toggles, plus "show all".

**Filters**
- Relationship type: One-to-Many / Many-to-Many.
- Cascade filters: for each of Assign, Delete, Reparent, Share, Unshare, filter to relationships whose behaviour is in a selected set (NoCascade, Cascade, Active, UserOwned, RemoveLink, Restrict).
- "Show system/ownership relationships" toggle, **off by default** — hides relationships to SystemUser, Team, BusinessUnit, Owner and the CreatedBy/ModifiedBy/OwningUser/OwningTeam/OwningBusinessUnit lookups. Tables left with no visible relationships drop out of the graph.
- Filter state persists via the existing `usePersistedState` pattern.

Empty state reuses the shared "Import a solution" component when no data is loaded.

## Technical notes

- New `src/lib/parsing/entityRelationshipParser.ts`; wired into `parseSolutionZips` in `src/lib/solutionParser.ts`.
- New types `EntityRelationship` / `EntityTable` in `src/data/flows.ts`; `ParseResult` gains a `relationships` array (optional, so older cached payloads stay valid).
- `STORAGE_VERSION` in `FlowDataContext` bumps to 6 so caches refresh with relationship data; context exposes `allRelationships`.
- New `src/components/EntityGraph.tsx`: a dedicated, simpler SVG graph (d3-force layout + existing pan/zoom approach) rather than extending `FlowGraph`, which is tightly bound to the `Process` model. Fluent UI tokens for all colours, teal theme respected in light/dark.
- New `src/pages/Relationships.tsx`, route added in `src/App.tsx`, nav item added to the rail in `src/components/AppNavbar.tsx`.
- Live Dataverse (Code App) source is out of scope for this change; the page shows the empty state until relationship data exists.
