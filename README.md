# Power Visualiser

A tool to understand the complex web of Flows, Workflows and Plugins that make up to Power Platform.

Primarily, it graphs which "processes" exist in your solutions and how actions within thoses could trigger other processes.

Secondary, it provides search tools to find where certain table CRUDs options exist or which processes fire given an event.

This is acomplished though local static analysis of your solutions without sending you solution anywhere!

## Features

Discovered Processes:

- Flows
  - Dataverse Create/Update/Delete trigger, including odata select and filter evaluation
  - Schedule trigger
  - Child Flows/Manual trigger
  - Other (unsupported) trigger
- Classic Workflows
  - Dataverse Create/Update/Delete trigger, icluding triggered columns support
  - On Demand trigger
- Classic Workflows Actions (new Custom Message trigger)
- Custom APIs
- Plugin Steps

Discovered Actions within Flows:

- Child Flows
- Dataverse Create/Update/Delete operations
- Dataverse Custom Message operations (Custom API and Classic Actions)

Discovered Actions within Classic Workflows/Actions:

- Dataverse Create/Update/Delete operations
- Dataverse Custom Message operations (Custom API and Classic Actions)

Search:

- Dataverse Create/Update/Delete actions
- Dataverse Create/Update/Delete triggers
- Dataverse Custom Message actions
- Dataverse Custom Message triggers

Filters:

- Process types
- Trigger types
- Process status (active/inactive)
- Optimistic - due to static analysis, there is usually not be enough data in an trigger to fully evaluate an odata filter, this is known as optimistic meaning it might not be a valid route within your context.

---

Missing:

- Discover Flows with other Dataverse triggers (On row selected/custom message)
- Discover Flow Actions for other connectors (e.g. KeyVault, Azure Blob)
- Discover Flow Actions that read Dataverse data (record and list)
- Discover Workflow Actions that read Dataverse data (record and list)
  How and why?
- Discover Workflow Actions for on demand workflows?
- Discover Workflow Actions for Custom Workflow Actions?
- Discover Plugin Dataverse Create/Update/Delete Actions
- Discover Plugin Dataverse Custom Message actions
- Search other (unsupported) Flow triggers
- Search other (unsupported) Flow actions
- Flow trigger conditions evaluation
