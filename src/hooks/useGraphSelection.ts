import { useCallback, useState } from "react";
import { Process, ProcessEdge } from "@/data/flows";
import { getConnectedIds, getDirectlyConnectedIds } from "@/lib/flowHelpers";

export function useGraphSelection(allFlows: Process[], allEdges: ProcessEdge[], protectedId?: string) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const toggleVisibility = useCallback(
    (id: string) => {
      if (protectedId && id === protectedId) return;
      setHiddenIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else {
          next.add(id);
          setSelectedNodeId((sel) => (sel === id ? null : sel));
        }
        return next;
      });
    },
    [protectedId],
  );

  const showOnlyRelated = useCallback(
    (id: string) => {
      if (protectedId && id === protectedId) return;
      const connectedIds = getConnectedIds(id, allEdges);
      setHiddenIds(new Set(allFlows.map((f) => f.id).filter((fid) => !connectedIds.has(fid))));
    },
    [allEdges, allFlows, protectedId],
  );

  const showOnlyDirect = useCallback(
    (id: string) => {
      if (protectedId && id === protectedId) return;
      const directIds = getDirectlyConnectedIds(id, allEdges);
      setHiddenIds(new Set(allFlows.map((f) => f.id).filter((fid) => !directIds.has(fid))));
    },
    [allEdges, allFlows, protectedId],
  );

  const resetHidden = useCallback(() => setHiddenIds(new Set()), []);

  return {
    selectedNodeId,
    setSelectedNodeId,
    hiddenIds,
    setHiddenIds,
    toggleVisibility,
    showOnlyRelated,
    showOnlyDirect,
    resetHidden,
  };
}
