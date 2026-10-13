import React from "react";
import { MenuItem, MenuDivider } from "@fluentui/react-components";
import {
  Copy20Regular,
  Eye20Regular,
  EyeOff20Regular,
  Info20Regular,
  Open20Regular,
  PeopleTeam20Regular,
  Person20Regular,
  Prohibited20Regular,
} from "@fluentui/react-icons";
import { Process } from "@/data/flows";

interface FlowItemMenuItemsProps {
  flow: Process | null;
  isHidden: boolean;
  isPermanentlyHidden?: boolean;
  environmentId?: string | null;
  onToggleVisibility?: (id: string) => void;
  onShowOnlyRelated?: (id: string) => void;
  onShowOnlyDirect?: (id: string) => void;
  onTogglePermanentlyHidden?: (id: string) => void;
  onShowDetails?: (id: string) => void;
  /** If true, stop propagation on item clicks (needed when menu lives inside a clickable list row). */
  stopPropagation?: boolean;
}

/**
 * Reusable menu items for a flow/process. Render as children of a Fluent <MenuList>.
 * Used by both the FluentProcessList row menu and the FlowGraph node context menu.
 */
export default function FlowItemMenuItems({
  flow,
  isHidden,
  isPermanentlyHidden = false,
  environmentId,
  onToggleVisibility,
  onShowOnlyRelated,
  onShowOnlyDirect,
  onTogglePermanentlyHidden,
  onShowDetails,
  stopPropagation = false,
}: FlowItemMenuItemsProps) {
  if (!flow) return null;

  const handle = (fn?: () => void) => (e: React.MouseEvent | React.KeyboardEvent) => {
    if (stopPropagation) e.stopPropagation();
    fn?.();
  };

  return (
    <>
      {onShowDetails && (
        <MenuItem icon={<Info20Regular />} onClick={handle(() => onShowDetails(flow.id))}>
          Show details
        </MenuItem>
      )}
      <MenuItem
        icon={isHidden ? <Eye20Regular /> : <EyeOff20Regular />}
        onClick={handle(() => onToggleVisibility?.(flow.id))}
        disabled={isPermanentlyHidden}
      >
        {isHidden ? "Show" : "Hide"}
      </MenuItem>
      <MenuItem
        icon={<Person20Regular />}
        onClick={handle(() => onShowOnlyDirect?.(flow.id))}
        disabled={isPermanentlyHidden}
      >
        Only show direct
      </MenuItem>
      <MenuItem
        icon={<PeopleTeam20Regular />}
        onClick={handle(() => onShowOnlyRelated?.(flow.id))}
        disabled={isPermanentlyHidden}
      >
        Only show related
      </MenuItem>
      {onTogglePermanentlyHidden && (
        <>
          <MenuDivider />
          <MenuItem
            icon={isPermanentlyHidden ? <Eye20Regular /> : <Prohibited20Regular />}
            onClick={handle(() => onTogglePermanentlyHidden(flow.id))}
          >
            {isPermanentlyHidden ? "Unhide permanently" : "Permanently hide"}
          </MenuItem>
        </>
      )}
      {environmentId && flow.processType === "cloud-flow" && (
        <>
          <MenuItem
            icon={<Copy20Regular />}
            onClick={handle(() =>
              navigator.clipboard?.writeText(
                `https://make.powerautomate.com/environments/${environmentId}/flows/${flow.id}/details`,
              ),
            )}
          >
            Copy Power Automate link
          </MenuItem>
          <MenuItem
            icon={<Open20Regular />}
            onClick={handle(() =>
              window.open(
                `https://make.powerautomate.com/environments/${environmentId}/flows/${flow.id}/details`,
                "_blank",
              ),
            )}
          >
            Open in Power Automate
          </MenuItem>
        </>
      )}
    </>
  );
}
