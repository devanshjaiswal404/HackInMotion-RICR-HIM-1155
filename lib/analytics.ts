import { calculateFinancialHealth } from "@/utils/healthScore";

export type AnalyticsRow = {
  id?: string | null;
  date?: string | null;
  merchant?: string | null;
  category: string;
  amount: number | string;
  type?: string | null;
  payment_mode?: string | null;
};

export const CATEGORY_MAP: Record<string, string> = {
  Food: "Food & Dining",
  Bills: "Utilities",
  Travel: "Transportation",
  Subscriptions: "Subscriptions",
  Income: "Income",
};

export const DINING_CATEGORIES = ["Food & Dining", "Food"];
export const SUBSCRIPTION_CATEGORIES = ["Subscriptions"];
export const DISCRETIONARY_CATEGORIES = ["Shopping", "Travel", "Health & Fitness"];
export const HOUSING_CATEGORIES = ["Rent & Housing", "Utilities", "Bills"];

export function isIncome(r: AnalyticsRow) {
  return r.type === "income" || r.category === "Income";
}

export function absAmount(r: AnalyticsRow) {
  return Math.abs(Number(r.amount) || 0);
}

export function totalIncome(rows: AnalyticsRow[]) {
  return rows.reduce((s, r) => (isIncome(r) ? s + absAmount(r) : s), 0);
}

export function totalExpenses(rows: AnalyticsRow[]) {
  return rows.reduce((s, r) => (isIncome(r) ? s : s + absAmount(r)), 0);
}

export function spendInCategories(rows: AnalyticsRow[], categories: string[]) {
  return rows.reduce(
    (s, r) => (!isIncome(r) && categories.includes(r.category) ? s + absAmount(r) : s),
    0,
  );
}

export function spendByCategory(rows: AnalyticsRow[]) {
  return rows.reduce<Record<string, number>>((acc, r) => {
    if (isIncome(r)) return acc;
    acc[r.category] = (acc[r.category] ?? 0) + absAmount(r);
    return acc;
  }, {});
}

/** Normalizes rows into the shape the health-score utility expects. */
export function normalizeForHealth(rows: AnalyticsRow[]) {
  return rows.map((r) => ({
    ...r,
    category: CATEGORY_MAP[r.category] ?? r.category,
    amount: isIncome(r) ? absAmount(r) : -absAmount(r),
  }));
}

export function healthOf(rows: AnalyticsRow[]) {
  return calculateFinancialHealth(normalizeForHealth(rows));
}

/** Applies percentage cuts to specific spending buckets and re-scores. */
export function simulatedHealth(
  rows: AnalyticsRow[],
  cuts: { dining: number; subscriptions: number; discretionary: number },
) {
  const adjusted = rows.map((r) => {
    if (isIncome(r)) return r;
    let factor = 1;
    if (DINING_CATEGORIES.includes(r.category)) factor = 1 - cuts.dining / 100;
    else if (SUBSCRIPTION_CATEGORIES.includes(r.category)) factor = 1 - cuts.subscriptions / 100;
    else if (DISCRETIONARY_CATEGORIES.includes(r.category))
      factor = 1 - cuts.discretionary / 100;
    return { ...r, amount: absAmount(r) * factor };
  });
  return healthOf(adjusted);
}

/** Number of whole months covered by the dataset (min 1). */
export function monthSpan(rows: AnalyticsRow[]) {
  const months = new Set(
    rows.map((r) => (r.date ? String(r.date).slice(0, 7) : "")).filter(Boolean),
  );
  return Math.max(1, months.size);
}
