import { ApplicationInsights } from "@microsoft/applicationinsights-web";

let appInsights: ApplicationInsights | null = null;

const CONNECTION_STRING =
  "InstrumentationKey=4c0e1ffa-c57c-4ed8-8b90-c9ff4a834454;IngestionEndpoint=https://uksouth-1.in.applicationinsights.azure.com/;LiveEndpoint=https://uksouth.livediagnostics.monitor.azure.com/;ApplicationId=a03099a0-d178-42b6-a86d-30936cf5dfb9"; // Replace with your real connection string

export function initAppInsights(connectionString?: string) {
  const cs = connectionString || CONNECTION_STRING;
  if (!cs || cs === "__AI_CONNECTION_STRING__") {
    console.warn("[AppInsights] No connection string configured — telemetry disabled.");
    return;
  }

  appInsights = new ApplicationInsights({
    config: {
      connectionString: cs,
      enableAutoRouteTracking: false, // we handle manually for better page names
      disableExceptionTracking: false,
      disableTelemetry: false,
    },
  });

  appInsights.loadAppInsights();

  appInsights.addTelemetryInitializer((envelope) => {
    if (!envelope.data) envelope.data = {};

    envelope.data['version'] = 'v0.1.0';
    envelope.data['baseUrl'] = window.location.hostname;
  });

  appInsights.trackPageView();
}

export function trackPageView(name: string, uri?: string) {
  appInsights?.trackPageView({ name, uri });
}

export function trackEvent(name: string, properties?: Record<string, string | number | boolean>) {
  appInsights?.trackEvent({ name }, properties);
}

export function trackError(error: Error, properties?: Record<string, string>) {
  appInsights?.trackException({ exception: error }, properties);
}

export function getAppInsights() {
  return appInsights;
}
