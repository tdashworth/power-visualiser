import { useFlowData } from "@/context/FlowDataContext";
import { useCodeApp } from "@/hooks/useCodeApp";
import { useDebugMode } from "@/hooks/useDebugMode";
import { Button, Input, makeStyles, Popover, PopoverSurface, PopoverTrigger, Text, typographyStyles, tokens, PopoverProps } from '@fluentui/react-components';
import { ArrowDownloadFilled, GlobeSurfaceRegular } from "@fluentui/react-icons";
import { useState } from "react";

const useStyles = makeStyles({
    headerTitle: typographyStyles.subtitle2,
    headerSubtitle: typographyStyles.body1,
});

export const AppHeader = () => {
    const styles = useStyles();
    const [isCodeApp] = useCodeApp();
    const [debugMode] = useDebugMode();

    if (isCodeApp && !debugMode) {
        return null;
    }

    return (
        <header style={{ backgroundColor: tokens.colorBrandBackground, color: tokens.colorNeutralForegroundOnBrand, height: "48px", display: "flex", alignItems: "center", paddingLeft: "16px", paddingRight: "16px", gap: "16px" }}>
            <h1 className={styles.headerTitle}>Power Visualiser</h1>
            <h1 className={styles.headerTitle+" hidden lg:block"}>|</h1>
            <h2 className={styles.headerSubtitle+" hidden lg:block"}>Visualise Power Platform automation dependencies</h2>
            <div style={{ flex: 1 }} />

            <SelectEnvironmentButton />

            {/* <Button 
                icon={<ArrowDownloadFilled />} 
                as="a" 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                title="Install Power Visualiser as a Code App within your environments">
                Install
            </Button> */}
        </header>
    )
}

const SelectEnvironmentButton = () => {
    const [open, setOpen] = useState(false);

    const { environmentId, setEnvironmentId } = useFlowData();
    const [envInput, setEnvInput] = useState(environmentId ?? "");

    const handleOpenChange: PopoverProps["onOpenChange"] = (e, data) =>
        setOpen(data.open || false);

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger disableButtonEnhancement>
                <Button icon={<GlobeSurfaceRegular />}>
                    Select environment
                </Button>
            </PopoverTrigger>
            <PopoverSurface tabIndex={-1}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                        <Text weight="semibold" block>
                            Environment ID
                        </Text>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }} block>
                            Paste your Power Automate environment ID to enable direct flow links.
                        </Text>
                    </div>
                    <Input
                        value={envInput}
                        onChange={(_, data) => setEnvInput(data.value)}
                        placeholder="8F42B1C3-5D9E-4A7B-…"
                        style={{ fontFamily: tokens.fontFamilyMonospace }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                        <Button
                            appearance="primary"
                            onClick={() => { setEnvironmentId(envInput.trim() || null); setOpen(false); }}
                        >
                            Save
                        </Button>
                        {environmentId && (
                            <Button
                                appearance="secondary"
                                onClick={() => {
                                    setEnvironmentId(null);
                                    setEnvInput("");
                                    setOpen(false);
                                }}
                            >
                                Clear
                            </Button>
                        )}
                        <Button appearance="secondary" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </PopoverSurface>
        </Popover>
    );
};