import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateFinancialHealth } from "@/utils/healthScore";
import { formatCurrency } from "@/utils/formatters";
import { netAdjustedRows } from "@/lib/reimbursements";
import { excludeCanceled } from "@/utils/subscriptionDetector";
import { useCanceledSubscriptions } from "@/lib/canceledSubscriptions";
import { PeerBenchmarks } from "@/components/dashboard/PeerBenchmarks";
import { BillAlertBanner, UpcomingBills } from "@/components/bills/UpcomingBills";
import { AccountFilter } from "@/components/accounts/AccountFilter";
import { filterByAccount } from "@/lib/accounts";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — FinSight AI" },
      {
        name: "description",
        content:
          "See your income, expenses, savings rate and financial health score with category and monthly charts.",
      },
      { property: "og:title", content: "Dashboard — FinSight AI" },
      {
        property: "og:description",
        content: "Track your financial health score, savings rate and spending breakdown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const currency = formatCurrency;
const currency2 = formatCurrency;


/** Maps app categories onto the health utility's essential/subscription taxonomy. */
const CATEGORY_MAP: Record<string, string> = {
  Food: "Food & Dining",
  Bills: "Utilities",
  Travel: "Transportation",
  Subscriptions: "Subscriptions",
  Income: "Income",
};

/** Vibrant, high-contrast palette keyed by category name. */
const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "#10b981",
  "Rent & Housing": "#3b82f6",
  Subscriptions: "#f59e0b",
  Shopping: "#ec4899",
  "Health & Fitness": "#14b8a6",
  Utilities: "#06b6d4",
  Transportation: "#8b5cf6",
  Travel: "#a855f7",
  "Credit Card Payment": "#eab308",
  Bills: "#f43f5e",
  "General Expense": "#64748b",
  Other: "#64748b",
};

function categoryColor(name: string) {
  return CATEGORY_COLORS[name] ?? CATEGORY_COLORS["Other"] ?? "#64748b";
}

const FALLBACK_COLOR = "#64748b";

/** Dark-background tooltip for the spending donut. */
function DonutTooltip({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { name: string; value: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]!;
  const name = item.payload?.name ?? item.name ?? "";
  const value = Number(item.payload?.value ?? item.value ?? 0);
  return (
    <div
      className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
    >
      <p className="font-semibold">{name}</p>
      <p className="mt-0.5 tabular-nums text-popover-foreground/90">
        {currency(value)} spent
      </p>
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 75) return "hsl(152 60% 40%)";
  if (score >= 50) return "hsl(43 90% 48%)";
  return "hsl(0 72% 51%)";
}

function scoreLabel(score: number) {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Needs attention";
  return "At risk";
}

function Gauge({ score }: { score: number }) {
  const radius = 80;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[260px]">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth={16}
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
        <text x="100" y="88" textAnchor="middle" className="fill-foreground" style={{ fontSize: 34, fontWeight: 600 }}>
          {score}
        </text>
      </svg>
      <p className="text-sm font-medium" style={{ color }}>
        {scoreLabel(score)}
      </p>
      <p className="text-xs text-muted-foreground">Financial health score (0–100)</p>
    </div>
  );
}

const RECO_STYLES: Record<string, string> = {
  success:
    "border-[#10b981]/30 bg-[#10b981]/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger:
    "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  info:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

function Dashboard() {
  const { canceledKeys } = useCanceledSubscriptions();
  const [account, setAccount] = useState<string>("All Accounts");
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-transactions"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("transactions")
        .select("id, date, merchant, category, amount, type, payment_mode, linked_expense_id")
        .order("date", { ascending: true });
      if (error) throw error;
      return rows ?? [];
    },
  });

  const allRows = filterByAccount(netAdjustedRows(data ?? []), account);
  const rows = excludeCanceled(allRows, canceledKeys);

  const normalized = rows.map((r) => ({
    ...r,
    category: CATEGORY_MAP[r.category] ?? r.category,
    amount: r.type === "income" ? Number(r.amount) : -Math.abs(Number(r.amount)),
  }));

  const health = calculateFinancialHealth(normalized);
  const m = health.metrics;
  const netSavings = m.total_income - m.total_expenses;

  const categoryData = Object.entries(
    rows
      .filter((r) => r.type === "expense" || r.category !== "Income")
      .reduce<Record<string, number>>((acc, r) => {
        acc[r.category] = (acc[r.category] ?? 0) + Math.abs(Number(r.amount));
        return acc;
      }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const totalExpenses = categoryData.reduce((sum, c) => sum + c.value, 0);

  const totalIncome = rows.reduce((sum, r) => {
    if (r.type === "income" || r.category === "Income") return sum + Math.abs(Number(r.amount));
    return sum;
  }, 0);

  const totalExpense = rows.reduce((sum, r) => {
    if (r.type === "expense" || (r.category !== "Income" && r.type !== "income"))
      return sum + Math.abs(Number(r.amount));
    return sum;
  }, 0);

  const incomeExpenseData = [
    { name: "This period", income: totalIncome, expense: totalExpense },
  ];

  const expensesPctOfIncome =
    m.total_income > 0 ? Math.round((m.total_expenses / m.total_income) * 100) : 0;

  const kpis = [
    {
      label: "Total Monthly Income",
      value: currency(m.total_income),
      valueClass: "text-emerald-600 dark:text-emerald-400",
      badge: "+12% vs last month",
      badgeClass:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      tooltip:
        "Total gross income received across all linked accounts during the current calendar month.",
    },
    {
      label: "Total Expenses",
      value: currency(m.total_expenses),
      valueClass: "text-foreground",
      badge: `${expensesPctOfIncome}% of income spent`,
      badgeClass:
        "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
      tooltip:
        "Sum of all outgoing transactions including essential costs, bills, and discretionary spending.",
    },
    {
      label: "Net Savings",
      value: currency(netSavings),
      valueClass: "text-emerald-600 dark:text-emerald-400",
      badge: `${Math.round(m.savings_rate_percent)}% savings rate`,
      badgeClass:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      tooltip:
        "Calculated as Total Income minus Total Expenses for the current billing cycle.",
    },
    {
      label: "Financial Health Score",
      value: `${health.overall_score}/100`,
      valueClass: "text-primary",
      badge: "Target: >75/100",
      badgeClass:
        "border-primary/30 bg-primary/10 text-primary",
      tooltip:
        "Composite index calculated dynamically based on savings rate, essential expense ratio, and subscription overhead.",
    },
  ];

  if (isLoading) {
    return (
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Loading your financial snapshot…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Dashboard</h1>
          </div>
          <AccountFilter value={account} onChange={setAccount} />
        </header>
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-soft sm:p-12">
          <p className="font-display text-lg font-semibold">No transactions yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {account === "All Accounts"
              ? "Import a CSV or add transactions on the Transactions page to unlock your health score, insights and charts."
              : `No transactions found for ${account}. Try another account.`}
          </p>
          <Button asChild className="mt-6">
            <Link to="/transactions">Go to Transactions</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Dashboard</h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {account === "All Accounts"
              ? "A snapshot of your money across every account you track."
              : `Showing only ${account}.`}
          </p>
        </div>
        <AccountFilter value={account} onChange={setAccount} />
      </header>

      <BillAlertBanner rows={rows} />


      <TooltipProvider delayDuration={150}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {kpis.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5"
            >
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`More info about ${c.label}`}
                      className="text-muted-foreground/70 transition-colors hover:text-foreground"
                    >
                      <Info className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px] text-center leading-relaxed">
                    {c.tooltip}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className={`mt-2 font-display text-2xl font-semibold tabular-nums sm:text-3xl ${c.valueClass}`}>
                {c.value}
              </p>
              <Badge
                variant="outline"
                className={`mt-2 rounded-full px-2 py-0.5 text-[11px] font-medium sm:mt-3 ${c.badgeClass}`}
              >
                {c.badge}
              </Badge>
            </div>
          ))}
        </div>
      </TooltipProvider>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <Gauge score={health.overall_score} />
          <div className="mt-4 w-full space-y-1 text-xs text-muted-foreground">
            <p>Savings: {health.breakdown.savings_rate_score}/40</p>
            <p>Essentials: {health.breakdown.essential_expense_score}/40</p>
            <p>Subscriptions: {health.breakdown.subscription_score}/20</p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-display text-base font-semibold sm:text-lg">AI Insights</h2>
          <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3">
            {health.recommendations.map((insight) => (
              <div
                key={insight.title}
                className={`rounded-xl border p-4 shadow-soft sm:p-5 ${RECO_STYLES[insight.type]}`}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    {insight.type}
                  </span>
                  <p className="font-display text-sm font-semibold">{insight.title}</p>
                </div>
                <p className="mt-2 text-sm text-foreground/80">{insight.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <UpcomingBills rows={rows} />

      <PeerBenchmarks rows={rows} />


      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <div className="w-full rounded-xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <h2 className="font-display text-base font-semibold sm:text-lg">Spending by category</h2>
          <div className="mt-3 h-[240px] w-full sm:mt-4 sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2} stroke="none">
                  {categoryData.map((entry, i) => (
                    <Cell key={`${entry.name}-${i}`} fill={CATEGORY_COLORS[entry.name] ?? FALLBACK_COLOR} />
                  ))}
                </Pie>
                <ChartTooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-4">
            {categoryData.map((entry) => {
              const pct = totalExpenses > 0 ? Math.round((entry.value / totalExpenses) * 100) : 0;
              return (
                <li key={entry.name} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[entry.name] ?? FALLBACK_COLOR }}
                  />
                  <span className="font-medium text-foreground/80">{entry.name}</span>
                  <span className="tabular-nums">— {pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="w-full rounded-xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <h2 className="font-display text-base font-semibold sm:text-lg">Income vs expenses</h2>
          <div className="mt-3 h-[240px] w-full sm:mt-4 sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpenseData}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={56} tickFormatter={(v: number) => currency2(Number(v))} />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    color: "var(--popover-foreground)",
                  }}
                  labelStyle={{ color: "var(--popover-foreground)" }}
                  itemStyle={{ color: "var(--popover-foreground)" }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
