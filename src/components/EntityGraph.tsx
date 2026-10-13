import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tokens, Button, Tooltip, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem } from "@fluentui/react-components";
import { ArrowMaximize24Regular, Flowchart24Regular, Molecule24Regular, EyeOff20Regular } from "@fluentui/react-icons";
import dagre from "dagre";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import type { EntityRelationship, EntityTable } from "@/data/flows";
import { cascadeLabels } from "@/data/flows";
import { usePersistedState } from "@/hooks/usePersistedState";

interface SimNode extends SimulationNodeDatum, EntityTable {
  x: number;
  y: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  rel: EntityRelationship;
  curveIndex: number;
}

interface Props {
  tables: EntityTable[];
  relationships: EntityRelationship[];
  selectedTableId: string | null;
  onSelectTable: (id: string | null) => void;
  onHideTable?: (id: string) => void;
}

const NODE_RX = 62;
const NODE_RY = 24;
const CANVAS_W = 900;
const CANVAS_H = 600;

type EntityLayoutMode = "force" | "hierarchical";

/** Point where a ray from (fromX, fromY) toward the node centre meets the node's rect border. */
function rectEdgePoint(cx: number, cy: number, fromX: number, fromY: number) {
  const dx = cx - fromX;
  const dy = cy - fromY;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = Math.min(
    dx === 0 ? Infinity : NODE_RX / Math.abs(dx),
    dy === 0 ? Infinity : NODE_RY / Math.abs(dy),
  );
  return { x: cx - dx * scale, y: cy - dy * scale };
}


export default function EntityGraph({ tables, relationships, selectedTableId, onSelectTable, onHideTable }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const panRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; rel: EntityRelationship } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; node: SimNode } | null>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const [layoutMode, setLayoutMode] = usePersistedState<EntityLayoutMode>("relationships.layoutMode", "force");

  const layoutKey = useMemo(
    () => layoutMode + "::" + tables.map((t) => t.id).join("|") + "::" + relationships.map((r) => r.name).join("|"),
    [tables, relationships, layoutMode],
  );

  useEffect(() => {
    const simNodes: SimNode[] = tables.map((t, i) => ({
      ...t,
      x: CANVAS_W / 2 + Math.cos((i / Math.max(tables.length, 1)) * Math.PI * 2) * 200,
      y: CANVAS_H / 2 + Math.sin((i / Math.max(tables.length, 1)) * Math.PI * 2) * 200,
    }));
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const pairCount = new Map<string, number>();
    const simLinks: SimLink[] = relationships
      .filter((r) => nodeMap.has(r.referencingTable) && nodeMap.has(r.referencedTable))
      .map((r) => {
        const key = [r.referencingTable, r.referencedTable].sort().join("::");
        const idx = pairCount.get(key) ?? 0;
        pairCount.set(key, idx + 1);
        return {
          source: nodeMap.get(r.referencingTable)!,
          target: nodeMap.get(r.referencedTable)!,
          rel: r,
          curveIndex: idx,
        };
      });

    if (layoutMode === "hierarchical") {
      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: "BT", nodesep: 40, ranksep: 100, marginx: 40, marginy: 40 });
      g.setDefaultEdgeLabel(() => ({}));
      simNodes.forEach((n) => g.setNode(n.id, { width: NODE_RX * 2, height: NODE_RY * 2 }));
      simLinks.forEach((l) => {
        const s = (l.source as SimNode).id;
        const t = (l.target as SimNode).id;
        if (s !== t) g.setEdge(s, t);
      });
      dagre.layout(g);
      simNodes.forEach((n) => {
        const pos = g.node(n.id);
        if (pos) {
          n.x = pos.x;
          n.y = pos.y;
          n.fx = pos.x;
          n.fy = pos.y;
        }
      });
      simRef.current = null;
      setNodes([...simNodes]);
      setLinks([...simLinks]);
      return;
    }

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(200),
      )
      .force("charge", forceManyBody().strength(-500))
      .force("center", forceCenter(CANVAS_W / 2, CANVAS_H / 2))
      .force("collide", forceCollide(90))
      .alpha(1);

    simRef.current = sim;
    sim.on("tick", () => {
      setNodes([...simNodes]);
      setLinks([...simLinks]);
    });

    return () => {
      sim.stop();
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);


  const zoomToFit = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || nodes.length === 0) return;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    nodes.forEach((n) => {
      minX = Math.min(minX, n.x - NODE_RX);
      maxX = Math.max(maxX, n.x + NODE_RX);
      minY = Math.min(minY, n.y - NODE_RY);
      maxY = Math.max(maxY, n.y + NODE_RY);
    });
    const w = svg.clientWidth;
    const h = svg.clientHeight;
    const scale = Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1), 1) * 0.9;
    setTransform({
      x: w / 2 - ((minX + maxX) / 2) * scale,
      y: h / 2 - ((minY + maxY) / 2) * scale,
      k: scale,
    });
  }, [nodes]);

  // Fit once the initial layout settles
  const fittedKey = useRef<string>("");
  useEffect(() => {
    if (nodes.length === 0 || fittedKey.current === layoutKey) return;
    const t = setTimeout(() => {
      fittedKey.current = layoutKey;
      zoomToFit();
    }, 600);
    return () => clearTimeout(t);
  }, [nodes, layoutKey, zoomToFit]);

  const connectedIds = useMemo(() => {
    if (!selectedTableId) return null;
    const set = new Set<string>([selectedTableId]);
    relationships.forEach((r) => {
      if (r.referencingTable === selectedTableId) set.add(r.referencedTable);
      if (r.referencedTable === selectedTableId) set.add(r.referencingTable);
    });
    return set;
  }, [selectedTableId, relationships]);

  const toLocal = (e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - transform.x) / transform.k,
      y: (e.clientY - rect.top - transform.y) / transform.k,
    };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setTransform((t) => {
      const k = Math.min(Math.max(t.k * factor, 0.1), 4);
      return { k, x: mx - ((mx - t.x) / t.k) * k, y: my - ((my - t.y) / t.k) * k };
    });
  };

  const movedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    movedRef.current = false;
    panRef.current = { startX: e.clientX, startY: e.clientY, tx: transform.x, ty: transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current) {
      const { x, y } = toLocal(e);
      const node = nodes.find((n) => n.id === dragRef.current!.id);
      if (node) {
        node.fx = x;
        node.fy = y;
        node.x = x;
        node.y = y;
        if (simRef.current) simRef.current.alpha(0.3).restart();
        else setNodes((prev) => [...prev]);
      }
      return;
    }
    const pan = panRef.current;
    if (pan) {
      if (Math.abs(e.clientX - pan.startX) > 3 || Math.abs(e.clientY - pan.startY) > 3) movedRef.current = true;
      const nx = pan.tx + (e.clientX - pan.startX);
      const ny = pan.ty + (e.clientY - pan.startY);
      setTransform((t) => ({ ...t, x: nx, y: ny }));
    }
  };

  const endInteraction = () => {
    panRef.current = null;
    dragRef.current = null;
  };

  const edgeColor = tokens.colorNeutralStroke1;
  const highlight = tokens.colorBrandStroke1;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2, display: "flex", gap: 4 }}>
        <Tooltip content={layoutMode === "force" ? "Switch to hierarchical layout" : "Switch to force layout"} relationship="label">
          <Button
            appearance="subtle"
            icon={layoutMode === "force" ? <Flowchart24Regular /> : <Molecule24Regular />}
            onClick={() => setLayoutMode(layoutMode === "force" ? "hierarchical" : "force")}
          />
        </Tooltip>
        <Tooltip content="Zoom to fit" relationship="label">
          <Button appearance="subtle" icon={<ArrowMaximize24Regular />} onClick={zoomToFit} />
        </Tooltip>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: "block", cursor: panRef.current ? "grabbing" : "grab", backgroundColor: tokens.colorNeutralBackground1 }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endInteraction}
        onMouseLeave={endInteraction}
        onClick={(e) => {
          if (movedRef.current) return;
          if (e.target === svgRef.current) onSelectTable(null);
        }}
      >
        <defs>
          <marker id="er-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
          </marker>
          <marker id="er-arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={highlight} />
          </marker>
          <marker id="er-arrow-start" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
          </marker>
          <marker id="er-arrow-start-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={highlight} />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {links.map((l, i) => {
            const s = l.source as SimNode;
            const t = l.target as SimNode;
            const isHl =
              !!selectedTableId && (l.rel.referencingTable === selectedTableId || l.rel.referencedTable === selectedTableId);
            const dim = !!selectedTableId && !isHl;
            const mx = (s.x + t.x) / 2;
            const my = (s.y + t.y) / 2;
            const offset = (l.curveIndex % 2 === 0 ? 1 : -1) * Math.ceil(l.curveIndex / 2) * 40;
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const len = Math.hypot(dx, dy) || 1;
            const cx = mx + (-dy / len) * offset;
            const cy = my + (dx / len) * offset;
            // Trim the ends so the arrow heads sit on the node borders.
            const start = rectEdgePoint(s.x, s.y, cx, cy);
            const end = rectEdgePoint(t.x, t.y, cx, cy);
            const isM2M = l.rel.relationshipType === "ManyToMany";
            return (
              <path
                key={l.rel.name + i}
                d={`M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`}
                fill="none"
                stroke={isHl ? highlight : edgeColor}
                strokeWidth={isHl ? 2.5 : 1.5}
                strokeDasharray={isM2M ? "6 4" : undefined}
                opacity={dim ? 0.15 : 0.9}
                markerEnd={isHl ? "url(#er-arrow-hl)" : "url(#er-arrow)"}
                markerStart={isM2M ? (isHl ? "url(#er-arrow-start-hl)" : "url(#er-arrow-start)") : undefined}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, rel: l.rel })}
                onMouseLeave={() => setTooltip(null)}

              />
            );
          })}

          {nodes.map((n) => {
            const isSelected = n.id === selectedTableId;
            const dim = !!connectedIds && !connectedIds.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                opacity={dim ? 0.25 : 1}
                style={{ cursor: "pointer" }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  dragRef.current = { id: n.id };
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTooltip(null);
                  setMenu({ x: e.clientX, y: e.clientY, node: n });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTable(isSelected ? null : n.id);
                }}
              >
                <rect
                  x={-NODE_RX}
                  y={-NODE_RY}
                  width={NODE_RX * 2}
                  height={NODE_RY * 2}
                  rx={6}
                  fill={n.inSolution ? tokens.colorBrandBackground2 : tokens.colorNeutralBackground3}
                  stroke={isSelected ? highlight : tokens.colorNeutralStroke1}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeDasharray={n.isSystem ? "4 3" : undefined}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill={tokens.colorNeutralForeground1}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {n.name.length > 18 ? n.name.slice(0, 17) + "…" : n.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {menu && (
        <Menu
          open
          onOpenChange={(_, d) => {
            if (!d.open) setMenu(null);
          }}
          positioning={{
            target: {
              getBoundingClientRect: () =>
                new DOMRect(menu.x, menu.y, 1, 1),
            } as HTMLElement,
          }}
        >
          <MenuTrigger disableButtonEnhancement>
            <span />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem
                icon={<EyeOff20Regular />}
                onClick={() => {
                  onHideTable?.(menu.node.id);
                  if (selectedTableId === menu.node.id) onSelectTable(null);
                  setMenu(null);
                }}
                disabled={!onHideTable}
              >
                Hide {menu.node.name}
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      )}



      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -110%)",
            backgroundColor: tokens.colorNeutralBackground3,
            border: `1px solid ${tokens.colorNeutralStroke1}`,
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            pointerEvents: "none",
            zIndex: 10,
            maxWidth: 320,
            boxShadow: tokens.shadow8,
          }}
        >
          <div style={{ fontWeight: 600 }}>{tooltip.rel.name}</div>
          <div style={{ color: tokens.colorNeutralForeground3 }}>
            {tooltip.rel.relationshipType} · {tooltip.rel.referencingTableName} → {tooltip.rel.referencedTableName}
          </div>
          {tooltip.rel.referencingAttribute && (
            <div style={{ color: tokens.colorNeutralForeground3 }}>Lookup: {tooltip.rel.referencingAttribute}</div>
          )}
          <div style={{ marginTop: 4 }}>
            {(Object.keys(cascadeLabels) as (keyof typeof cascadeLabels)[]).map((k) => (
              <div key={k} style={{ color: tokens.colorNeutralForeground3 }}>
                {cascadeLabels[k]}: {tooltip.rel[k]}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
