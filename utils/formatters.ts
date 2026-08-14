export type CurrencyCode = "USD" | "INR" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD";

export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: "USD", symbol: "$", label: "United States Dollar" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
];

const LOCALES: Record<CurrencyCode, string> = {
  USD: "en-US",
  INR: "en-IN",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  CAD: "en-CA",
  AUD: "en-AU",
};

let activeCurrency: CurrencyCode = "USD";

/** Set the globally active currency used by formatCurrency when no code is passed. */
export const setActiveCurrency = (code: CurrencyCode) => {
  activeCurrency = code;
};

export const getActiveCurrency = (): CurrencyCode => activeCurrency;

export const currencySymbol = (code: CurrencyCode = activeCurrency): string =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? "$";

/** Global currency formatter — uses the selected global currency unless one is given. */
export const formatCurrency = (
  amount: number | string | null | undefined,
  currencyCode: CurrencyCode = activeCurrency,
): string => {
  const numericValue =
    typeof amount === "number" ? amount : parseFloat(String(amount ?? "")) || 0;
  const fractionDigits = currencyCode === "JPY" ? 0 : 2;
  return new Intl.NumberFormat(LOCALES[currencyCode] ?? "en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(numericValue);
};
