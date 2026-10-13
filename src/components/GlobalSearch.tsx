import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Fuse from "fuse.js";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Input,
  Text,
  Tag,
  tokens,
} from "@fluentui/react-components";
import { Search20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useTheme } from "next-themes";
import { useSearch } from "@/context/SearchContext";
import { useFlowData } from "@/context/FlowDataContext";
import { searchRegistry } from "@/lib/search/registry";
import { looksLikeODataFilter, type SearchResult } from "@/lib/search/types";
import { trackEvent } from "@/lib/appInsights";

const MAX_PER_CATEGORY = 100;
const DEBOUNCE_MS = 150;

export default function GlobalSearch() {
  const { isOpen, close } = useSearch();
  const { allFlows, allEdges, allActions, setPendingSelection } = useFlowData();
  const { resolvedTheme } = useTheme();
  const fluentTheme = resolvedTheme === "dark" ? webDarkTheme : webLightTheme;
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce query changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Build per-category Fuse instances
  const fuseByCategory = useMemo(() => {
    const data = { flows: allFlows, edges: allEdges, actions: allActions };
    const map = new Map<string, { fuse: Fuse<any>; cat: typeof searchRegistry[number] }>();
    for (const cat of searchRegistry) {
      const items = cat.getItems(data);
      const fuse = new Fuse(items, {
        keys: cat.fuseKeys,
        includeMatches: true,
        includeScore: true,
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
      });
      map.set(cat.id, { fuse, cat });
    }
    return map;
  }, [allFlows, allEdges, allActions]);

  // Reset state when reopened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setHighlightIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const isOData = useMemo(() => looksLikeODataFilter(debouncedQuery.trim()), [debouncedQuery]);

  // Run search: merge all categories and sort by score (lower = better match)
  const allResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [] as SearchResult[];
    const data = { flows: allFlows, edges: allEdges, actions: allActions };
    const hits: SearchResult[] = [];
    for (const cat of searchRegistry) {
      if (activeCategoryIds.size > 0 && !activeCategoryIds.has(cat.id)) continue;
      let catHits: SearchResult[] = [];
      if (isOData && cat.odataSearch) {
        catHits = cat.odataSearch(data, debouncedQuery.trim()).slice(0, MAX_PER_CATEGORY);
      } else {
        const entry = fuseByCategory.get(cat.id);
        if (!entry) continue;
        const fuseHits = entry.fuse.search(debouncedQuery, { limit: MAX_PER_CATEGORY });
        catHits = fuseHits.map((h) => cat.toResult(h.item, h));
      }
      hits.push(...catHits);
    }
    // Sort by score ascending (lower = better), undefined scores go to bottom
    hits.sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
    return hits;
  }, [debouncedQuery, fuseByCategory, activeCategoryIds, isOData, allFlows, allEdges, allActions]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [debouncedQuery, activeCategoryIds]);

  const activate = useCallback(
    (result: SearchResult) => {
      setPendingSelection({ flowId: result.targetFlowId });
      trackEvent("global_search_select", {
        category: result.categoryId,
        query: debouncedQuery,
      });
      close();
      navigate("/");
    },
    [close, navigate, setPendingSelection, debouncedQuery],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = allResults[highlightIndex];
      if (r) activate(r);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  // Scroll highlighted into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-result-idx="${highlightIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  if (!isOpen) return null;

  const toggleCategory = (id: string) => {
    setActiveCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  

  return (
    <FluentProvider theme={fluentTheme}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        onMouseDown={close}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          backgroundColor: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: "12vh",
        }}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "min(720px, 92vw)",
            maxHeight: "70vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: tokens.colorNeutralBackground1,
            borderRadius: 8,
            boxShadow: tokens.shadow28,
            border: `1px solid ${tokens.colorNeutralStroke2}`,
            overflow: "hidden",
          }}
        >
          {/* Input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 14px",
              gap: 10,
              borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
            }}
          >
            <Search20Regular style={{ color: tokens.colorNeutralForeground3 }} />
            <Input
              ref={inputRef}
              appearance="underline"
              size="large"
              value={query}
              onChange={(_, data) => setQuery(data.value)}
              onKeyDown={onKeyDown}
              placeholder="Search flows, actions, columns, or paste an OData filter…"
              style={{ flex: 1, border: "none" }}
              input={{ style: { border: "none", outline: "none" } }}
            />
            {isOData && (
              <Tag appearance="brand" size="small">
                OData
              </Tag>
            )}
            <Dismiss20Regular
              role="button"
              aria-label="Close search"
              onClick={close}
              style={{ cursor: "pointer", color: tokens.colorNeutralForeground3 }}
            />
          </div>

          {/* Category chips */}
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              padding: "8px 14px",
              borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
              backgroundColor: tokens.colorNeutralBackground2,
            }}
          >
            <CategoryChip
              label="All"
              active={activeCategoryIds.size === 0}
              onClick={() => setActiveCategoryIds(new Set())}
            />
            {searchRegistry.map((cat) => (
              <CategoryChip
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                color={cat.color}
                active={activeCategoryIds.has(cat.id)}
                onClick={() => toggleCategory(cat.id)}
              />
            ))}
          </div>

          {/* Results */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "4px 0",
            }}
          >
            {!query.trim() && (
              <div style={{ padding: 24, textAlign: "center" }}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  Start typing to search across your imported solution.
                </Text>
              </div>
            )}
            {query.trim() && allResults.length === 0 && (
              <div style={{ padding: 24, textAlign: "center" }}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  No results for "{query}"
                </Text>
              </div>
            )}
            {allResults.map((r, idx) => {
              const cat = searchRegistry.find((c) => c.id === r.categoryId);
              const highlighted = idx === highlightIndex;
              return (
                <div
                  key={r.id}
                  data-result-idx={idx}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => activate(r)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 14px",
                    cursor: "pointer",
                    backgroundColor: highlighted ? tokens.colorNeutralBackground1Hover : "transparent",
                    borderLeft: `3px solid ${highlighted ? cat?.color ?? tokens.colorBrandBackground : "transparent"}`,
                  }}
                >
                  <div style={{ marginTop: 2, color: cat?.color ?? tokens.colorNeutralForeground2 }}>
                    {cat?.icon}
                  </div>
                  {cat?.renderRow(r)}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "6px 14px",
              borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
              backgroundColor: tokens.colorNeutralBackground2,
              display: "flex",
              gap: 16,
              fontSize: 11,
              color: tokens.colorNeutralForeground3,
            }}
          >
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
            <span style={{ marginLeft: "auto" }}>{allResults.length} result{allResults.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>
    </FluentProvider>
  );
}

function CategoryChip({
  label,
  icon,
  color,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${active ? color ?? tokens.colorBrandStroke1 : tokens.colorNeutralStroke2}`,
        backgroundColor: active
          ? color
            ? `${color}22`
            : tokens.colorBrandBackground2
          : tokens.colorNeutralBackground1,
        color: active ? tokens.colorNeutralForeground1 : tokens.colorNeutralForeground2,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon && <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>}
      {label}
    </button>
  );
}
