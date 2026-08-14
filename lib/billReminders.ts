/** Locally persisted bill state: paid markers and per-bill alert toggles. */
import { useCallback, useEffect, useState } from "react";

const PAID_KEY = "finsight:paid-bills";
const ALERT_KEY = "finsight:bill-alerts";
const EVENT = "finsight:bill-reminders-changed";

function read(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(storageKey: string, values: string[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(values));
  window.dispatchEvent(new Event(EVENT));
}

/** Paid markers are scoped per predicted due date so next cycle resets. */
export function paidToken(key: string, dueDate: string) {
  return `${key}@${dueDate}`;
}

export function useBillReminders() {
  const [paid, setPaid] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      setPaid(read(PAID_KEY));
      setAlerts(read(ALERT_KEY));
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const markPaid = useCallback((token: string) => {
    const next = Array.from(new Set([...read(PAID_KEY), token]));
    write(PAID_KEY, next);
    setPaid(next);
  }, []);

  const toggleAlert = useCallback((key: string) => {
    const current = read(ALERT_KEY);
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    write(ALERT_KEY, next);
    setAlerts(next);
  }, []);

  return { paidTokens: paid, alertKeys: alerts, markPaid, toggleAlert };
}
