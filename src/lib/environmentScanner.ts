import { Process, TriggerType } from "@/data/flows";
import { resolveEdges } from "./parsing/edgeResolver";
import { ParseResult } from "./solutionParser";
import { trackEvent } from "./appInsights";
import {
    SdkmessagesService,
    SdkmessagefiltersService,
    WorkflowsService,
    CustomapisService,
    SdkmessageprocessingstepsService
} from "@/generated";
import { calculateTrigger, parseCloudFlowActions } from "./parsing/cloudFlowParser";
import { parseClassicWorkflowXaml } from "./parsing/classicWorkflowXamlParser";
import { Sdkmessages } from "@/generated/models/SdkmessagesModel";
import { messageToTrigger } from "./parsing/pluginStepParser";
import { pageResults } from "./dataverseHelpers";


export const scanEnvironmentBySolution = async (solutionIds: string[]): Promise<ParseResult> => {
    return { processes: [], edges: [], actions: [] };
}

export const scanEnvironmentByPublisher = async (publisherIds: string[]): Promise<ParseResult> => {
    return { processes: [], edges: [], actions: [] };
}

export const scanEnvironmentGlobal = async (): Promise<ParseResult> => {
    const processMap = new Map<string, Process>();

    const sdkMessages = await pageResults(SdkmessagesService, {
        select: ["sdkmessageid", "name"],
    });

    const cloudFlows = await scanEnvironmentForFlows();
    const classicWorkflows = await scanEnvironmentForClassicWorkflows();
    const classicActions = await scanEnvironmentForClassicActions(sdkMessages);
    const customApis = await scanEnvironmentForCustomApis();
    const pluginSteps = await scanEnvironmentForPluginSteps(sdkMessages);

    for (const f of [...cloudFlows, ...classicWorkflows, ...classicActions, ...customApis, ...pluginSteps]) {
        processMap.set(f.id, f);
    }

    trackEvent("solution_parsed", {
        flows: cloudFlows.length,
        classicWorkflows: classicWorkflows.length,
        classicActions: classicActions.length,
        customApis: customApis.length,
        pluginSteps: pluginSteps.length,
        totalProcesses: processMap.size,
    });

    const processList = Array.from(processMap.values());
    const allActions = processList.flatMap((f) => f.actions ?? []);
    const allChildCalls = processList.flatMap((f) => f.childCalls ?? []);

    // Phase 2: Resolve edges across the complete deduplicated dataset
    const edges = resolveEdges(processMap, allActions, allChildCalls);


    return { processes: processList, edges, actions: allActions };
}

const scanEnvironmentForFlows = async (): Promise<Process[]> => {
    const result = await WorkflowsService.getAll({
        select: ["workflowid", "name", "clientdata", "statecode"],
        filter: "category eq 5",
    });

    const workflows: Process[] = [];

    for (const f of result.data) {
        const parsedClientData = JSON.parse(f.clientdata);

        const { actions, childCalls } = parseCloudFlowActions(f.workflowid, parsedClientData);
        const trigger = calculateTrigger(parsedClientData);

        workflows.push({
            id: f.workflowid,
            name: f.name,
            processType: "cloud-flow",
            triggerTypes: trigger?.triggers,
            triggerTable: trigger?.entityName,
            dataFilter: trigger?.dataFilter,
            updateColumns: trigger?.onUpdateColumns,
            executionMode: trigger?.executionMode,
            isActive: f.statecode !== 0,
            actions,
            childCalls,
        });
    }

    return workflows;
}

const scanEnvironmentForClassicWorkflows = async (): Promise<Process[]> => {
    const result = await WorkflowsService.getAll({
        select: ["workflowid", "name", "xaml", "statecode", "primaryentity", "ondemand", "triggeroncreate", "triggerondelete", "triggeronupdateattributelist", "mode"],
        filter: "category eq 0",
    });

    const workflows: Process[] = [];

    for (const process of result.data) {
        const primaryEntity = (process.primaryentity ?? "").trim().toLowerCase();
        const triggerTypes: TriggerType[] = [];

        if (process.ondemand) {
            triggerTypes.push("on-demand");
        }
        if (process.triggeroncreate) {
            triggerTypes.push("dataverse-create");
        }
        if (process.triggerondelete) {
            triggerTypes.push("dataverse-delete");
        }
        const updateAttrList = process.triggeronupdateattributelist ?? "";
        if (updateAttrList.trim().length > 0) {
            triggerTypes.push("dataverse-update");
        }
        if (triggerTypes.length === 0) {
            triggerTypes.push("other");
        }

        const onUpdateColumns = updateAttrList
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s !== "");

        let actions: Process["actions"] = [];
        try {
            actions = parseClassicWorkflowXaml(process.workflowid, process.xaml);
        } catch {
            console.warn(`Could not read XAML for workflow ${process.name}`);
        }

        workflows.push({
            id: process.workflowid,
            name: process.name,
            processType: "classic-workflow",
            triggerTypes,
            triggerTable: primaryEntity || undefined,
            updateColumns: onUpdateColumns,
            executionMode: process.mode ? "sync" : "async",
            isActive: process.statecode !== 0,
            actions,
        });
    }

    return workflows;
}

const scanEnvironmentForClassicActions = async (sdkMessages: Sdkmessages[]): Promise<Process[]> => {
    const result = await WorkflowsService.getAll({
        select: ["workflowid", "name", "xaml", "statecode", "primaryentity", "ondemand", "triggeroncreate", "triggerondelete", "triggeronupdateattributelist"],
        filter: "category eq 3",
    });

    const workflows: Process[] = [];

    for (const process of result.data) {
        const primaryEntity = (process.primaryentity ?? "").trim().toLowerCase();

        const triggerTypes: TriggerType[] = ["custom-message"];

        let actions: Process["actions"] = [];
        try {
            actions = parseClassicWorkflowXaml(process.workflowid, process.xaml);
        } catch {
            console.warn(`Could not read XAML for workflow ${process.name}`);
        }

        const sdkMessage = sdkMessages.find((m) => m.sdkmessageid === process._sdkmessageid_value);

        if (!sdkMessage) {
            console.warn(`Could not find SDK message for action ${process.name}`);
        }

        workflows.push({
            id: process.workflowid,
            name: process.name,
            processType: "classic-workflow",
            triggerTypes,
            triggerTable: primaryEntity || undefined,
            executionMode: "sync",
            isActive: process.statecode !== 0,
            actions,
            uniqueName: sdkMessage
                ? `${primaryEntity ? "Microsoft.Dynamics.CRM." : ""}${sdkMessage.name}`
                : undefined,
        });
    }

    return workflows;
}

const scanEnvironmentForCustomApis = async (): Promise<Process[]> => {
    const result = await CustomapisService.getAll({
        select: ["customapiid", "name", "boundentitylogicalname", "statecode"],
    });

    const customApis: Process[] = [];

    for (const api of result.data) {
        customApis.push({
            id: "CustomApi-" + api.customapiid,
            name: api.name,
            processType: "custom-api",
            triggerTypes: ["custom-message"],
            triggerTable: api.boundentitylogicalname ? api.boundentitylogicalname.trim().toLowerCase() : undefined,
            executionMode: "sync",
            isActive: api.statecode !== 0,
            actions: [],
            uniqueName: `${api.boundentitylogicalname ? "Microsoft.Dynamics.CRM." : ""}${api.uniquename?.trim() || "Unknown"}`,
        });
    }

    return customApis;
}

const scanEnvironmentForPluginSteps = async (sdkMessages: Sdkmessages[]): Promise<Process[]> => {
    const result = await pageResults(SdkmessageprocessingstepsService, {
        select: ["sdkmessageprocessingstepid", "name", "sdkmessageid", "sdkmessagefilterid", "mode", "statecode"],
    }, 10);

    const sdkMessageFilters = await pageResults(SdkmessagefiltersService, {
        select: ["sdkmessagefilterid", "sdkmessageid", "primaryobjecttypecode"]
    });

    const steps: Process[] = [];

    for (const step of result) {
        const sdkMessage = sdkMessages.find((m) => m.sdkmessageid === step._sdkmessageid_value);
        if (!sdkMessage) {
            console.warn(`Could not find SDK message for SDK step ${step.name}`);
        }

        let triggerTable = undefined;
        if (step.sdkmessagefilterid) {
            const filter = sdkMessageFilters.find((f) => f.sdkmessagefilterid === step._sdkmessagefilterid_value);
            if (filter) {
                triggerTable = filter.primaryobjecttypecode;
            } else {
                console.warn(`Could not find SDK message filter for SDK step ${step.name}`);
            }
        }

        const messageName = step.sdkmessageidname ?? "Unknown";
        const triggerTypes = messageToTrigger(messageName);

        steps.push({
            id: "PluginStep-" + step.sdkmessageprocessingstepid,
            name: step.name,
            processType: "plugin-step",
            triggerTypes,
            triggerTable,
            updateColumns: step.filteringattributes?.split(",")?.map((s) => s.trim())?.filter(Boolean),
            executionMode: step.mode ? "async" : "sync",
            isActive: step.statecode !== 0,
            pluginStage: step.stage ? Number(step.stage) : undefined,
            uniqueName: triggerTypes[0] === "custom-message" ? messageName : undefined,
            actions: [],
            childCalls: [],
        });
    }

    return steps;
}