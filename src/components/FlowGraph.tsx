import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Settings, Maximize2, Camera } from "lucide-react";
import { Menu, MenuTrigger, MenuPopover, MenuList, PositioningImperativeRef, Tag, tokens } from "@fluentui/react-components";
import FlowDetailDialog from "@/components/FlowDetailDialog";
import FlowItemMenuItems from "@/components/FlowItemMenuItems";
import { toJpeg } from "html-to-image";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import { Process, ProcessEdge, triggerMeta, processTypeMeta } from "@/data/flows";
import { computeDagreLayout } from "@/lib/dagreLayout";
import { getConnectedIds } from "@/lib/flowHelpers";
import { useFlowData } from "@/context/FlowDataContext";
import FlowSettingsPanel from "@/components/FlowSettingsPanel";
import { usePersistedState } from "@/hooks/usePersistedState";
import FlowLegend from "@/components/FlowLegend";

type LayoutMode = "force" | "hierarchical";

interface SimNode extends SimulationNodeDatum, Process {
  x: number;
  y: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  label: string;
  targetExecutionMode?: "sync" | "async";
}

interface Props {
  flows: Process[];
  edges: ProcessEdge[];
  searchMatchIds?: Set<string>;
  onSelectNode: (id: string | null) => void;
  selectedNodeId: string | null;
  onHideFlow?: (id: string) => void;
  hiddenIds?: Set<string>;
  onToggleVisibility?: (id: string) => void;
  onShowOnlyRelated?: (id: string) => void;
  onShowOnlyDirect?: (id: string) => void;
  defaultLayoutMode?: LayoutMode;
  defaultDagreParams?: { nodesep?: number; ranksep?: number; rankdir?: string };
}

const NODE_RADIUS = 28;
const DEFAULT_CANVAS_WIDTH = 900;
const DEFAULT_CANVAS_HEIGHT = 600;
const CURVE_SPACING = 40;
const LABEL_MAX_LENGTH = 35;
const LABEL_TRUNCATED_LENGTH = 33;
const ZOOM_FIT_PADDING = 0.01;

const iconPaths: Record<string, JSX.Element> = {
  "plus-circle": (
    <g transform="translate(-10,-10) scale(0.833)">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
  pencil: (
    <g transform="translate(-10,-10) scale(0.833)">
      <path
        d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </g>
  ),
  "trash-2": (
    <g transform="translate(-10,-10) scale(0.833)">
      <polyline points="3 6 5 6 21 6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </g>
  ),
  "git-branch": (
    <g transform="translate(-10,-10) scale(0.833)">
      <line x1="6" y1="3" x2="6" y2="15" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M18 9a9 9 0 0 1-9 9" fill="none" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
  clock: (
    <g transform="translate(-10,-10) scale(0.833)">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="12 6 12 12 16 14" fill="none" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
  "mouse-pointer-click": (
    <g transform="translate(-10,-10) scale(0.833)">
      <path d="M9 9l5 12 1.774-5.226L21 14 9 9z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16.071 16.071l4.243 4.243" fill="none" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
  "help-circle": (
    <g transform="translate(-10,-10) scale(0.833)">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
  plug: (
    <g transform="translate(-10,-10) scale(0.833)">
      <path d="M9 2v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 2v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 17v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  zap: (
    <g transform="translate(-10,-10) scale(0.833)">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </g>
  ),
};

export default function FlowGraph({
  flows,
  edges,
  searchMatchIds = new Set<string>(),
  onSelectNode,
  selectedNodeId,
  onHideFlow,
  hiddenIds,
  onToggleVisibility,
  onShowOnlyRelated,
  onShowOnlyDirect,
  defaultLayoutMode = "force",
  defaultDagreParams,
}: Props) {
  const { environmentId, permanentlyHiddenIds, togglePermanentlyHidden } = useFlowData();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ nodeId: string; startX: number; startY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; flow: Process } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [layoutMode, setLayoutMode] = usePersistedState<LayoutMode>("graph.layoutMode", defaultLayoutMode);
  const [dagreParams, setDagreParams] = usePersistedState("graph.dagreParams", {
    nodesep: 60,
    ranksep: 120,
    rankdir: "LR",
    ...defaultDagreParams,
  });
  const [forceParams, setForceParams] = usePersistedState("graph.forceParams", {
    linkDistance: 100,
    chargeStrength: -100,
    collisionPadding: 40,
  });
  const [debouncedParams, setDebouncedParams] = useState(forceParams);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedParams(forceParams), 1000);
    return () => clearTimeout(timer);
  }, [forceParams]);

  const handleZoomToFit = useCallback(() => {
    if (nodes.length === 0) return;
    const svg = svgRef.current;
    if (!svg) return;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const paddedWidth = (maxX - minX) * (1 + ZOOM_FIT_PADDING * 2);
    const paddedHeight = (maxY - minY) * (1 + ZOOM_FIT_PADDING * 2);
    const scaleX = width / paddedWidth;
    const scaleY = height / paddedHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setTransform({ x: width / 2 - centerX * scale, y: height / 2 - centerY * scale, k: scale });
  }, [nodes]);

  const connectedIds = selectedNodeId ? getConnectedIds(selectedNodeId, edges) : null;

  // Init layout
  useEffect(() => {
    const w = DEFAULT_CANVAS_WIDTH;
    const h = DEFAULT_CANVAS_HEIGHT;

    if (layoutMode === "hierarchical") {
      const dagreNodes = computeDagreLayout(flows, edges, dagreParams);
      const simNodes: SimNode[] = flows.map((f) => {
        const dn = dagreNodes.find((n) => n.id === f.id);
        return { ...f, x: (dn?.x ?? 0) + w / 2, y: (dn?.y ?? 0) + h / 2 };
      });
      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
      const simLinks: SimLink[] = edges
        .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
        .map((e) => ({ source: nodeMap.get(e.source)!, target: nodeMap.get(e.target)!, label: e.actionName, targetExecutionMode: e.targetExecutionMode }));
      setNodes(simNodes);
      setLinks(simLinks);
      simRef.current = null;
      return;
    }

    const simNodes: SimNode[] = flows.map((f) => ({
      ...f,
      x: w / 2 + (Math.random() - 0.5) * 300,
      y: h / 2 + (Math.random() - 0.5) * 300,
    }));
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({ source: nodeMap.get(e.source)!, target: nodeMap.get(e.target)!, label: e.actionName, targetExecutionMode: e.targetExecutionMode }));

    const sim = forceSimulation<SimNode>(simNodes)
      .alphaDecay(0.05)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(debouncedParams.linkDistance),
      )
      .force("charge", forceManyBody().strength(debouncedParams.chargeStrength))
      .force("center", forceCenter(w / 2, h / 2))
      .force("collide", forceCollide(NODE_RADIUS + debouncedParams.collisionPadding))
      .on("tick", () => {
        setNodes([...simNodes]);
        setLinks([...simLinks]);
      });

    simRef.current = sim;
    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flows, edges, layoutMode, dagreParams, debouncedParams]);

  const pinchRef = useRef<{ dist: number } | null>(null);
  const touchPanRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const touchDragRef = useRef<{ nodeId: string } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scale = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((t) => {
        const newK = Math.max(0.2, Math.min(3, t.k * scale));
        return { x: mx - (mx - t.x) * (newK / t.k), y: my - (my - t.y) * (newK / t.k), k: newK };
      });
    };

    const getTouchDist = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        pinchRef.current = { dist: getTouchDist(e.touches) };
        touchPanRef.current = null;
        touchDragRef.current = null;
        return;
      }
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const nodeEl = (target as Element)?.closest?.(".flow-node");
        if (nodeEl) {
          const nodeId = nodeEl.getAttribute("data-node-id");
          if (nodeId) {
            touchDragRef.current = { nodeId };
            return;
          }
        }
        touchPanRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          tx: transform.x,
          ty: transform.y,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchRef.current) {
        const newDist = getTouchDist(e.touches);
        const scale = newDist / pinchRef.current.dist;
        pinchRef.current.dist = newDist;
        const rect = svg.getBoundingClientRect();
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        setTransform((t) => {
          const newK = Math.max(0.2, Math.min(3, t.k * scale));
          return { x: mx - (mx - t.x) * (newK / t.k), y: my - (my - t.y) * (newK / t.k), k: newK };
        });
        return;
      }
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (touchDragRef.current) {
          const rect = svg.getBoundingClientRect();
          const x = (touch.clientX - rect.left - transform.x) / transform.k;
          const y = (touch.clientY - rect.top - transform.y) / transform.k;
          if (simRef.current) {
            const node = simRef.current.nodes().find((n) => n.id === touchDragRef.current!.nodeId);
            if (node) {
              node.fx = x;
              node.fy = y;
              simRef.current.alpha(0.3).restart();
            }
          } else {
            setNodes((prev) => prev.map((n) => (n.id === touchDragRef.current!.nodeId ? { ...n, x, y } : n)));
          }
          return;
        }
        if (touchPanRef.current) {
          const { startX, startY, tx, ty } = touchPanRef.current;
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          setTransform((t) => ({ ...t, x: tx + dx, y: ty + dy }));
        }
      }
    };

    const onTouchEnd = () => {
      if (touchDragRef.current && simRef.current) {
        const node = simRef.current.nodes().find((n) => n.id === touchDragRef.current!.nodeId);
        if (node) {
          node.fx = null;
          node.fy = null;
        }
      }
      touchDragRef.current = null;
      touchPanRef.current = null;
      pinchRef.current = null;
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    svg.addEventListener("touchend", onTouchEnd);
    svg.addEventListener("touchcancel", onTouchEnd);
    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
      svg.removeEventListener("touchend", onTouchEnd);
      svg.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [transform]);

  const didPanRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as SVGElement).closest(".flow-node")) return;
      didPanRef.current = false;
      panRef.current = { startX: e.clientX, startY: e.clientY, tx: transform.x, ty: transform.y };
    },
    [transform],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        const svg = svgRef.current!;
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left - transform.x) / transform.k;
        const y = (e.clientY - rect.top - transform.y) / transform.k;
        if (simRef.current) {
          const node = simRef.current.nodes().find((n) => n.id === dragRef.current!.nodeId);
          if (node) {
            node.fx = x;
            node.fy = y;
            simRef.current.alpha(0.3).restart();
          }
        } else {
          setNodes((prev) => prev.map((n) => (n.id === dragRef.current!.nodeId ? { ...n, x, y } : n)));
        }
        return;
      }
      if (panRef.current) {
        const { startX, startY, tx, ty } = panRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPanRef.current = true;
        setTransform((t) => ({ ...t, x: tx + dx, y: ty + dy }));
      }
    },
    [transform],
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current && simRef.current) {
      const node = simRef.current.nodes().find((n) => n.id === dragRef.current!.nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    dragRef.current = null;
    panRef.current = null;
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    dragRef.current = { nodeId, startX: e.clientX, startY: e.clientY };
  }, []);

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      onSelectNode(selectedNodeId === nodeId ? null : nodeId);
    },
    [selectedNodeId, onSelectNode],
  );

  const [detailFlow, setDetailFlow] = useState<Process | null>(null);

  // Right-click context menu
  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; nodeId: string | null }>({ open: false, nodeId: null });
  const positioningRef = useRef<PositioningImperativeRef>(null);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const cx = e.clientX;
    const cy = e.clientY;
    const target = {
      getBoundingClientRect: () => ({
        left: cx, top: cy, right: cx, bottom: cy, width: 0, height: 0, x: cx, y: cy, toJSON: () => "",
      }),
    } as Element;
    setCtxMenu({ open: true, nodeId });
    requestAnimationFrame(() => positioningRef.current?.setTarget(target));
  }, []);

  const ctxFlow = ctxMenu.nodeId ? flows.find((f) => f.id === ctxMenu.nodeId) ?? null : null;

  const handleNodeDoubleClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const flow = flows.find((f) => f.id === nodeId) ?? null;
      setDetailFlow(flow);
    },
    [flows],
  );

  const handleBgClick = useCallback(() => {
    if (didPanRef.current) return;
    onSelectNode(null);
  }, [onSelectNode]);

  const getNodeOpacity = (id: string) => {
    if (connectedIds && !connectedIds.has(id)) return 0.15;
    if (searchMatchIds.size > 0 && !searchMatchIds.has(id)) return 0.3;
    return 1;
  };

  const getEdgeOpacity = (sourceId: string, targetId: string) => {
    if (connectedIds && (!connectedIds.has(sourceId) || !connectedIds.has(targetId))) return 0.08;
    if (searchMatchIds.size > 0 && (!searchMatchIds.has(sourceId) || !searchMatchIds.has(targetId))) return 0.15;
    return 0.7;
  };

  // Pre-compute edge pair counts for parallel edge rendering
  const edgePairCounts = useMemo(() => {
    const counts = new Map<string, number>();
    links.forEach((link) => {
      const s = (link.source as SimNode).id;
      const t = (link.target as SimNode).id;
      const key = s < t ? `${s}|${t}` : `${t}|${s}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [links]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: panRef.current ? "grabbing" : "grab", touchAction: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleBgClick}
      >
        <defs>
          {Object.entries(triggerMeta).map(([key, meta]) => (
            <marker
              key={key}
              id={`arrowhead-${key}`}
              viewBox="0 0 10 7"
              refX="10"
              refY="3.5"
              markerWidth="10"
              markerHeight="7"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={meta.color} opacity="0.85" />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {/* Edges */}
          {(() => {
            const pairIndex = new Map<string, number>();
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            return links.map((link, i) => {
              const rawS = link.source as SimNode;
              const rawT = link.target as SimNode;
              const s = nodeMap.get(rawS.id) ?? rawS;
              const t = nodeMap.get(rawT.id) ?? rawT;
              const pairKey = s.id < t.id ? `${s.id}|${t.id}` : `${t.id}|${s.id}`;
              const total = edgePairCounts.get(pairKey) ?? 1;
              const idx = pairIndex.get(pairKey) ?? 0;
              pairIndex.set(pairKey, idx + 1);

              const dx = t.x - s.x;
              const dy = t.y - s.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const offsetX = (dx / dist) * NODE_RADIUS;
              const offsetY = (dy / dist) * NODE_RADIUS;
              const opacity = getEdgeOpacity(s.id, t.id);
              const x1 = s.x + offsetX;
              const y1 = s.y + offsetY;
              const x2 = t.x - offsetX;
              const y2 = t.y - offsetY;

              const curvature = total > 1 ? CURVE_SPACING * (idx - (total - 1) / 2) : 0;
              const nx = -dy / dist;
              const ny = dx / dist;
              const flip = s.id > t.id ? -1 : 1;
              const cx = (s.x + t.x) / 2 + nx * curvature * flip;
              const cy = (s.y + t.y) / 2 + ny * curvature * flip;
              const pathD = curvature === 0 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;

              const edgeColor = triggerMeta[t.triggerTypes[0]].color;
              const markerId = `arrowhead-${t.triggerTypes[0]}`;

              return (
                <g key={i} opacity={opacity}>
                  <path d={pathD} stroke={edgeColor} strokeWidth={2.5} fill="none" markerEnd={`url(#${markerId})`} strokeDasharray={link.targetExecutionMode === "async" ? "6 3" : undefined} />
                </g>
              );
            });
          })()}

          {/* Nodes */}
          {nodes.map((node) => {
            const isActionNode = node.id === "__whatif_action__";
            const isSearchNode = node.id === "__search_action__";
            const types = node.triggerTypes;
            const primaryMeta = triggerMeta[types[0]];
            const opacity = getNodeOpacity(node.id);
            const isSelected = selectedNodeId === node.id;
            const isSearchMatch = searchMatchIds.size > 0 && searchMatchIds.has(node.id);
            const nodeFill = isSearchNode
              ? "#ffffff"
              : isActionNode
                ? "hsl(var(--foreground))"
                : primaryMeta.color;

            const isClassic = node.processType === "classic-workflow";
            const isCustomApi = node.processType === "custom-api";
            const isPluginStep = node.processType === "plugin-step";
            const HEX_POINTS = (r: number) =>
              [0, 1, 2, 3, 4, 5]
                .map((i) => {
                  const a = (Math.PI / 3) * i - Math.PI / 2;
                  return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
                })
                .join(" ");
            const nodeStroke = isSelected
              ? "hsl(var(--foreground))"
              : isSearchNode
                ? "hsl(var(--foreground))"
                : "hsl(var(--background))";
            const renderNodeShape = () => {
              if (isPluginStep) {
                const pts = HEX_POINTS(NODE_RADIUS);
                return (
                  <polygon
                    points={pts}
                    fill={nodeFill}
                    stroke={nodeStroke}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                );
              }
              if (isCustomApi) {
                // Diamond (rotated square) for custom APIs
                const r = NODE_RADIUS;
                const pts = `0,${-r} ${r},0 0,${r} ${-r},0`;
                if (types.length === 1) {
                  return (
                    <polygon
                      points={pts}
                      fill={nodeFill}
                      stroke={nodeStroke}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  );
                }
                // Multi-trigger custom-api fallback: split as pie inside diamond bounds
                return (
                  <polygon
                    points={pts}
                    fill={nodeFill}
                    stroke={nodeStroke}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                );
              }
              if (isClassic) {
                // Rounded square for classic workflows
                const size = NODE_RADIUS * 1.7;
                const half = size / 2;
                if (types.length === 1) {
                  return (
                    <rect
                      x={-half}
                      y={-half}
                      width={size}
                      height={size}
                      rx={6}
                      fill={nodeFill}
                      stroke={nodeStroke}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  );
                }
                const n = types.length;
                const sliceWidth = size / n;
                return (
                  <g>
                    {types.map((tt, i) => (
                      <rect
                        key={tt}
                        x={-half + i * sliceWidth}
                        y={-half}
                        width={sliceWidth}
                        height={size}
                        rx={i === 0 || i === n - 1 ? 6 : 0}
                        fill={triggerMeta[tt].color}
                        stroke={nodeStroke}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                    ))}
                  </g>
                );
              }
              // Circle for cloud flows
              if (types.length === 1) {
                return (
                  <circle
                    r={NODE_RADIUS}
                    fill={nodeFill}
                    stroke={nodeStroke}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                );
              }
              const n = types.length;
              const anglePerSegment = (2 * Math.PI) / n;
              return (
                <g>
                  {types.map((tt, i) => {
                    const startAngle = i * anglePerSegment - Math.PI / 2;
                    const endAngle = (i + 1) * anglePerSegment - Math.PI / 2;
                    const ax = Math.cos(startAngle) * NODE_RADIUS;
                    const ay = Math.sin(startAngle) * NODE_RADIUS;
                    const bx = Math.cos(endAngle) * NODE_RADIUS;
                    const by = Math.sin(endAngle) * NODE_RADIUS;
                    const largeArc = anglePerSegment > Math.PI ? 1 : 0;
                    const d = `M 0 0 L ${ax} ${ay} A ${NODE_RADIUS} ${NODE_RADIUS} 0 ${largeArc} 1 ${bx} ${by} Z`;
                    return (
                      <path
                        key={tt}
                        d={d}
                        fill={triggerMeta[tt].color}
                        stroke={nodeStroke}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                    );
                  })}
                </g>
              );
            };

            return (
              <g
                key={node.id}
                className="flow-node"
                data-node-id={node.id}
                transform={`translate(${node.x},${node.y})`}
                opacity={opacity}
                style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => handleNodeClick(e, node.id)}
                onDoubleClick={(e) => handleNodeDoubleClick(e, node.id)}
                onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
                onMouseEnter={(e) => {
                  const svg = svgRef.current!;
                  const rect = svg.getBoundingClientRect();
                  setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, flow: node });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {isSelected &&
                  (isPluginStep ? (
                    <polygon
                      points={HEX_POINTS(NODE_RADIUS + 6)}
                      fill="none"
                      stroke={primaryMeta.color}
                      strokeWidth={3}
                      opacity={0.5}
                    />
                  ) : isCustomApi ? (
                    <polygon
                      points={`0,${-(NODE_RADIUS + 8)} ${NODE_RADIUS + 8},0 0,${NODE_RADIUS + 8} ${-(NODE_RADIUS + 8)},0`}
                      fill="none"
                      stroke={primaryMeta.color}
                      strokeWidth={3}
                      opacity={0.5}
                    />
                  ) : isClassic ? (
                    <rect
                      x={-((NODE_RADIUS * 1.7) / 2 + 6)}
                      y={-((NODE_RADIUS * 1.7) / 2 + 6)}
                      width={NODE_RADIUS * 1.7 + 12}
                      height={NODE_RADIUS * 1.7 + 12}
                      rx={10}
                      fill="none"
                      stroke={primaryMeta.color}
                      strokeWidth={3}
                      opacity={0.5}
                    />
                  ) : (
                    <circle r={NODE_RADIUS + 6} fill="none" stroke={primaryMeta.color} strokeWidth={3} opacity={0.5} />
                  ))}
                {isSearchMatch &&
                  !isSelected &&
                  (isPluginStep ? (
                    <polygon
                      points={HEX_POINTS(NODE_RADIUS + 4)}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  ) : isCustomApi ? (
                    <polygon
                      points={`0,${-(NODE_RADIUS + 6)} ${NODE_RADIUS + 6},0 0,${NODE_RADIUS + 6} ${-(NODE_RADIUS + 6)},0`}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  ) : isClassic ? (
                    <rect
                      x={-((NODE_RADIUS * 1.7) / 2 + 4)}
                      y={-((NODE_RADIUS * 1.7) / 2 + 4)}
                      width={NODE_RADIUS * 1.7 + 8}
                      height={NODE_RADIUS * 1.7 + 8}
                      rx={8}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  ) : (
                    <circle
                      r={NODE_RADIUS + 4}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  ))}
                {renderNodeShape()}
                <g color={isSearchNode ? "#1f1f1f" : isActionNode ? "hsl(var(--background))" : "white"}>{iconPaths[primaryMeta.icon]}</g>
                <text
                  y={NODE_RADIUS + 16}
                  textAnchor="middle"
                  className="text-[11px] fill-foreground font-medium select-none pointer-events-none"
                  style={{ maxWidth: 120 }}
                >
                  {node.name.length > LABEL_MAX_LENGTH ? node.name.slice(0, LABEL_TRUNCATED_LENGTH) + "…" : node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 px-3 py-2 rounded-md border shadow-md text-xs max-w-100 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)", backgroundColor: tokens.colorNeutralBackground3 }}
        >
          <p className="font-semibold text-sm mb-2">{tooltip.flow.name}</p>

          <Tag appearance="filled" size="small" style={{ marginRight: 4, marginBottom: 4 }}>
            {processTypeMeta[tooltip.flow.processType]?.label ?? tooltip.flow.processType}
          </Tag>
          {tooltip.flow.triggerTable && (
            <Tag appearance="filled" size="small" style={{ marginRight: 4, marginBottom: 4 }}>
              {tooltip.flow.triggerTable}
            </Tag>
          )}
          {tooltip.flow.triggerTypes.map((tt) => (
            <Tag appearance="outline" size="small" style={{ marginRight: 4, marginBottom: 4 }} key={tt}>
              {tt === "custom-message" ? tooltip.flow.uniqueName?.replace("Microsoft.Dynamics.CRM.", "") : triggerMeta[tt].label}
            </Tag>
          ))}

          {tooltip.flow.updateColumns && (
            <p className="text-muted-foreground mt-1 text-xs break-all text-mono">Columns: {tooltip.flow.updateColumns.join(", ")}</p>
          )}
          {tooltip.flow.dataFilter && (
            <p className="text-muted-foreground mt-1 text-xs break-all text-mono">Filter: {tooltip.flow.dataFilter}</p>
          )}
        </div>
      )}

      {/* Settings button */}
      <button
        onClick={() => setShowSettings((s) => !s)}
        className="absolute top-3 right-3 p-2 rounded-md border border-border bg-background/90 hover:bg-muted transition-colors"
        title="Layout settings"
      >
        <Settings className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Export image button */}
      <button
        onClick={() => {
          if (!containerRef.current) return;
          toJpeg(containerRef.current, { quality: 0.95 })
            .then((dataUrl) => {
              const link = document.createElement("a");
              link.download = `flow-export-${Date.now()}.jpg`;
              link.href = dataUrl;
              link.click();
            })
            .catch(() => { });
        }}
        className="absolute top-3 right-[5.5rem] p-2 rounded-md border border-border bg-background/90 hover:bg-muted transition-colors"
        title="Export as JPEG"
      >
        <Camera className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Zoom to fit button */}
      <button
        onClick={handleZoomToFit}
        className="absolute top-3 right-12 p-2 rounded-md border border-border bg-background/90 hover:bg-muted transition-colors"
        title="Zoom to fit all nodes"
      >
        <Maximize2 className="h-4 w-4 text-muted-foreground" />
      </button>

      {showSettings && (
        <FlowSettingsPanel
          forceParams={forceParams}
          setForceParams={setForceParams}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
          dagreParams={dagreParams}
          setDagreParams={setDagreParams}
        />
      )}

      <FlowLegend />

      <FlowDetailDialog
        flow={detailFlow}
        environmentId={environmentId}
        onClose={() => setDetailFlow(null)}
        onHideFlow={onHideFlow}
      />

      <Menu
        open={ctxMenu.open}
        onOpenChange={(_, data) => setCtxMenu((prev) => ({ ...prev, open: data.open }))}
        positioning={{ positioningRef, position: "below", align: "start" }}
      >
        <MenuTrigger disableButtonEnhancement>
          <span style={{ position: "fixed", width: 0, height: 0 }} />
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <FlowItemMenuItems
              flow={ctxFlow}
              isHidden={!!(ctxMenu.nodeId && hiddenIds?.has(ctxMenu.nodeId))}
              isPermanentlyHidden={!!(ctxMenu.nodeId && permanentlyHiddenIds.has(ctxMenu.nodeId))}
              environmentId={environmentId}
              onToggleVisibility={onToggleVisibility}
              onShowOnlyRelated={onShowOnlyRelated}
              onShowOnlyDirect={onShowOnlyDirect}
              onTogglePermanentlyHidden={togglePermanentlyHidden}
              onShowDetails={(id) => {
                const f = flows.find((x) => x.id === id);
                if (f) setDetailFlow(f);
              }}
            />
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
}
