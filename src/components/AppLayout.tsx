import { Outlet } from "react-router-dom";

import GlobalSearch from "@/components/GlobalSearch";
import { SearchProvider } from "@/context/SearchContext";
import { FluentProvider } from "@fluentui/react-components";
import { useTheme } from "next-themes";
import AppNavBar from "@/components/AppNavbar";
import { AppHeader } from "./AppHeader";
import { tealDarkTheme, tealLightTheme } from "@/lib/fluentTheme";
import { FluentToaster } from "@/lib/fluentToast";
import { CookieConsentDialog } from "./CookieConsentDialog";

export default function AppLayout() {
  const { resolvedTheme } = useTheme();
  const fluentTheme = resolvedTheme === "dark" ? tealDarkTheme : tealLightTheme;

  return (
    <FluentProvider theme={fluentTheme}>
      <SearchProvider>
        <div className="flex flex-col h-screen w-full" style={{ backgroundColor: fluentTheme.colorNeutralBackground2 }}>
          <AppHeader />
          <div className="flex flex-1 min-h-0">
            <AppNavBar />
            <div className="flex flex-1 min-h-0">
              <Outlet />
            </div>
          </div>
          <GlobalSearch />
          <FluentToaster />
          <CookieConsentDialog />
        </div>
      </SearchProvider>
    </FluentProvider>
  );
}
