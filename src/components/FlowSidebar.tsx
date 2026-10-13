import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Process, TriggerType, ProcessType, triggerMeta, processTypeMeta } from "@/data/flows";
import { Search, Filter, Eye, Layers, Info, Power } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StateFilter = "all" | "active" | "inactive";

interface Props {
  flows: Process[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  triggerFilters: Set<TriggerType>;
  onTriggerFilterChange: (t: TriggerType, checked: boolean) => void;
  processTypeFilters: Set<ProcessType>;
  onProcessTypeFilterChange: (t: ProcessType, checked: boolean) => void;
  hiddenFlowIds: Set<string>;
  onToggleFlowVisibility: (id: string) => void;
  hideOptimistic: boolean;
  onHideOptimisticChange: (v: boolean) => void;
  stateFilter: StateFilter;
  onStateFilterChange: (v: StateFilter) => void;
}

export default function FlowSidebar({
  flows,
  searchQuery,
  onSearchChange,
  triggerFilters,
  onTriggerFilterChange,
  processTypeFilters,
  onProcessTypeFilterChange,
  hiddenFlowIds,
  onToggleFlowVisibility,
  hideOptimistic,
  onHideOptimisticChange,
  stateFilter,
  onStateFilterChange,
}: Props) {
  const triggerTypes = Object.keys(triggerMeta) as TriggerType[];
  const processTypes = Object.keys(processTypeMeta) as ProcessType[];

  return (
    <aside className="w-72 shrink-0 h-full overflow-y-auto border-r border-border bg-background p-4 flex flex-col gap-6 max-md:w-full max-md:border-r-0">
      {/* Search */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          <Search className="h-3.5 w-3.5" /> Search
        </Label>
        <Input
          placeholder="Search by name or table…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 text-sm"
        />
      </div>

      {/* Filter by process type */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          <Layers className="h-3.5 w-3.5" /> Process Type
        </Label>
        <div className="space-y-2">
          {processTypes.map((pt) => (
            <label key={pt} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={processTypeFilters.has(pt)}
                onCheckedChange={(checked) => onProcessTypeFilterChange(pt, !!checked)}
              />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                {processTypeMeta[pt].label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Filter by trigger */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          <Filter className="h-3.5 w-3.5" /> Trigger Type
        </Label>
        <div className="space-y-2">
          {triggerTypes.map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={triggerFilters.has(t)}
                onCheckedChange={(checked) => onTriggerFilterChange(t, !!checked)}
              />
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: triggerMeta[t].color }}
              />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                {triggerMeta[t].label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* State filter */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          <Power className="h-3.5 w-3.5" /> Status
        </Label>
        <Select value={stateFilter} onValueChange={(v) => onStateFilterChange(v as StateFilter)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hide optimistic toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="hide-optimistic" className="text-xs cursor-pointer select-none">
            Hide optimistic edges
          </Label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px] text-xs">
                Optimistic edges are inferred when there isn't enough action data to fully verify the trigger filter — the match is assumed but not confirmed.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch
          id="hide-optimistic"
          checked={hideOptimistic}
          onCheckedChange={onHideOptimisticChange}
          className="scale-90"
        />
      </div>

      {/* Show/hide flows */}
      <div className="space-y-2 flex-1 min-h-0">
        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          <Eye className="h-3.5 w-3.5" /> Processes
        </Label>
        <div className="space-y-1 overflow-y-auto max-h-[40vh] pr-1">
          {flows
            .filter((f) => !searchQuery.trim() || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || (f.triggerTable?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false))
            .map((f) => (
            <label
              key={f.id}
              className="flex items-start gap-2 cursor-pointer py-1 px-1 rounded hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={!hiddenFlowIds.has(f.id)}
                onCheckedChange={() => onToggleFlowVisibility(f.id)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <span className="text-sm text-foreground leading-tight block truncate">{f.name}</span>
                <span className="flex items-center gap-1 mt-0.5">
                  {f.triggerTypes.map((tt) => (
                    <span key={tt} className="flex items-center gap-0.5">
                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: triggerMeta[tt].color }} />
                      <span className="text-[10px] text-muted-foreground">{triggerMeta[tt].label}</span>
                    </span>
                  ))}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}