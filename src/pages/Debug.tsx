import { ScrollArea } from "@/components/ui/scroll-area";

const STORAGE_KEY = "flow-visualizer-data";

export default function Debug() {
  let formatted = "No data stored.";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      formatted = JSON.stringify(JSON.parse(raw), null, 2);
    }
  } catch (e) {
    formatted = `Error parsing stored data: ${e}`;
  }

  return (
    <div className="flex-1 min-h-0 p-4">
      <ScrollArea className="h-full w-full rounded-lg border border-border bg-muted/30">
        <pre className="p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
          {formatted}
        </pre>
      </ScrollArea>
    </div>
  );
}
