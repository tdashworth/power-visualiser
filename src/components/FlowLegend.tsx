import { triggerMeta, processTypeMeta } from "@/data/flows";
import { tokens } from "@fluentui/react-components";

export default function FlowLegend() {
  return (
    <div className="absolute bottom-3 right-3 flex flex-col gap-1 border border-border rounded-md px-3 py-2 text-xs" style={{ backgroundColor: tokens.colorNeutralBackground3 }}>
      {Object.entries(triggerMeta).map(([key, meta]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: meta.color }} />
          <span className="text-muted-foreground">{meta.label}</span>
        </div>
      ))}
      <div className="border-t border-border my-1" />
      {Object.entries(processTypeMeta).map(([key, meta]) => (
        <div key={key} className="flex items-center gap-2">
          {meta.shape === "diamond" ? (
            <svg width="12" height="12" className="shrink-0">
              <polygon points="6,1 11,6 6,11 1,6" fill="hsl(var(--muted-foreground))" />
            </svg>
          ) : meta.shape === "hexagon" ? (
            <svg width="12" height="12" className="shrink-0" viewBox="-6 -6 12 12">
              <polygon
                points="0,-5.5 4.76,-2.75 4.76,2.75 0,5.5 -4.76,2.75 -4.76,-2.75"
                fill="hsl(var(--muted-foreground))"
              />
            </svg>
          ) : (
            <span
              className="inline-block w-3 h-3"
              style={{
                background: "hsl(var(--muted-foreground))",
                borderRadius: meta.shape === "circle" ? "50%" : "2px",
              }}
            />
          )}
          <span className="text-muted-foreground">{meta.label}</span>
        </div>
      ))}
      <div className="border-t border-border my-1" />
      <div className="flex items-center gap-2">
        <svg width="24" height="4" className="shrink-0">
          <line x1="0" y1="2" x2="24" y2="2" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
        </svg>
        <span className="text-muted-foreground">Sync</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="24" height="4" className="shrink-0">
          <line x1="0" y1="2" x2="24" y2="2" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeDasharray="6 3" />
        </svg>
        <span className="text-muted-foreground">Async</span>
      </div>
    </div>
  );
}
