import { createRoot } from "react-dom/client";
import { initAppInsights } from "./lib/appInsights";
import { getCookieConsent } from "./lib/cookieConsent";
import App from "./App.tsx";
import "./index.css";

// Only initialize Application Insights if the user has previously accepted cookies.
if (getCookieConsent()?.choice === "accept") {
  initAppInsights();
}

createRoot(document.getElementById("root")!).render(<App />);
