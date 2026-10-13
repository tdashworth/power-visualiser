# TODO

- [ ] Improve OData filter validation logic
- [ ] Don't default to "scheduled" trigger type when trigger is unrecognized


To get the Environment details
- retrieve the first organization and read the ID
- connect to shared_powerappsforappmakers
- call Get-Environments
- parse results for properties.linkedEnvironmentMetadata.resourceId matches the organization id
- enviromnet id for flow can be retrieved from $.name
- environment url for other processes can be retrieved from properties.linkedEnvironmentMetadata.instanceUrl
- friendly name properties.linkedEnvironmentMetadata.friendlyName 


{
    "inputs": {
        "host": {
            "connectionName": "shared_powerappsforappmakers",
            "operationId": "Get-Environments",
            "apiId": "/providers/Microsoft.PowerApps/apis/shared_powerappsforappmakers"
        },
        "parameters": {
            "api-version": "2022-11-01",
            "$top": 250
        },
        "authentication": {
            "type": "Raw",
            "value": "@json(decodeBase64(triggerOutputs().headers['X-MS-APIM-Tokens']))['$ConnectionKey']"
        }
    }
}