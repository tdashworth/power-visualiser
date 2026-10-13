import { useMemo, useState } from "react";
import { useFlowData } from "@/context/FlowDataContext";
import { triggerMeta, TriggerType, ProcessType, processTypeMeta } from "@/data/flows";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FileArchive, GitBranch, Layers, Database, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardHeader, Tag } from "@fluentui/react-components";
import { makeStyles, typographyStyles } from '@fluentui/react-components';

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(30, 85%, 55%)",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(340, 65%, 50%)",
  "hsl(45, 80%, 50%)",
  "hsl(270, 55%, 55%)",
  "hsl(180, 50%, 45%)",
];

const useStyles = makeStyles({
  text: typographyStyles.subtitle1,
});

export default function Insights() {
  const styles = useStyles();
  const { allFlows, allEdges, hasData } = useFlowData();
  const [entitySort, setEntitySort] = useState<{ col: "name" | "count"; dir: "asc" | "desc" }>({
    col: "name",
    dir: "asc",
  });

  const toggleEntitySort = (col: "name" | "count") => {
    setEntitySort((prev) =>
      prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" },
    );
  };

  const SortIcon = ({ col }: { col: "name" | "count" }) => {
    if (entitySort.col !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return entitySort.dir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1 inline" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 inline" />
    );
  };

  const stats = useMemo(() => {
    if (!hasData) return null;

    const byTrigger = new Map<TriggerType, number>();
    const byEntity = new Map<string, number>();
    const byProcessType = new Map<ProcessType, number>();
    let activeCount = 0;
    let inactiveCount = 0;

    // Per-process-type trigger breakdowns
    const triggersByProcess = new Map<ProcessType, Map<TriggerType, number>>();

    allFlows.forEach((f) => {
      if (f.isActive === false) inactiveCount++;
      else activeCount++;
      const pt = f.processType ?? "cloud-flow";
      byProcessType.set(pt, (byProcessType.get(pt) ?? 0) + 1);

      if (!triggersByProcess.has(pt)) triggersByProcess.set(pt, new Map());
      const ptTriggers = triggersByProcess.get(pt)!;

      f.triggerTypes.forEach((t) => {
        byTrigger.set(t, (byTrigger.get(t) ?? 0) + 1);
        ptTriggers.set(t, (ptTriggers.get(t) ?? 0) + 1);
      });
      if (f.triggerTable) {
        byEntity.set(f.triggerTable, (byEntity.get(f.triggerTable) ?? 0) + 1);
      }
    });

    const optimisticEdges = allEdges.filter((e) => e.isOptimistic).length;
    const confirmedEdges = allEdges.length - optimisticEdges;

    return {
      totalFlows: allFlows.length,
      totalEdges: allEdges.length,
      optimisticEdges,
      confirmedEdges,
      activeCount,
      inactiveCount,
      byTrigger: [...byTrigger.entries()].sort((a, b) => b[1] - a[1]),
      byEntity: [...byEntity.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      byProcessType: [...byProcessType.entries()].sort((a, b) => b[1] - a[1]),
      triggersByProcess,
    };
  }, [allFlows, allEdges, hasData]);

  if (!hasData || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <FileArchive className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Import a solution to see insights.</p>
        </div>
      </div>
    );
  }

  const processTypeData = stats.byProcessType.map(([type, count]) => ({
    name: processTypeMeta[type]?.label ?? type,
    value: count,
  }));

  const stateData = [
    { name: "Active", value: stats.activeCount, color: "hsl(142, 71%, 45%)" },
    { name: "Inactive", value: stats.inactiveCount, color: "hsl(0, 72%, 51%)" },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <h1 className={styles.text}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Processes</p>
          </h1>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{stats.totalFlows}</span>
            </div>
          </div >
        </Card>
        <Card>
          <h1 className={styles.text}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Connections</p>
          </h1>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{stats.totalEdges}</span>
            </div>
          </div >
        </Card>
        <Card>
          <h1 className={styles.text}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Confirmed</p>
          </h1>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{stats.confirmedEdges}</span>
            </div>
          </div >
        </Card>
        <Card>
          <h1 className={styles.text}>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Optimistic</p>
              <HelpCircle className="h-3 w-3 text-muted-foreground" />
            </div>
          </h1>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold text-foreground">{stats.optimisticEdges}</span>
            </div>
          </div >
        </Card>
        <Card>
          <h1 className={styles.text}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Trigger Types</p>
          </h1>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{stats.byTrigger.length}</span>
            </div>
          </div >
        </Card>
        <Card>
          <h1 className={styles.text}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Entities</p>
          </h1>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{stats.byEntity.length}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h1 className={styles.text}>
            Processes by Type
          </h1>
          <div className="px-4 pb-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={processTypeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {processTypeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div >
        </Card>
        <Card>
          <h1 className={styles.text}>
            Active vs Inactive
          </h1>
          <div className="px-4 pb-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stateData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {stateData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div >
        </Card>
        {stats.byProcessType.map(([processType]) => {
          if (processType === "custom-api") return null;
          const triggers = stats.triggersByProcess.get(processType);
          if (!triggers || triggers.size === 0) return null;
          const data = [...triggers.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([t, count]) => ({ name: triggerMeta[t]?.label ?? t, value: count, color: triggerMeta[t]?.color }));

          return (
            <Card key={processType}>
              <h1 className={styles.text}>
                {processTypeMeta[processType]?.label ?? processType} — Triggers
              </h1>
              <div className="px-4 pb-4">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ name, value }) => `${name} (${value})`}
                      >
                        {data.map((entry, i) => (
                          <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div >
            </Card>
          );
        })}
      </div>

      {/* Processes by Entity — chart + table side by side */}
      <Card>
        <h1 className={styles.text}>
          Processes by Entity
        </h1>
        <div className="px-4 pb-4">
          {/* Pie chart — full width */}
          <div className="h-[450px] mb-6">
            {stats.byEntity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.byEntity.map(([name, value]) => ({ name, value }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={140}
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={{ strokeWidth: 0.5 }}
                  >
                    {stats.byEntity.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No entity data
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-auto max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleEntitySort("name")}
                  >
                    Entity Name <SortIcon col="name" />
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleEntitySort("count")}
                  >
                    Process Count <SortIcon col="count" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const sorted = [...stats.byEntity].sort((a, b) => {
                    const m = entitySort.dir === "asc" ? 1 : -1;
                    return entitySort.col === "name" ? a[0].localeCompare(b[0]) * m : (a[1] - b[1]) * m;
                  });
                  return sorted.map(([entity, count]) => (
                    <TableRow key={entity}>
                      <TableCell className="font-medium">{entity}</TableCell>
                      <TableCell className="text-right">
                        <Tag appearance="brand" size="small">{count}</Tag>
                      </TableCell>
                    </TableRow>
                  ));
                })()}
                {stats.byEntity.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No entity-triggered processes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
}
