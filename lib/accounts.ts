/** Multi-account support: derives a stable account for each transaction. */

export const ACCOUNTS = [
  "HDFC Salary A/c",
  "ICICI Credit Card",
  "Paytm UPI Wallet",
] as const;

export type AccountName = (typeof ACCOUNTS)[number];

export const ACCOUNT_FILTER_OPTIONS = ["All Accounts", ...ACCOUNTS] as const;

export const ACCOUNT_STYLES: Record<AccountName, { short: string; badge: string }> = {
  "HDFC Salary A/c": {
    short: "HDFC",
    badge:
      "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  },
  "ICICI Credit Card": {
    short: "ICICI",
    badge:
      "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300",
  },
  "Paytm UPI Wallet": {
    short: "Paytm",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
};

type AccountRow = {
  id?: string | null;
  payment_mode?: string | null;
  merchant?: string | null;
  type?: string | null;
};

function stableIndex(seed: string, buckets: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return hash % buckets;
}

/**
 * Maps a transaction to one of the three tracked accounts using its payment mode,
 * falling back to a deterministic hash so every row always belongs somewhere.
 */
export function accountOf(row: AccountRow): AccountName {
  const mode = (row.payment_mode ?? "").toLowerCase();
  const merchant = (row.merchant ?? "").toLowerCase();

  if (/upi|paytm|wallet|apple pay|cash/.test(mode) || /upi|paytm/.test(merchant)) {
    return "Paytm UPI Wallet";
  }
  if (/credit card|wire/.test(mode)) return "ICICI Credit Card";
  if (/direct deposit|ach|bank transfer|debit|direct debit|neft|imps/.test(mode)) {
    return "HDFC Salary A/c";
  }
  if (row.type === "income") return "HDFC Salary A/c";

  const seed = String(row.id ?? merchant ?? "x");
  return ACCOUNTS[stableIndex(seed, ACCOUNTS.length)]!;
}

/** Filters rows by the selected account label ("All Accounts" passes everything). */
export function filterByAccount<T extends AccountRow>(rows: T[], account: string): T[] {
  if (!account || account === "All Accounts") return rows;
  return rows.filter((r) => accountOf(r) === account);
}
