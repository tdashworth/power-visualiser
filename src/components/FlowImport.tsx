import React, { useCallback, useRef, useState } from "react";
import { FileArchive, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseSolutionZips, ParseResult } from "@/lib/solutionParser";
import { toast } from "@/lib/fluentToast";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  Text,
} from "@fluentui/react-components";
import { useFlowData } from "@/context/FlowDataContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FlowImport({ open, onOpenChange }: Props) {
  const { hasData, handleImport, handleClear } = useFlowData();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: File[]) => {
      const zips = files.filter((f) => f.name.endsWith(".zip"));
      if (zips.length === 0) {
        toast.error("Please upload .zip solution file(s)");
        return;
      }
      setIsLoading(true);
      setProgress({ current: 0, total: zips.length });

      try {
        const result: ParseResult = await parseSolutionZips(zips, (current, total) => {
          setProgress({ current, total });
        });
        handleImport(result);
        toast.success(
          `Imported ${result.processes.length} processes and ${result.edges.length} connections`
        );
        onOpenChange(false);
      } catch (err: any) {
        toast.error(`Failed to parse: ${err.message || "Unknown error"}`);
      }

      setIsLoading(false);
    },
    [handleImport]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) processFiles(files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) processFiles(files);
      e.target.value = "";
    },
    [processFiles]
  );

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Import Solution</DialogTitle>
            <DialogContent>
              <Text block style={{ marginBottom: 16 }}>
                {hasData
                  ? "Upload a Power Automate solution .zip file to replace the current data."
                  : "Upload a Power Automate solution .zip file to visualize flow dependencies."}
              </Text>

              <div className="space-y-2">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => !isLoading && inputRef.current?.click()}
                  className={`
                    relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors
                    ${isLoading ? "pointer-events-none opacity-60" : ""}
                    ${isDragOver ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"}
                  `}
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  ) : (
                    <FileArchive className="h-6 w-6 text-muted-foreground" />
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    {isLoading
                      ? `Parsing solution ${progress.current} of ${progress.total}…`
                      : <>Drop <span className="font-semibold text-foreground">.zip</span> solution file(s) here or click to browse</>
                    }
                  </p>
                  {isLoading && progress.total > 1 && (
                    <Progress value={(progress.current / progress.total) * 100} className="h-1.5 w-full" />
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".zip"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/70 text-center">
                  🔒 Your file never leaves your device — all processing happens locally in the browser.
                </p>

                {hasData && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground gap-1.5"
                    onClick={handleClear}
                  >
                    <X className="h-3 w-3" />
                    Clear existing data
                  </Button>
                )}
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
  );
}
