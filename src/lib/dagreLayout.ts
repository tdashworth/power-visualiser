import dagre from "dagre";
import type { Process, ProcessEdge } from "@/data/flows";

export interface DagreNode {
  id: string;
  x: number;
  y: number;
}

export function computeDagreLayout(
  flows: Process[],
  edges: ProcessEdge[],
  options: { rankdir?: string; nodesep?: number; ranksep?: number } = {}
): DagreNode[] {
  const { rankdir = "LR", nodesep = 60, ranksep = 120 } = options;

  const flowIds = new Set(flows.map((f) => f.id));

  // Detect connected components
  const adj = new Map<string, Set<string>>();
  for (const f of flows) adj.set(f.id, new Set());
  for (const e of edges) {
    if (flowIds.has(e.source) && flowIds.has(e.target)) {
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const f of flows) {
    if (visited.has(f.id)) continue;
    const comp: string[] = [];
    const queue = [f.id];
    while (queue.length) {
      const cur = queue.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      comp.push(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) queue.push(nb);
      }
    }
    components.push(comp);
  }

  const allNodes: DagreNode[] = [];
  let offsetX = 0;

  for (const comp of components) {
    const compSet = new Set(comp);
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir, nodesep, ranksep });
    g.setDefaultEdgeLabel(() => ({}));

    for (const id of comp) {
      g.setNode(id, { width: 80, height: 80 });
    }
    for (const e of edges) {
      if (compSet.has(e.source) && compSet.has(e.target)) {
        g.setEdge(e.source, e.target);
      }
    }

    dagre.layout(g);

    // Find bounding box of this component
    let minX = Infinity, maxX = -Infinity;
    for (const id of comp) {
      const n = g.node(id);
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
    }

    for (const id of comp) {
      const n = g.node(id);
      allNodes.push({ id, x: n.x - minX + offsetX, y: n.y });
    }

    offsetX += (maxX - minX) + 200; // gap between components
  }

  // Center vertically
  let minY = Infinity, maxY = -Infinity;
  for (const n of allNodes) {
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }
  const centerY = (minY + maxY) / 2;
  for (const n of allNodes) n.y -= centerY;

  // Center horizontally
  let minXAll = Infinity, maxXAll = -Infinity;
  for (const n of allNodes) {
    if (n.x < minXAll) minXAll = n.x;
    if (n.x > maxXAll) maxXAll = n.x;
  }
  const centerX = (minXAll + maxXAll) / 2;
  for (const n of allNodes) n.x -= centerX;

  return allNodes;
}
