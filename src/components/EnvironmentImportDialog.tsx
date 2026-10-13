import { useEffect, useState } from "react";
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tab,
  TabList,
  Text,
  Combobox,
  Option,
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Tag,
  TagGroup,
  tokens,
  Spinner,
  type SelectTabEvent,
  type SelectTabData,
  type TabValue,
  SkeletonItem,
} from "@fluentui/react-components";
import {
  AppsList24Regular,
  Person24Regular,
  Globe24Regular,
  Info20Regular,
} from "@fluentui/react-icons";
import { PublishersService } from "@/generated/services/PublishersService";
import { SolutionsService } from "@/generated/services/SolutionsService";
import { Skeleton } from "./ui/skeleton";
import { scanEnvironmentGlobal } from "@/lib/environmentScanner";
import { ParseResult } from "@/lib/solutionParser";
import { useFlowData } from "@/context/FlowDataContext";
import { toast } from "@/lib/fluentToast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "solution" | "publisher" | "everything";

export default function EnvironmentImportDialog({ open, onOpenChange }: Props) {
  const [mode, setMode] = useState<Mode>("solution");
  const [selectedSolutions, setSelectedSolutions] = useState<string[]>([]);
  const [selectedPublishers, setSelectedPublishers] = useState<string[]>([]);
  const [solutionQuery, setSolutionQuery] = useState("");
  const [publisherQuery, setPublisherQuery] = useState("");
  const [publishers, setPublishers] = useState<{ friendlyName: string, publisherId: string, prefix: string }[]>([]);
  const [solutions, setSolutions] = useState<{ friendlyName: string, solutionId: string, uniqueName: string }[]>([]);
  const [fetchPublisherError, setFetchPublisherError] = useState<string | null>(null);
  const [fetchSolutionError, setFetchSolutionError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const { hasData, handleImport, handleClear } = useFlowData();

  useEffect(() => {
    const fetchPublishers = async () => {
      setFetchPublisherError(null);
      try {

        const result = await PublishersService.getAll({
          select: ["friendlyname", "publisherid", "customizationprefix"],
        });

        if (!result.success) {
          setFetchPublisherError(result.error.message || "Failed to fetch publishers.");
          return;
        }

        setPublishers(result.data.map((p) => ({
          friendlyName: p.friendlyname,
          publisherId: p.publisherid,
          prefix: p.customizationprefix
        })));
      } catch (error) {
        setFetchPublisherError(error.message || "An unexpected error occurred while fetching publishers.");
      }
    };

    const fetchSolutions = async () => {
      setFetchSolutionError(null);

      const result = await SolutionsService.getAll({
        select: ["friendlyname", "solutionid", "uniquename"],
      });

      if (!result.success) {
        setFetchSolutionError(result.error.message || "Failed to fetch solutions.");
        return;
      }

      setSolutions(result.data.map((s) => ({
        friendlyName: s.friendlyname,
        solutionId: s.solutionid,
        uniqueName: s.uniquename
      })));
    };

    if (open) {
      fetchPublishers();
      fetchSolutions();
    }
  }, [open, setPublishers, setSolutions]);

  const onTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
    setMode(data.value as Mode);
  };

  const canScan =
    (mode === "solution" && selectedSolutions.length > 0) ||
    (mode === "publisher" && selectedPublishers.length > 0) ||
    mode === "everything";

  const reset = () => {
    setSelectedSolutions([]);
    setSelectedPublishers([]);
    setSolutionQuery("");
    setPublisherQuery("");
    setIsScanning(false);
  };

  const onScanEnvironment = async () => {
    setIsScanning(true);
    try {
      const result: ParseResult = await scanEnvironmentGlobal();
      handleImport(result);
      toast.success(
        `Imported ${result.processes.length} processes and ${result.edges.length} connections`
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Failed to parse: ${err.message || "Unknown error"}`);
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        onOpenChange(data.open);
        if (!data.open) reset();
      }}
    >
      <DialogSurface style={{ maxWidth: 560 }}>
        <DialogBody>
          <DialogTitle>Import from Environment</DialogTitle>
          <DialogContent>
            <Text
              block
              style={{ marginBottom: 16, color: tokens.colorNeutralForeground3 }}
            >
              Select components directly from your Power Platform environment.
              Choose how you'd like to scope the scan.
            </Text>

            <TabList
              selectedValue={mode as TabValue}
              onTabSelect={onTabSelect}
              style={{ marginBottom: 16 }}
            >
              <Tab value="solution" icon={<AppsList24Regular />}>
                By solution
              </Tab>
              <Tab value="publisher" icon={<Person24Regular />}>
                By publisher
              </Tab>
              <Tab value="everything" icon={<Globe24Regular />}>
                Everything
              </Tab>
            </TabList>

            {mode === "solution" && fetchSolutionError !== null && (
              <MessageBar intent="error" style={{ marginBottom: 16 }}>
                <MessageBarBody>
                  <MessageBarTitle>Failed fetching solutions</MessageBarTitle>
                  {fetchSolutionError}
                </MessageBarBody>
              </MessageBar>
            )}
            {mode === "solution" && (
              <Field
                label="Solutions"
                hint="Pick one or more solutions to scan."
              >
                {solutions ? (
                  <Combobox
                    multiselect
                    placeholder="Search solutions…"
                    value={solutionQuery}
                    selectedOptions={selectedSolutions}
                    onOptionSelect={(_, data) => {
                      setSelectedSolutions(data.selectedOptions);
                      setSolutionQuery("");
                    }}
                    onChange={(e) => setSolutionQuery(e.target.value)}
                  >
                    {solutions.filter((s) =>
                      s.friendlyName.toLowerCase().includes(solutionQuery.toLowerCase()),
                    ).map((s) => (
                      <Option key={s.solutionId} value={s.solutionId}>
                        {s.friendlyName}
                      </Option>
                    ))}
                  </Combobox>
                ) : (
                  <Skeleton aria-label="Loading Content">
                    <SkeletonItem size={32} />
                  </Skeleton>
                )}
                {selectedSolutions.length > 0 && (
                  <TagGroup
                    onDismiss={(_, data) =>
                      setSelectedSolutions((prev) =>
                        prev.filter((v) => v !== data.value),
                      )
                    }
                    style={{ marginTop: 8, flexWrap: "wrap", gap: 4 }}
                  >
                    {selectedSolutions.map((s) => (
                      <Tag key={s} value={s} dismissible shape="rounded">
                        {solutions.find((sol) => sol.solutionId === s)?.friendlyName || s}
                      </Tag>
                    ))}
                  </TagGroup>
                )}
              </Field>
            )}

            {mode === "publisher" && fetchPublisherError !== null && (
              <MessageBar intent="error" style={{ marginBottom: 16 }}>
                <MessageBarBody>
                  <MessageBarTitle>Failed to fetch publishers</MessageBarTitle>
                  {fetchPublisherError}
                </MessageBarBody>
              </MessageBar>
            )}
            {mode === "publisher" && (
              <Field
                label="Publishers"
                hint="All solutions owned by the selected publishers will be scanned."
              >
                <Combobox
                  multiselect
                  placeholder="Search publishers…"
                  value={publisherQuery}
                  selectedOptions={selectedPublishers}
                  onOptionSelect={(_, data) => {
                    setSelectedPublishers(data.selectedOptions);
                    setPublisherQuery("");
                  }}
                  onChange={(e) => setPublisherQuery(e.target.value)}
                >
                  {publishers.filter((p) =>
                    p.friendlyName.toLowerCase().includes(publisherQuery.toLowerCase()),
                  ).map((p) => (
                    <Option key={p.publisherId} value={p.publisherId}>
                      {`${p.friendlyName} (${p.prefix})`}
                    </Option>
                  ))}
                </Combobox>
                {selectedPublishers.length > 0 && (
                  <TagGroup
                    onDismiss={(_, data) =>
                      setSelectedPublishers((prev) =>
                        prev.filter((v) => v !== data.value),
                      )
                    }
                    style={{ marginTop: 8, flexWrap: "wrap", gap: 4 }}
                  >
                    {selectedPublishers.map((p) => (
                      <Tag key={p} value={p} dismissible shape="rounded">
                        {publishers.find((pub) => pub.publisherId === p)?.friendlyName || p}
                      </Tag>
                    ))}
                  </TagGroup>
                )}
              </Field>
            )}

            {mode === "everything" && (
              <MessageBar intent="warning">
                <MessageBarBody>
                  <MessageBarTitle>Full environment scan</MessageBarTitle>
                  This will discover every cloud flow, classic workflow, plug-in
                  step and custom API in the environment. It may take a while on
                  large tenants.
                </MessageBarBody>
              </MessageBar>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                marginTop: 16,
                padding: 12,
                borderRadius: 6,
                background: tokens.colorNeutralBackground2,
              }}
            >
              <Info20Regular
                style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}
              />
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                Connects live to your Dataverse environment using your signed-in
                account. Nothing is uploaded anywhere.
              </Text>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => onOpenChange(false)} disabled={isScanning}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!canScan || isScanning}
              onClick={onScanEnvironment}
              icon={isScanning ? <Spinner size="tiny" /> : undefined}
            >
              {isScanning
                ? "Scanning…"
                : mode === "everything"
                  ? "Scan environment"
                  : "Scan selected"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
