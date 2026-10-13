import { ProcessEdge } from "@/data/flows";

export function getFlowUrl(environmentId: string, flowId: string): string {
  return `https://make.powerautomate.com/environments/${environmentId}/flows/${flowId}/details`;
}

export function getConnectedIds(nodeId: string, edges: ProcessEdge[]): Set<string> {
  const connected = new Set<string>();
  // upstream
  const visited = new Set<string>();
  const upQueue = [nodeId];
  while (upQueue.length) {
    const cur = upQueue.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    connected.add(cur);
    for (const e of edges) {
      if (e.target === cur && !visited.has(e.source)) upQueue.push(e.source);
    }
  }
  // downstream
  const visited2 = new Set<string>();
  const downQueue = [nodeId];
  while (downQueue.length) {
    const cur = downQueue.pop()!;
    if (visited2.has(cur)) continue;
    visited2.add(cur);
    connected.add(cur);
    for (const e of edges) {
      if (e.source === cur && !visited2.has(e.target)) downQueue.push(e.target);
    }
  }
  return connected;
}

/** Returns the node plus only its direct (1-hop) neighbours. */
export function getDirectlyConnectedIds(nodeId: string, edges: ProcessEdge[]): Set<string> {
  const direct = new Set<string>([nodeId]);
  for (const e of edges) {
    if (e.source === nodeId) direct.add(e.target);
    if (e.target === nodeId) direct.add(e.source);
  }
  return direct;
}
