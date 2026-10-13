import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Button,
  Tooltip,
  Divider,
  tokens,
} from "@fluentui/react-components";
import {
  Map24Regular,
  DataLine24Regular,
  Flash24Regular,
  Search24Regular,
  CloudArrowUp24Regular,
  Mail24Regular,
  CloudDatabaseRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
  LocationRegular,
  Navigation24Regular,
  BugRegular,
  Table24Regular,
} from "@fluentui/react-icons";
import { useFlowData } from "@/context/FlowDataContext";
import FlowImport from "@/components/FlowImport";
import EnvironmentImportDialog from "@/components/EnvironmentImportDialog";
import { useTheme } from "next-themes";
import { useSearch } from "@/context/SearchContext";
import { useCodeApp } from "@/hooks/useCodeApp";
import { useDebugMode } from "@/hooks/useDebugMode";
import { usePersistedState } from "@/hooks/usePersistedState";

const EXPANDED_WIDTH = 220;
const COLLAPSED_WIDTH = 56;

export default function AppNavbar() {
  const [debugMode] = useDebugMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasData } = useFlowData();
  const { open: openSearch } = useSearch();
  const [isCodeApp] = useCodeApp();
  const [collapsed, setCollapsed] = usePersistedState<boolean>("nav-rail-collapsed", false);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname === path;

  const navItems = [
    { path: "/", label: "Map", icon: <Map24Regular /> },
    { path: "/insights", label: "Insights", icon: <DataLine24Regular /> },
    { path: "/what-if", label: "What If", icon: <Flash24Regular /> },
    { path: "/where", label: "Where", icon: <LocationRegular /> },
    { path: "/relationships", label: "Relationships", icon: <Table24Regular /> },
    ...(debugMode ? [{ path: "/debug", label: "Debug", icon: <BugRegular /> }] : []),
  ];

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width,
        transition: "width 200ms ease",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 8,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Tooltip
          content={collapsed ? "Expand menu" : "Collapse menu"}
          relationship="label"
          positioning="after"
          withArrow
        >
          <Button
            appearance="subtle"
            icon={<Navigation24Regular />}
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            style={{ justifyContent: "center", width: "100%", minWidth: 0 }}
          />
        </Tooltip>

        <Divider style={{ margin: "4px 0" }} />

        {debugMode ? (
          <>
            <ImportSolutionButton collapsed={collapsed} />
            <SelectAutomationsButton collapsed={collapsed} />
          </>
        ) : isCodeApp ? (
          <SelectAutomationsButton collapsed={collapsed} />
        ) : (
          <ImportSolutionButton collapsed={collapsed} />
        )}

        <RailItem
          collapsed={collapsed}
          label="Search"
          title="Search (Ctrl/Cmd+K)"
          icon={<Search24Regular />}
          disabled={!hasData}
          onClick={openSearch}
        />

        <Divider style={{ margin: "4px 0" }} />

        {navItems.map((item) => (
          <RailItem
            key={item.path}
            collapsed={collapsed}
            label={item.label}
            icon={item.icon}
            active={isActive(item.path)}
            onClick={() => navigate(item.path)}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: "auto",
        }}
      >
        <Divider style={{ margin: "4px 0" }} />

        <FeedbackButton collapsed={collapsed} />
        <ThemeButton collapsed={collapsed} />
      </div>
    </nav>
  );
}

interface RailItemProps {
  collapsed: boolean;
  label: string;
  icon: React.ReactElement;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  appearance?: "subtle" | "outline" | "secondary" | "primary";
}

function RailItem({
  collapsed,
  label,
  icon,
  onClick,
  active,
  disabled,
  title,
  appearance,
}: RailItemProps) {
  const resolvedAppearance = active ? "primary" : appearance ?? "subtle";
  const button = (
    <Button
      appearance={resolvedAppearance}
      icon={icon}
      onClick={onClick}
      disabled={disabled}
      title={collapsed ? title ?? label : title}
      aria-label={label}
      style={{
        justifyContent: collapsed ? "center" : "flex-start",
        width: "100%",
        minWidth: 0,
        paddingLeft: collapsed ? 0 : 8,
        paddingRight: collapsed ? 0 : 8,
      }}
    >
      {collapsed ? null : <span style={{ marginLeft: 4 }}>{label}</span>}
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip content={title ?? label} relationship="label" positioning="after" withArrow>
        {button}
      </Tooltip>
    );
  }
  return button;
}

const SelectAutomationsButton = ({ collapsed }: { collapsed: boolean }) => {
  const [envImportOpen, setEnvImportOpen] = useState(false);
  return (
    <>
      <RailItem
        collapsed={collapsed}
        label="Select automations"
        title="Select automations"
        icon={<CloudDatabaseRegular />}
        onClick={() => setEnvImportOpen(true)}
        appearance="outline"
      />
      <EnvironmentImportDialog open={envImportOpen} onOpenChange={setEnvImportOpen} />
    </>
  );
};

const ImportSolutionButton = ({ collapsed }: { collapsed: boolean }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RailItem
        collapsed={collapsed}
        label="Import solutions"
        title="Import solutions"
        icon={<CloudArrowUp24Regular />}
        onClick={() => setOpen(true)}
        appearance="outline"
      />
      <FlowImport open={open} onOpenChange={setOpen} />
    </>
  );
};

const FeedbackButton = ({ collapsed }: { collapsed: boolean }) => (
  <RailItem
    collapsed={collapsed}
    label="Feedback"
    title="Send Feedback"
    icon={<Mail24Regular />}
    onClick={() => {
      window.location.href =
        "mailto:github.support@tdashworth.uk?subject=" +
        encodeURIComponent("Power Visualiser Feedback");
    }}
  />
);

const ThemeButton = ({ collapsed }: { collapsed: boolean }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const nextTheme = () => {
    const order = ["system", "light", "dark"] as const;
    const idx = order.indexOf((theme as typeof order[number]) ?? "system");
    setTheme(order[(idx + 1) % order.length]);
  };

  const icon = resolvedTheme === "dark" ? <WeatherMoonRegular /> : <WeatherSunnyRegular />;

  return (
    <RailItem
      collapsed={collapsed}
      label="Theme"
      title={`Theme: ${theme}`}
      icon={icon}
      onClick={nextTheme}
    />
  );
};
