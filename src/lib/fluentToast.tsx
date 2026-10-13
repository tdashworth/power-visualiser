import { useEffect } from "react";
import {
  Toaster,
  useToastController,
  useId,
  Toast,
  ToastTitle,
  ToastBody,
  type ToastIntent,
} from "@fluentui/react-components";

type ToastOptions = {
  description?: string;
  intent?: ToastIntent;
};

type Dispatcher = (message: string, opts?: ToastOptions) => void;

let dispatcher: Dispatcher | null = null;

function show(message: string, opts?: ToastOptions) {
  if (dispatcher) {
    dispatcher(message, opts);
  } else {
    // Toaster not mounted yet — fall back to console
    console.warn("[toast] Toaster not mounted:", message);
  }
}

export const toast = Object.assign(
  (message: string, opts?: ToastOptions) => show(message, opts),
  {
    success: (message: string, opts?: ToastOptions) =>
      show(message, { ...opts, intent: "success" }),
    error: (message: string, opts?: ToastOptions) =>
      show(message, { ...opts, intent: "error" }),
    info: (message: string, opts?: ToastOptions) =>
      show(message, { ...opts, intent: "info" }),
    warning: (message: string, opts?: ToastOptions) =>
      show(message, { ...opts, intent: "warning" }),
  },
);

export function FluentToaster() {
  const toasterId = useId("app-toaster");
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    dispatcher = (message, opts) => {
      dispatchToast(
        <Toast>
          <ToastTitle>{message}</ToastTitle>
          {opts?.description && <ToastBody>{opts.description}</ToastBody>}
        </Toast>,
        { intent: opts?.intent ?? "info" },
      );
    };
    return () => {
      dispatcher = null;
    };
  }, [dispatchToast]);

  return <Toaster toasterId={toasterId} position="bottom-end" />;
}
