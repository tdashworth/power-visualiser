import JSZip from "jszip";
import { Process, ProcessAction, ProcessEdge, EntityRelationship, EntityTable } from "@/data/flows";
import { readZipEntry } from "./parsing/zipUtils";
import { parseCloudFlows } from "./parsing/cloudFlowParser";
import { parseClassicWorkflows } from "./parsing/classicWorkflowParser";
import { parseCustomApis } from "./parsing/customApiParser";
import { resolveEdges } from "./parsing/edgeResolver";
import { parseClassicActions } from "./parsing/classicActionParser";
import { parsePluginSteps } from "./parsing/pluginStepParser";
import { parseEntityRelationships } from "./parsing/entityRelationshipParser";
import { trackEvent } from "./appInsights";

export interface ParseResult {
  processes: Process[];
  edges: ProcessEdge[];
  actions: ProcessAction[];
  /** Optional — absent in data cached before relationships were supported. */
  relationships?: EntityRelationship[];
  tables?: EntityTable[];
}


// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a single solution zip. Two-phase approach:
 * 1. Extract all cloud flows + classic workflows + custom APIs, parse their actions
 * 2. With the full set of processes, resolve inter-flow edges
 */
export async function parseSolutionZip(file: File): Promise<ParseResult> {
  return parseSolutionZips([file]);
}

/**
 * Parse multiple solution zips with a two-phase approach:
 * 1. Parse all cloud flows + classic workflows + custom APIs across all zips, deduplicate by ID
 * 2. With the full set of processes, resolve inter-flow edges once
 *
 * Optional onProgress callback fires after each zip is parsed.
 */
export async function parseSolutionZips(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<ParseResult> {
  const processMap = new Map<string, Process>();
  const relationshipMap = new Map<string, EntityRelationship>();
  const tableMap = new Map<string, EntityTable>();
  const parser = new DOMParser();


  // Phase 1: Parse every zip, collecting flows and actions
  for (let i = 0; i < files.length; i++) {
    const zip = await JSZip.loadAsync(files[i]);

    const solutionXmlText = await readZipEntry(zip, "solution.xml");
    const solutionDoc = new DOMParser().parseFromString(solutionXmlText, "text/xml");

    const solutionUniqueName =
      solutionDoc.querySelector("SolutionManifest > UniqueName")?.textContent?.trim() || undefined;

    const customizationsXmlText = await readZipEntry(zip, "customizations.xml");
    const customizationsDoc = parser.parseFromString(customizationsXmlText, "text/xml");

    const cloudFlows = await parseCloudFlows(zip, customizationsDoc);
    const classicWorkflows = await parseClassicWorkflows(zip, customizationsDoc);
    const classicActions = await parseClassicActions(zip, customizationsDoc, solutionDoc);
    const customApis = await parseCustomApis(zip);
    const pluginSteps = parsePluginSteps(customizationsDoc);
    const { relationships, tables } = parseEntityRelationships(customizationsDoc);

    for (const r of relationships) {
      if (!relationshipMap.has(r.name)) relationshipMap.set(r.name, r);
    }
    for (const t of tables) {
      const existing = tableMap.get(t.id);
      if (existing) {
        if (t.inSolution) existing.inSolution = true;
      } else {
        tableMap.set(t.id, { ...t });
      }
    }


    for (const f of [...cloudFlows, ...classicWorkflows, ...classicActions, ...customApis, ...pluginSteps]) {
      const existing = processMap.get(f.id);
      if (existing) {
        const merged = new Set([...(existing.solutions ?? []), ...(f.solutions ?? [])]);
        if (solutionUniqueName) merged.add(solutionUniqueName);
        existing.solutions = [...merged];
      } else {
        f.solutions = solutionUniqueName ? [solutionUniqueName] : [];
        processMap.set(f.id, f);
      }
    }

    trackEvent("solution_parsed", {
      flows: cloudFlows.length,
      classicWorkflows: classicWorkflows.length,
      classicActions: classicActions.length,
      customApis: customApis.length,
      pluginSteps: pluginSteps.length,
      totalProcesses: processMap.size,
    });

    onProgress?.(i + 1, files.length);
  }

  const processList = Array.from(processMap.values());
  const allActions = processList.flatMap((f) => f.actions ?? []);
  const allChildCalls = processList.flatMap((f) => f.childCalls ?? []);

  // Phase 2: Resolve edges across the complete deduplicated dataset
  const edges = resolveEdges(processMap, allActions, allChildCalls);

  return {
    processes: processList,
    edges,
    actions: allActions,
    relationships: Array.from(relationshipMap.values()),
    tables: Array.from(tableMap.values()),
  };

}