import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { Process, ProcessEdge, ProcessAction, EntityRelationship, EntityTable } from "@/data/flows";
import { ParseResult } from "@/lib/solutionParser";
import { trackEvent } from "@/lib/appInsights";
import { type DataSource, type DataSourceCapabilities, zipDataSource } from "@/lib/data-source";

const STORAGE_KEY = "flow-visualizer-data";
const STORAGE_VERSION = 6;
const ENV_ID_KEY = "flow-visualizer-env-id";
const PERM_HIDDEN_KEY = "flow-visualizer-permanently-hidden";

function loadPermHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(PERM_HIDDEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

interface StoredData {
  version: number;
  data: ParseResult;
}

function loadCachedData(): ParseResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored: StoredData = JSON.parse(raw);
    if (stored.version !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!Array.isArray(stored.data?.processes) || !Array.isArray(stored.data?.edges)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored.data;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveCachedData(data: ParseResult) {
  try {
    const stored: StoredData = { version: STORAGE_VERSION, data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // silently ignore
  }
}

export interface PendingSelection {
  flowId: string;
}

interface FlowDataContextType {
  importedData: ParseResult | null;
  hasData: boolean;
  allFlows: Process[];
  allEdges: ProcessEdge[];
  allActions: ProcessAction[];
  allRelationships: EntityRelationship[];
  allTables: EntityTable[];
  handleImport: (result: ParseResult) => void;
  handleClear: () => void;
  environmentId: string | null;
  setEnvironmentId: (id: string | null) => void;
  pendingSelection: PendingSelection | null;
  setPendingSelection: (s: PendingSelection | null) => void;
  permanentlyHiddenIds: Set<string>;
  togglePermanentlyHidden: (id: string) => void;
  clearPermanentlyHidden: () => void;
  /** The active data source (e.g. ZIP upload, live Dataverse). */
  dataSource: DataSource;
  /** Convenience accessor for `dataSource.capabilities`. */
  capabilities: DataSourceCapabilities;
}

const FlowDataContext = createContext<FlowDataContextType | null>(null);

export interface FlowDataProviderProps {
  children: React.ReactNode;
  /**
   * Data source for this app shell. Defaults to the in-browser ZIP
   * parser used by the public web app. The Power Apps Code App
   * passes a DataverseDataSource instead.
   */
  dataSource?: DataSource;
}

export function FlowDataProvider({ children, dataSource = zipDataSource }: FlowDataProviderProps) {
  const [importedData, setImportedData] = useState<ParseResult | null>(() => loadCachedData());
  const [environmentId, setEnvironmentIdState] = useState<string | null>(() => localStorage.getItem(ENV_ID_KEY));
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [permanentlyHiddenIds, setPermanentlyHiddenIds] = useState<Set<string>>(() => loadPermHidden());

  const persistPermHidden = (next: Set<string>) => {
    try {
      localStorage.setItem(PERM_HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      // ignore
    }
  };

  const togglePermanentlyHidden = useCallback((id: string) => {
    setPermanentlyHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistPermHidden(next);
      return next;
    });
  }, []);

  const clearPermanentlyHidden = useCallback(() => {
    setPermanentlyHiddenIds(new Set());
    try {
      localStorage.removeItem(PERM_HIDDEN_KEY);
    } catch {
      // ignore
    }
  }, []);

  const handleImport = useCallback((result: ParseResult) => {
    setImportedData(result);
    saveCachedData(result);
    trackEvent("solutions_imported", {
      processCount: result.processes?.length ?? 0,
      edgeCount: result.edges?.length ?? 0,
      actionCount: result.actions?.length ?? 0,
    });
  }, []);

  const handleClear = useCallback(() => {
    setImportedData(null);
    localStorage.removeItem(STORAGE_KEY);
    trackEvent("data_cleared");
  }, []);

  const setEnvironmentId = useCallback((id: string | null) => {
    setEnvironmentIdState(id);
    if (id) localStorage.setItem(ENV_ID_KEY, id);
    else localStorage.removeItem(ENV_ID_KEY);
  }, []);

  const value: FlowDataContextType = useMemo(
    () => ({
      importedData,
      hasData: importedData !== null,
      allFlows: importedData?.processes ?? [],
      allEdges: importedData?.edges ?? [],
      allActions: importedData?.actions ?? [],
      allRelationships: importedData?.relationships ?? [],
      allTables: importedData?.tables ?? [],
      handleImport,
      handleClear,
      environmentId,
      setEnvironmentId,
      pendingSelection,
      setPendingSelection,
      permanentlyHiddenIds,
      togglePermanentlyHidden,
      clearPermanentlyHidden,
      dataSource,
      capabilities: dataSource.capabilities,
    }),
    [
      importedData,
      handleImport,
      handleClear,
      environmentId,
      setEnvironmentId,
      pendingSelection,
      permanentlyHiddenIds,
      togglePermanentlyHidden,
      clearPermanentlyHidden,
      dataSource,
    ],
  );

  return <FlowDataContext.Provider value={value}>{children}</FlowDataContext.Provider>;
}

export function useFlowData() {
  const ctx = useContext(FlowDataContext);
  if (!ctx) throw new Error("useFlowData must be used within FlowDataProvider");
  return ctx;
}
