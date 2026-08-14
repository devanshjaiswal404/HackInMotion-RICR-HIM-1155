import { formatCurrency } from "@/utils/formatters";
import {
  DINING_CATEGORIES,
  DISCRETIONARY_CATEGORIES,
  SUBSCRIPTION_CATEGORIES,
  absAmount,
  healthOf,
  isIncome,
  monthSpan,
  spendByCategory,
  spendInCategories,
  totalExpenses,
  totalIncome,
  type AnalyticsRow,
} from "@/lib/analytics";

export const QUICK_PROMPTS = [
  "How much did I spend on food this month?",
  "What is my largest recurring subscription?",
  "How can I improve my Financial Health Score?",
];

function currentMonthRows(rows: AnalyticsRow[]) {
  const months = Array.from(
    new Set(rows.map((r) => (r.date ? String(r.date).slice(0, 7) : "")).filter(Boolean)),
  ).sort();
  const latest = months[months.length - 1];
  if (!latest) return rows;
  return rows.filter((r) => String(r.date ?? "").startsWith(latest));
}

function topCategory(rows: AnalyticsRow[]) {
  const entries = Object.entries(spendByCategory(rows)).sort((a, b) => b[1] - a[1]);
  return entries[0] ?? null;
}

function recurringMerchants(rows: AnalyticsRow[]) {
  const map = new Map<string, { total: number; count: number }>();
  rows
    .filter((r) => !isIncome(r) && SUBSCRIPTION_CATEGORIES.includes(r.category))
    .forEach((r) => {
      const key = (r.merchant ?? "Unknown").trim();
      const prev = map.get(key) ?? { total: 0, count: 0 };
      map.set(key, { total: prev.total + absAmount(r), count: prev.count + 1 });
    });
  return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
}

/** Template answers for general (non-personal) finance questions. */
const GENERAL_TEMPLATES: { test: RegExp; answer: string }[] = [
  {
    test: /50\/30\/20|50 30 20|budget rule|budgeting rule|how to budget|budget kaise/,
    answer:
      "A simple starting point is the 50/30/20 rule: 50% of take-home pay for needs (rent, bills, groceries, transport), 30% for wants (dining, shopping, subscriptions), and 20% for savings and debt payoff. Automate the 20% on payday so it never depends on willpower, and review the 30% bucket first whenever you need to free up cash.",
  },
  {
    test: /emergency fund|rainy day|emergency corpus/,
    answer:
      "Aim for 3-6 months of essential expenses in an emergency fund — 6+ months if your income is variable or freelance. Keep it in a liquid, boring place (high-yield savings or a liquid fund), separate from your spending account, and build it before investing aggressively.",
  },
  {
    test: /invest|sip|mutual fund|stocks|equity/,
    answer:
      "General guidance: clear high-interest debt and build an emergency fund first, then invest a fixed amount every month (an SIP) into low-cost diversified index funds rather than timing the market. Match risk to horizon — money you need within 3 years should stay in debt/savings instruments. This is educational information, not personalised investment advice.",
  },
  {
    test: /debt|loan|emi|credit card|interest/,
    answer:
      "Pay minimums on everything, then attack the highest-interest balance first (usually credit cards at 30-40% APR) — that's the avalanche method and saves the most money. If you need motivation, the snowball method (smallest balance first) works too. Avoid revolving a card balance; converting it to a lower-rate personal loan is often cheaper.",
  },
  {
    test: /save money|how.*save|paisa bacha|kaise bachau|reduce spending|cut cost/,
    answer:
      "Three levers, in order of impact: cancel recurring charges you don't use weekly, cap one high-frequency category (usually food delivery) with a weekly limit, and automate a transfer to savings on payday. Fixing recurring leaks beats trying to be frugal on every single purchase.",
  },
];

function generalAnswer(q: string): string | null {
  return GENERAL_TEMPLATES.find((t) => t.test.test(q))?.answer ?? null;
}

/**
 * Lightweight natural-language parser that answers money questions with exact
 * figures computed from the loaded transactions.
 */
export function answerQuestion(question: string, rows: AnalyticsRow[]): string {
  const q = question.toLowerCase().trim();

  const isPersonal = /\bmy\b|\bi\b|mera|meri|mujhe|this month|spent|spend/.test(q);
  if (!isPersonal) {
    const general = generalAnswer(q);
    if (general) return general;
  }

  if (rows.length === 0) {
    return (
      generalAnswer(q) ??
      "I don't see any transactions yet. Import a CSV or add a few transactions and I'll crunch the numbers for you."
    );
  }

  const income = totalIncome(rows);
  const expenses = totalExpenses(rows);
  const months = monthSpan(rows);
  const month = currentMonthRows(rows);

  // Food / dining
  if (/food|dining|eat|restaurant|swiggy|zomato|delivery|grocer/.test(q)) {
    const scoped = /month/.test(q) ? month : rows;
    const spend = spendInCategories(scoped, DINING_CATEGORIES);
    const share = expenses > 0 ? Math.round((spend / totalExpenses(scoped || rows)) * 100) : 0;
    return `You spent ${formatCurrency(spend)} on Food & Dining${
      /month/.test(q) ? " this month" : ""
    } — about ${share}% of your spending in that period. Peers at your income level average ~15%. Cooking two extra meals a week here would free up roughly ${formatCurrency(
      spend * 0.25,
    )}.`;
  }

  // Subscriptions
  if (/subscription|recurring|netflix|spotify|membership/.test(q)) {
    const list = recurringMerchants(rows);
    if (list.length === 0) {
      return "I couldn't find any recurring subscription charges in your transactions — nice, that's one less leak to worry about.";
    }
    const [name, stats] = list[0]!;
    const monthly = stats.total / months;
    const totalSubs = spendInCategories(rows, SUBSCRIPTION_CATEGORIES);
    return `Your largest recurring subscription is ${name} at ${formatCurrency(
      monthly,
    )}/month (${formatCurrency(stats.total)} across ${stats.count} charges). All subscriptions together cost you ${formatCurrency(
      totalSubs / months,
    )}/month — cancelling the ones you don't use weekly is the fastest win.`;
  }

  // Health score
  if (/health score|improve|score|better|advice|tips/.test(q)) {
    const health = healthOf(rows);
    const tips = health.recommendations.slice(0, 2).map((r) => r.message);
    const disc = spendInCategories(rows, DISCRETIONARY_CATEGORIES) / months;
    return `Your Financial Health Score is ${health.overall_score}/100 (savings ${health.breakdown.savings_rate_score}/40, essentials ${health.breakdown.essential_expense_score}/40, subscriptions ${health.breakdown.subscription_score}/20). ${
      tips.length ? tips.join(" ") + " " : ""
    }Trimming discretionary spending — currently ${formatCurrency(
      disc,
    )}/month — by 20% and cancelling unused subscriptions typically lifts the score several points. Try the Savings Simulator to see the exact boost.`;
  }

  // Savings
  if (/save|saving|savings rate|surplus/.test(q)) {
    const net = income - expenses;
    const rate = income > 0 ? Math.round((net / income) * 100) : 0;
    return `You've saved ${formatCurrency(net)} overall — a ${rate}% savings rate versus the ~25% peer average. That's ${formatCurrency(
      net / months,
    )}/month on average.`;
  }

  // Income
  if (/income|earn|salary|make/.test(q)) {
    return `Your total recorded income is ${formatCurrency(income)} (${formatCurrency(
      income / months,
    )}/month across ${months} month${months > 1 ? "s" : ""}).`;
  }

  // Biggest expense / category
  if (/biggest|largest|most|top|where.*money|category/.test(q)) {
    const top = topCategory(rows);
    if (!top) return "I couldn't find any expenses to rank yet.";
    const [name, value] = top;
    const share = expenses > 0 ? Math.round((value / expenses) * 100) : 0;
    return `Your biggest spending category is ${name} at ${formatCurrency(
      value,
    )} — ${share}% of all expenses. Setting a budget rule here has the largest impact.`;
  }

  // Total spend
  if (/spend|spent|expense|total|much/.test(q)) {
    const scoped = /month/.test(q) ? month : rows;
    const spend = totalExpenses(scoped);
    const top = topCategory(scoped);
    return `You spent ${formatCurrency(spend)}${/month/.test(q) ? " this month" : " in total"}${
      top ? `, led by ${top[0]} at ${formatCurrency(top[1])}` : ""
    }.`;
  }

  const fallbackGeneral = generalAnswer(q);
  if (fallbackGeneral) return fallbackGeneral;

  const health = healthOf(rows);
  return `Here's a quick snapshot: income ${formatCurrency(income)}, expenses ${formatCurrency(
    expenses,
  )}, health score ${health.overall_score}/100. Ask me about food spending, subscriptions, savings rate, or how to improve your score.`;
}
