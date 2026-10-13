import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { FlowDataProvider } from "@/context/FlowDataContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { trackPageView } from "@/lib/appInsights";
import AppLayout from "@/components/AppLayout";
import Map from "./pages/Map";
import Insights from "./pages/Insights";
import WhatIf from "./pages/WhatIf";
import Where from "./pages/Where";
import Relationships from "./pages/Relationships";
import NotFound from "./pages/NotFound";
import Debug from "./pages/Debug";

const queryClient = new QueryClient();

const pageNames: Record<string, string> = {
  "/": "Map",
  "/insights": "Insights",
  "/what-if": "What If",
  "/where": "Where",
  "/relationships": "Relationships",
};

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    const name = pageNames[location.pathname] ?? location.pathname;
    trackPageView(name, location.pathname);
  }, [location.pathname]);
  return null;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <FlowDataProvider>
          <TooltipProvider>
            <BrowserRouter>
              <PageViewTracker />
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Map />} />
                  <Route path="/insights" element={<Insights />} />
                  <Route path="/what-if" element={<WhatIf />} />
                  <Route path="/where" element={<Where />} />
                  <Route path="/relationships" element={<Relationships />} />
                  <Route path="/debug" element={<Debug />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </FlowDataProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
