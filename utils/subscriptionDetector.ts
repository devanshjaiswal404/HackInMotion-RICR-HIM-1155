/**
 * Subscription Audit & Forgotten Service Detector.
 *
 * Detects recurring subscriptions from transaction history via keyword matching
 * and frequency/amount analysis, then flags likely-unused or high-overhead ones.
 */

export type DetectorTxn = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number | string;
  type: string;
};

export type SubscriptionFlag =
  | "category_overlap"
  | "price_increase"
  | "high_relative_cost";

export type DetectedSubscription = {
  /** Stable key derived from the normalized merchant name. */
  key: string;
  merchant: string;
  icon: string;
  category: string;
  frequency: "monthly" | "annual";
  /** Latest charged amount. */
  amount: number;
  /** Normalized monthly cost (annual / 12). */
  monthlyCost: number;
  occurrences: number;
  lastCharge: string;
  isStreaming: boolean;
  flags: SubscriptionFlag[];
  flagReason: string | null;
  transactionIds: string[];
};

export type SubscriptionAudit = {
  subscriptions: DetectedSubscription[];
  totalMonthlySubscriptionSpend: number;
  subscriptionPercentageOfIncome: number;
  potentialMonthlySavings: number;
};

/** Known subscription services: keyword -> { label, icon, streaming }. */
const KNOWN_SERVICES: {
  keywords: string[];
  label: string;
  icon: string;
  streaming?: boolean;
}[] = [
  { keywords: ["netflix"], label: "Netflix", icon: "🎬", streaming: true },
  { keywords: ["spotify"], label: "Spotify", icon: "🎧" },
  { keywords: ["amazon prime", "prime video", "primevideo"], label: "Amazon Prime", icon: "📦", streaming: true },
  { keywords: ["youtube premium", "youtube music", "yt premium"], label: "YouTube Premium", icon: "▶️", streaming: true },
  { keywords: ["chatgpt", "openai"], label: "ChatGPT Plus", icon: "🤖" },
  { keywords: ["disney", "hotstar"], label: "Disney+ Hotstar", icon: "🏰", streaming: true },
  { keywords: ["icloud", "apple.com", "apple music", "apple tv", "itunes"], label: "Apple / iCloud", icon: "" },
  { keywords: ["adobe", "creative cloud"], label: "Adobe", icon: "🎨" },
  { keywords: ["gym", "cult.fit", "cultfit", "fitness first", "anytime fitness"], label: "Gym Membership", icon: "🏋️" },
  { keywords: ["google one", "google storage", "google play pass"], label: "Google One", icon: "☁️" },
  { keywords: ["linkedin"], label: "LinkedIn Premium", icon: "💼" },
  { keywords: ["times internet", "toi plus", "times prime"], label: "Times Internet", icon: "📰" },
  { keywords: ["swiggy one", "swiggy super"], label: "Swiggy One", icon: "🍽️" },
  { keywords: ["zomato gold", "zomato pro"], label: "Zomato Gold", icon: "🍜" },
  { keywords: ["sonyliv", "sony liv"], label: "SonyLIV", icon: "📺", streaming: true },
  { keywords: ["zee5"], label: "ZEE5", icon: "📺", streaming: true },
  { keywords: ["jiocinema", "jio cinema"], label: "JioCinema", icon: "📺", streaming: true },
  { keywords: ["notion"], label: "Notion", icon: "🗒️" },
  { keywords: ["dropbox"], label: "Dropbox", icon: "🗂️" },
  { keywords: ["microsoft 365", "office 365", "onedrive"], label: "Microsoft 365", icon: "🪟" },
  { keywords: ["canva"], label: "Canva Pro", icon: "🖌️" },
  { keywords: ["audible", "kindle unlimited"], label: "Audible", icon: "🎙️" },
];

const STREAMING_CATEGORIES = new Set(["Entertainment", "Subscriptions"]);

/** High monthly cost thresholds (native units of the amounts stored). */
const HIGH_COST_USD = 25;
const HIGH_COST_INR = 1500;

function normalizeKey(merchant: string) {
  return merchant.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchService(merchant: string) {
  const text = merchant.toLowerCase();
  return KNOWN_SERVICES.find((s) => s.keywords.some((k) => text.includes(k))) ?? null;
}

function daysBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.abs(ms) / 86_400_000;
}

/** True when the gaps look like a monthly or annual billing cadence. */
function cadence(dates: string[]): "monthly" | "annual" | null {
  if (dates.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i += 1) {
    gaps.push(daysBetween(dates[i - 1]!, dates[i]!));
  }
  const monthly = gaps.filter((g) => g >= 25 && g <= 35).length;
  const annual = gaps.filter((g) => g >= 330 && g <= 400).length;
  if (monthly >= Math.max(1, Math.floor(gaps.length / 2))) return "monthly";
  if (annual >= 1) return "annual";
  return null;
}

/** Amounts within ±5% of the median count as near-identical. */
function amountsConsistent(amounts: number[]) {
  if (amounts.length < 2) return true;
  const sorted = [...amounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  if (median === 0) return false;
  return amounts.every((a) => Math.abs(a - median) / median <= 0.05);
}

export function detectSubscriptions(
  transactions: DetectorTxn[],
  options: { totalIncome?: number; canceledKeys?: string[] } = {},
): SubscriptionAudit {
  const canceled = new Set(options.canceledKeys ?? []);
  const expenses = transactions.filter((t) => t.type !== "income");

  const groups = new Map<string, DetectorTxn[]>();
  expenses.forEach((t) => {
    const service = matchService(t.merchant ?? "");
    const key = service ? normalizeKey(service.label) : normalizeKey(t.merchant ?? "");
    if (!key) return;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  });

  const subs: DetectedSubscription[] = [];

  groups.forEach((list, key) => {
    if (canceled.has(key)) return;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = sorted.map((t) => Math.abs(Number(t.amount)));
    const service = matchService(sorted[0]!.merchant ?? "");
    const dates = sorted.map((t) => t.date);
    const detectedCadence = cadence(dates);

    const isKeywordMatch = Boolean(service);
    const isFrequencyMatch = detectedCadence !== null && amountsConsistent(amounts);
    if (!isKeywordMatch && !isFrequencyMatch) return;

    const frequency: "monthly" | "annual" =
      detectedCadence === "annual" ? "annual" : "monthly";
    const amount = amounts[amounts.length - 1]!;
    const monthlyCost = frequency === "annual" ? amount / 12 : amount;
    const category = sorted[sorted.length - 1]!.category;
    const isStreaming =
      Boolean(service?.streaming) ||
      (!service && STREAMING_CATEGORIES.has(category) && false);

    const flags: SubscriptionFlag[] = [];

    // Price increase anomaly: latest charge is higher than a prior cycle.
    if (amounts.length >= 2 && amount > Math.min(...amounts.slice(0, -1)) * 1.05) {
      flags.push("price_increase");
    }

    // High relative cost for a single digital subscription.
    if (monthlyCost > HIGH_COST_INR || (monthlyCost > HIGH_COST_USD && monthlyCost < 1000)) {
      flags.push("high_relative_cost");
    }

    subs.push({
      key,
      merchant: service?.label ?? sorted[0]!.merchant,
      icon: service?.icon ?? "🔁",
      category,
      frequency,
      amount,
      monthlyCost,
      occurrences: sorted.length,
      lastCharge: dates[dates.length - 1]!,
      isStreaming,
      flags,
      flagReason: null,
      transactionIds: sorted.map((t) => t.id),
    });
  });

  // Category overlap spike: 3+ simultaneous streaming services.
  const streaming = subs.filter((s) => s.isStreaming);
  if (streaming.length >= 3) {
    streaming.forEach((s) => s.flags.push("category_overlap"));
  }

  const REASONS: Record<SubscriptionFlag, string> = {
    category_overlap: `You have ${streaming.length} streaming services running at once`,
    price_increase: "Price increased versus an earlier billing cycle",
    high_relative_cost: "High monthly cost with no recent activity at this merchant",
  };

  subs.forEach((s) => {
    s.flagReason = s.flags.length > 0 ? REASONS[s.flags[0]!] : null;
  });

  subs.sort((a, b) => b.monthlyCost - a.monthlyCost);

  const totalMonthlySubscriptionSpend = subs.reduce((sum, s) => sum + s.monthlyCost, 0);
  const potentialMonthlySavings = subs
    .filter((s) => s.flags.length > 0)
    .reduce((sum, s) => sum + s.monthlyCost, 0);
  const totalIncome = options.totalIncome ?? 0;

  return {
    subscriptions: subs,
    totalMonthlySubscriptionSpend,
    subscriptionPercentageOfIncome:
      totalIncome > 0 ? (totalMonthlySubscriptionSpend / totalIncome) * 100 : 0,
    potentialMonthlySavings,
  };
}

/** Key used to group a transaction into a subscription (service label or merchant). */
export function subscriptionKeyFor(merchant: string): string {
  const service = matchService(merchant ?? "");
  return service ? normalizeKey(service.label) : normalizeKey(merchant ?? "");
}

/** Drops expense rows belonging to subscriptions the user marked as canceled. */
export function excludeCanceled<T extends { merchant: string; type: string }>(
  rows: T[],
  canceledKeys: string[],
): T[] {
  if (canceledKeys.length === 0) return rows;
  const canceled = new Set(canceledKeys);
  return rows.filter((r) => r.type === "income" || !canceled.has(subscriptionKeyFor(r.merchant)));
}
