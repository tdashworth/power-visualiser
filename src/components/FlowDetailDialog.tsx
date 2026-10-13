import { useNavigate } from "react-router-dom";
import { ExternalLink, EyeOff, Search } from "lucide-react";
import { Process, triggerMeta, processTypeMeta } from "@/data/flows";
import { getFlowUrl } from "@/lib/flowHelpers";
import { Tag } from "@fluentui/react-components";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  flow: Process | null;
  environmentId: string | null;
  onClose: () => void;
  onHideFlow?: (id: string) => void;
}

export default function FlowDetailDialog({ flow, environmentId, onClose, onHideFlow }: Props) {
  const navigate = useNavigate();

  if (!flow) return null;

  const flowUrl = environmentId ? getFlowUrl(environmentId, flow.id) : null;

  const handleViewInboundFlows = () => {
    const params = new URLSearchParams();
    if (flow.triggerTable) params.set("entity", flow.triggerTable);
    if (flow.updateColumns && flow.updateColumns.length > 0) {
      params.set("columns", flow.updateColumns.join(", "));
    }
    if (flow.dataFilter?.trim()) {
      params.set("filter", flow.dataFilter.trim());
    }

    // Map trigger types to operation
    if (flow.triggerTypes.includes("dataverse-create")) {
      params.set("operation", "CreateRecord");
    } else if (flow.triggerTypes.includes("dataverse-update")) {
      params.set("operation", "UpdateRecord");
    } else if (flow.triggerTypes.includes("dataverse-delete")) {
      params.set("operation", "DeleteRecord");
    }

    onClose();
    navigate(`/where?${params.toString()}`);
  };

  return (
    <Dialog open={!!flow} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {flowUrl ? (
              <a
                href={flowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline inline-flex items-center gap-1.5 text-primary"
              >
                {flow.name}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              flow.name
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">Flow details</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Process type & execution mode */}
          <div className="flex items-center gap-2 flex-wrap">
            <Tag appearance="outline" size="small">
              {processTypeMeta[flow.processType]?.label ?? flow.processType}
            </Tag>
            {flow.executionMode && (
              <Tag appearance="filled" size="small">
                {flow.executionMode === "sync" ? "Synchronous" : "Asynchronous"}
              </Tag>
            )}
          </div>

          {/* Trigger types */}
          {flow.triggerTypes.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Triggers</p>
              <div className="flex flex-wrap gap-1.5">
                {flow.triggerTypes.map((tt) => (
                  <Tag
                    key={tt}
                    size="small"
                    style={{ backgroundColor: triggerMeta[tt].color, color: "#fff" }}
                  >
                    {triggerMeta[tt].label}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Custom API specifics */}
          {flow.processType === "custom-api" && (
            <>
              {flow.uniqueName && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Unique Name</p>
                  <p className="text-xs font-mono bg-muted rounded px-2 py-1">{flow.uniqueName}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Binding</p>
                <p className="text-xs font-mono bg-muted rounded px-2 py-1">
                  {flow.triggerTable ? `Bound · ${flow.triggerTable}` : "Global (unbound)"}
                </p>
              </div>
            </>
          )}

          {/* Trigger table (for flows/workflows) */}
          {flow.processType !== "custom-api" && flow.triggerTable && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Trigger Table</p>
              <p className="text-xs font-mono bg-muted rounded px-2 py-1">{flow.triggerTable}</p>
            </div>
          )}

          {/* Data filter */}
          {flow.dataFilter && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Data Filter</p>
              <p className="text-xs font-mono bg-muted rounded px-2 py-1 break-all">{flow.dataFilter}</p>
            </div>
          )}

          {/* Update columns */}
          {flow.updateColumns && flow.updateColumns.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Update Columns</p>
              <div className="flex flex-wrap gap-1">
                {flow.updateColumns.map((col) => (
                  <Tag key={col} appearance="filled" size="small">
                    {col}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Solutions */}
          {flow.solutions && flow.solutions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Solutions</p>
              <div className="flex flex-wrap gap-1">
                {flow.solutions.map((s) => (
                  <Tag key={s} appearance="filled" size="small">
                    {s}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* View Inbound Flows button */}
          {flow.processType !== "custom-api" && flow.triggerTable && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 mt-2"
              onClick={handleViewInboundFlows}
            >
              <Search className="h-3.5 w-3.5" />
              View Inbound Flows
            </Button>
          )}

          {/* Hide from map button */}
          {onHideFlow && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => {
                onHideFlow(flow.id);
                onClose();
              }}
            >
              <EyeOff className="h-3.5 w-3.5" />
              Hide from Map
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
