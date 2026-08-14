/** Locally persisted list of subscriptions the user marked as canceled. */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "finsight:canceled-subscriptions";
const EVENT = "finsight:canceled-subscriptions-changed";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function useCanceledSubscriptions() {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    setKeys(read());
    const sync = () => setKeys(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const cancel = useCallback((key: string) => {
    const next = Array.from(new Set([...read(), key]));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
    setKeys(next);
  }, []);

  const restore = useCallback((key: string) => {
    const next = read().filter((k) => k !== key);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
    setKeys(next);
  }, []);

  return { canceledKeys: keys, cancel, restore };
}
