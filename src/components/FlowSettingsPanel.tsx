import React, { useCallback, useRef } from "react";
import { trackEvent } from "@/lib/appInsights";

type LayoutMode = "force" | "hierarchical";

interface Props {
  forceParams: { linkDistance: number; chargeStrength: number; collisionPadding: number };
  setForceParams: React.Dispatch<React.SetStateAction<Props["forceParams"]>>;
  layoutMode: LayoutMode;
  setLayoutMode: React.Dispatch<React.SetStateAction<LayoutMode>>;
  dagreParams: { nodesep: number; ranksep: number; rankdir: string };
  setDagreParams: React.Dispatch<React.SetStateAction<Props["dagreParams"]>>;
}

export default function FlowSettingsPanel({
  forceParams,
  setForceParams,
  layoutMode,
  setLayoutMode,
  dagreParams,
  setDagreParams,
}: Props) {
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const trackSettingChange = useCallback((setting: string, value: string | number) => {
    // Debounce slider changes to avoid flooding telemetry
    if (debounceRef.current[setting]) clearTimeout(debounceRef.current[setting]);
    debounceRef.current[setting] = setTimeout(() => {
      trackEvent("graph_setting_changed", { setting, value: String(value), layoutMode });
    }, 1000);
  }, [layoutMode]);

  const trackImmediateChange = useCallback((setting: string, value: string) => {
    trackEvent("graph_setting_changed", { setting, value });
  }, []);
  return (
    <div className="absolute top-12 right-3 w-56 bg-background/95 backdrop-blur border border-border rounded-lg p-3 space-y-3 text-xs shadow-lg z-40">
      <p className="font-semibold text-foreground text-sm">Settings</p>

      {/* Layout mode toggle */}
      <div className="border-t border-border pt-2 space-y-1.5">
        <span className="text-muted-foreground">Layout Mode</span>
        <div className="flex gap-1">
          {(["force", "hierarchical"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { setLayoutMode(mode); trackImmediateChange("layoutMode", mode); }}
              className={`flex-1 px-2 py-1.5 rounded-md border transition-colors text-[10px] capitalize ${
                layoutMode === mode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Layout params */}
      <div className="border-t border-border pt-2 space-y-2">
        <span className="text-muted-foreground">Layout</span>

        {layoutMode === "force" ? (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Link Distance</span>
                <span className="font-mono">{forceParams.linkDistance}</span>
              </div>
              <input type="range" min={80} max={150} step={1} value={forceParams.linkDistance}
                onChange={(e) => { const v = Number(e.target.value); setForceParams((p) => ({ ...p, linkDistance: v })); trackSettingChange("linkDistance", v); }}
                className="w-full accent-primary h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Repulsion</span>
                <span className="font-mono">{forceParams.chargeStrength}</span>
              </div>
              <input type="range" min={-200} max={-50} step={1} value={forceParams.chargeStrength}
                onChange={(e) => { const v = Number(e.target.value); setForceParams((p) => ({ ...p, chargeStrength: v })); trackSettingChange("chargeStrength", v); }}
                className="w-full accent-primary h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Collision Padding</span>
                <span className="font-mono">{forceParams.collisionPadding}</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={forceParams.collisionPadding}
                onChange={(e) => { const v = Number(e.target.value); setForceParams((p) => ({ ...p, collisionPadding: v })); trackSettingChange("collisionPadding", v); }}
                className="w-full accent-primary h-1.5" />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Direction</span>
              </div>
              <div className="flex gap-1">
                {(["LR", "TB"] as const).map((dir) => (
                  <button key={dir} onClick={() => { setDagreParams((p) => ({ ...p, rankdir: dir })); trackImmediateChange("rankdir", dir); }}
                    className={`flex-1 px-2 py-1 rounded-md border transition-colors text-[10px] ${
                      dagreParams.rankdir === dir
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    }`}>
                    {dir === "LR" ? "Left → Right" : "Top → Bottom"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Node Spacing</span>
                <span className="font-mono">{dagreParams.nodesep}</span>
              </div>
              <input type="range" min={20} max={200} step={5} value={dagreParams.nodesep}
                onChange={(e) => { const v = Number(e.target.value); setDagreParams((p) => ({ ...p, nodesep: v })); trackSettingChange("nodesep", v); }}
                className="w-full accent-primary h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Rank Spacing</span>
                <span className="font-mono">{dagreParams.ranksep}</span>
              </div>
              <input type="range" min={40} max={300} step={10} value={dagreParams.ranksep}
                onChange={(e) => { const v = Number(e.target.value); setDagreParams((p) => ({ ...p, ranksep: v })); trackSettingChange("ranksep", v); }}
                className="w-full accent-primary h-1.5" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
