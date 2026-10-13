import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "@/lib/fluentToast";

const DEBUG_STORAGE_KEY = "debug-mode";
const DEBUG_DEBOUNCE_MS = 500;

type DebugSubscriber = (value: boolean) => void;
type DebugGlobalState = {
  value: boolean;
  subscribers: Set<DebugSubscriber>;
  listenerAttached: boolean;
  listener?: (e: KeyboardEvent) => void;
  listenerRefs: number;
  lastShortcutAt: number;
};

declare global {
  interface Window {
    __powerVisualizerDebugMode?: DebugGlobalState;
  }
}

function readInitialDebugValue() {
  try {
    return JSON.parse(localStorage.getItem(DEBUG_STORAGE_KEY) ?? "false") as boolean;
  } catch {
    return false;
  }
}

function getDebugState() {
  if (!window.__powerVisualizerDebugMode) {
    window.__powerVisualizerDebugMode = {
      value: readInitialDebugValue(),
      subscribers: new Set<DebugSubscriber>(),
      listenerAttached: false,
      listenerRefs: 0,
      lastShortcutAt: 0,
    };
    console.debug("[debug-mode] global state initialised", {
      value: window.__powerVisualizerDebugMode.value,
    });
  }

  return window.__powerVisualizerDebugMode;
}

function writeDebugValue(value: boolean) {
  try {
    localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function setGlobalDebugValue(value: boolean) {
  const state = getDebugState();
  if (state.value === value) {
    console.debug("[debug-mode] value unchanged", { value });
    return;
  }

  const previous = state.value;
  state.value = value;
  writeDebugValue(value);
  console.debug("[debug-mode] value changed", {
    previous,
    next: value,
    subscribers: state.subscribers.size,
  });
  state.subscribers.forEach((subscriber) => subscriber(value));
}

function onDebugShortcut(e: KeyboardEvent) {
  if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
    e.preventDefault();
    const state = getDebugState();
    const now = performance.now();

    if (e.repeat || now - state.lastShortcutAt < DEBUG_DEBOUNCE_MS) {
      console.debug("[debug-mode] shortcut ignored", {
        repeat: e.repeat,
        elapsedMs: Math.round(now - state.lastShortcutAt),
      });
      return;
    }

    state.lastShortcutAt = now;
    const next = !state.value;
    console.debug("[debug-mode] shortcut accepted", { next });
    setGlobalDebugValue(next);
    toast(next ? "Debug mode enabled" : "Debug mode disabled");
  }
}

function addDebugShortcutListener() {
  const state = getDebugState();

  if (!state.listenerAttached) {
    if (state.listener) {
      window.removeEventListener("keydown", state.listener);
    }

    state.listener = onDebugShortcut;
    window.addEventListener("keydown", state.listener);
    state.listenerAttached = true;
    console.debug("[debug-mode] shortcut listener attached");
  }
  state.listenerRefs += 1;
  console.debug("[debug-mode] shortcut listener ref added", { refs: state.listenerRefs });

  return () => {
    const current = getDebugState();
    current.listenerRefs = Math.max(0, current.listenerRefs - 1);
    console.debug("[debug-mode] shortcut listener ref removed", { refs: current.listenerRefs });

    if (current.listenerRefs === 0 && current.listenerAttached && current.listener) {
      window.removeEventListener("keydown", current.listener);
      current.listenerAttached = false;
      console.debug("[debug-mode] shortcut listener detached");
    }
  };
}

export function useDebugMode() {
  const [debug, setDebug] = useState(() => getDebugState().value);

  useEffect(() => {
    const state = getDebugState();
    state.subscribers.add(setDebug);
    setDebug(state.value);
    console.debug("[debug-mode] subscriber added", { subscribers: state.subscribers.size });
    const removeShortcutListener = addDebugShortcutListener();

    return () => {
      const current = getDebugState();
      current.subscribers.delete(setDebug);
      console.debug("[debug-mode] subscriber removed", { subscribers: current.subscribers.size });
      removeShortcutListener();
    };
  }, []);

  const setDebugMode = useCallback<Dispatch<SetStateAction<boolean>>>((value) => {
    const current = getDebugState().value;
    const next = typeof value === "function" ? (value as (prev: boolean) => boolean)(current) : value;
    console.debug("[debug-mode] setter called", { current, next });
    setGlobalDebugValue(next);
  }, []);

  return [debug, setDebugMode] as const;
}

