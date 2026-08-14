import { Fragment, createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CURRENCIES,
  setActiveCurrency,
  currencySymbol,
  type CurrencyCode,
} from "@/utils/formatters";

const STORAGE_KEY = "finsight.currency";

type CurrencyContextValue = {
  currency: CurrencyCode;
  symbol: string;
  setCurrency: (code: CurrencyCode) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function isSupported(value: string | null): value is CurrencyCode {
  return !!value && CURRENCIES.some((c) => c.code === value);
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) {
      setActiveCurrency(stored);
      setCurrencyState(stored);
    }
  }, []);

  function setCurrency(code: CurrencyCode) {
    setActiveCurrency(code);
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }

  // Keep the module-level formatter in sync during render (covers SSR + hydration).
  setActiveCurrency(currency);

  const value = useMemo(
    () => ({ currency, symbol: currencySymbol(currency), setCurrency }),
    [currency],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {/* Remount on currency change so every formatted value re-renders immediately. */}
      <Fragment key={currency}>{children}</Fragment>
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}

export { CURRENCIES };
export type { CurrencyCode };
