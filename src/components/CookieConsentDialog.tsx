import { useEffect, useState } from "react";
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MessageBar,
  MessageBarBody,
} from "@fluentui/react-components";
import { getCookieConsent, setCookieConsent } from "@/lib/cookieConsent";
import { initAppInsights } from "@/lib/appInsights";

export function CookieConsentDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) {
      setOpen(true);
    }
  }, []);

  const handleAccept = () => {
    setCookieConsent("accept");
    initAppInsights();
    setOpen(false);
  };

  const handleReject = () => {
    setCookieConsent("reject");
    setOpen(false);
  };

  return (
    <Dialog open={open} modalType="alert">
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Cookies & analytics</DialogTitle>
          <DialogContent>
            <div className="flex flex-col gap-3 py-3">
              <p>
                Power Visualiser collects anonymous usage traces and metrics. This helps understand user behaviour so we
                can:
              </p>
              <ul className="list-disc pl-5">
                <li>See which features are used most and prioritise improvements</li>
                <li>Detect and diagnose errors and performance issues</li>
                <li>Understand navigation patterns across the app</li>
              </ul>
              <MessageBar>
                <MessageBarBody>
                  No solution data or process content leaves your browser — all
                  import/parse work stays local.
                </MessageBarBody>
              </MessageBar>
              <p>
                You can reject analytics and continue using the app normally.
              </p>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={handleReject}>
              Reject
            </Button>
            <Button appearance="primary" onClick={handleAccept}>
              Accept
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
