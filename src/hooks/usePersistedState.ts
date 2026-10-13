import { useEffect, useState } from "react";

/**
 * useState backed by localStorage. Serializes via JSON.
 * Pass custom (de)serializers for Sets or other non-JSON values.
 */
export function usePersistedState<T>(
  key: string,
  initial: T | (() => T),
  options?: {
    serialize?: (v: T) => string;
    deserialize?: (raw: string) => T;
  },
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const serialize = options?.serialize ?? ((v: T) => JSON.stringify(v));
  const deserialize = options?.deserialize ?? ((raw: string) => JSON.parse(raw) as T);

  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return deserialize(raw);
    } catch {
      // ignore
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, serialize(state));
    } catch {
      // ignore
    }
  }, [key, state, serialize]);

  return [state, setState];
}
