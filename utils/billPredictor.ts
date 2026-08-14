/** Recurring bill detection + due-date prediction from transaction history. */

export type BillTxn = {
  id?: string;
  date: string;
  merchant: string;
  category: string;
  amount: number | string;
  type?: string;
  payment_mode?: string | null;
};

export type PredictedBill = {
  key: string;
  merchant: string;
  category: string;
  icon: string;
  label: string;
  estimatedAmount: number;
  lastPaymentDate: string;
  nextDueDate: string;
  daysRemaining: number;
  occurrences: number;
  averageIntervalDays: number;
  paymentMode: string | null;
};

const DAY_MS = 86_400_000;

/** Keyword → { icon, label } for recognised recurring billers. */
const BILLER_RULES: { icon: string; label: string; keywords: string[] }[] = [
  { icon: "⚡", label: "Electricity", keywords: ["bescom", "tata power", "adani electricity", "torrent power", "mseb", "electric", "edison", "power bill"] },
  { icon: "💧", label: "Water", keywords: ["water board", "water bill", "jal board", "bwssb"] },
  { icon: "🔥", label: "Gas", keywords: ["gas bill", "indane", "gail", "hp gas", "bharat gas"] },
  { icon: "📱", label: "Mobile", keywords: ["airtel", "jio", "vodafone", "vi recharge", "bsnl", "verizon", "at&t", "t-mobile", "mobile bill"] },
  { icon: "🌐", label: "Internet", keywords: ["broadband", "wifi", "internet", "act fibernet", "hathway", "xfinity", "comcast", "spectrum"] },
  { icon: "🏠", label: "Rent", keywords: ["rent", "landlord", "mortgage", "society maint", "society fee", "hoa", "nobroker"] },
  { icon: "💳", label: "Credit Card", keywords: ["credit card bill", "credit card payment", "card payment", "hdfc credit", "icici credit", "amex payment", "cc bill"] },
  { icon: "🏦", label: "Loan EMI", keywords: ["loan", "emi", "student loan", "auto loan", "home loan"] },
  { icon: "🛡️", label: "Insurance", keywords: ["insurance", "lic ", "policy premium", "premium payment", "geico", "allstate"] },
];

const RECURRING_CATEGORIES = new Set([
  "Utilities",
  "Bills",
  "Rent & Housing",
  "Credit Card Payment",
]);

function matchBiller(merchant: string, category: string) {
  const m = merchant.toLowerCase();
  for (const rule of BILLER_RULES) {
    if (rule.keywords.some((k) => m.includes(k))) return rule;
  }
  if (RECURRING_CATEGORIES.has(category)) {
    return { icon: "🧾", label: category, keywords: [] };
  }
  return null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function billKey(merchant: string) {
  return merchant.trim().toLowerCase();
}

/**
 * Detects monthly recurring bills (~28–31 day cadence) and predicts the next
 * due date (last payment + 30 days) and amount (average of past payments).
 */
export function predictUpcomingBills(transactions: BillTxn[]): PredictedBill[] {
  const groups = new Map<string, BillTxn[]>();

  for (const t of transactions) {
    if (t.type === "income") continue;
    if (!t.merchant || !t.date) continue;
    const biller = matchBiller(t.merchant, t.category);
    if (!biller) continue;
    const key = billKey(t.merchant);
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const today = startOfToday();
  const bills: PredictedBill[] = [];

  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0]!;
    const biller = matchBiller(first.merchant, first.category)!;

    const dates = sorted.map((t) => new Date(`${t.date}T00:00:00`));
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push(daysBetween(dates[i - 1]!, dates[i]!));
    }
    const monthly = intervals.filter((d) => d >= 25 && d <= 35);

    // Need either a repeating monthly cadence or at least one prior payment.
    if (sorted.length >= 2 && monthly.length === 0) continue;

    const avgInterval =
      monthly.length > 0
        ? Math.round(monthly.reduce((s, d) => s + d, 0) / monthly.length)
        : 30;

    const amounts = sorted.map((t) => Math.abs(Number(t.amount) || 0));
    const estimatedAmount =
      amounts.reduce((s, a) => s + a, 0) / (amounts.length || 1);

    const last = dates[dates.length - 1]!;
    const next = new Date(last.getTime() + 30 * DAY_MS);
    // Roll forward if the prediction is already more than a cycle stale.
    while (daysBetween(today, next) < -avgInterval) {
      next.setTime(next.getTime() + 30 * DAY_MS);
    }

    bills.push({
      key,
      merchant: first.merchant,
      category: first.category,
      icon: biller.icon,
      label: biller.label,
      estimatedAmount: Math.round(estimatedAmount * 100) / 100,
      lastPaymentDate: sorted[sorted.length - 1]!.date,
      nextDueDate: next.toISOString().slice(0, 10),
      daysRemaining: daysBetween(today, next),
      occurrences: sorted.length,
      averageIntervalDays: avgInterval,
      paymentMode: sorted[sorted.length - 1]!.payment_mode ?? null,
    });
  }

  return bills.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export type BillUrgency = "paid" | "overdue" | "due-soon" | "upcoming";

export function billUrgency(bill: PredictedBill, paid: boolean): BillUrgency {
  if (paid) return "paid";
  if (bill.daysRemaining < 0) return "overdue";
  if (bill.daysRemaining <= 5) return "due-soon";
  return "upcoming";
}

export function formatDueDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
