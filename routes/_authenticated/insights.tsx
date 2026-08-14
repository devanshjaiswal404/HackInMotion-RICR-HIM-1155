import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateFinancialHealth } from "@/utils/healthScore";
import { formatCurrency } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { SavingsSimulator } from "@/components/dashboard/SavingsSimulator";

export const Route = createFileRoute("/_authenticated/insights")({
  component: HealthInsights,
  head: () => ({
    meta: [
      { title: "Health Insights — FinSight AI" },
      {
        name: "description",
        content:
          "Deep-dive into your financial health score, savings rate and personalized recommendations.",
      },
      { property: "og:title", content: "Health Insights — FinSight AI" },
      {
        property: "og:description",
        content: "Financial health score, savings rate and personalized recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const CATEGORY_MAP: Record<string, string> = {
  Food: "Food & Dining",
  Bills: "Utilities",
  Travel: "Transportation",
  Subscriptions: "Subscriptions",
  Income: "Income",
};

const RECO_STYLES: Record<string, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

function scoreColor(score: number) {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function scoreLabel(score: number) {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Needs attention";
  return "At risk";
}

function HealthInsights() {
  const { data, isLoading } = useQuery({
    queryKey: ["insights-transactions"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("transactions")
        .select("id, date, merchant, category, amount, type, payment_mode")
        .order("date", { ascending: true });
      if (error) throw error;
      return rows ?? [];
    },
  });

  const rows = data ?? [];
  const normalized = rows.map((r) => ({
    ...r,
    category: CATEGORY_MAP[r.category] ?? r.category,
    amount: r.type === "income" ? Number(r.amount) : -Math.abs(Number(r.amount)),
  }));

  const health = calculateFinancialHealth(normalized);

  if (isLoading) {
    return (
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Health Insights</h1>
        <p className="mt-2 text-sm text-muted-foreground">Loading your financial health data…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Health Insights</h1>
        <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-soft">
          <p className="font-display text-lg font-semibold">No transactions yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add transactions or import a CSV to generate your personalized health insights and
            recommendations.
          </p>
          <Button asChild className="mt-6">
            <Link to="/transactions">Go to Transactions</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Health Insights</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Personalized analysis of your spending, savings and financial habits.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Financial health score
          </p>
          <p className={`mt-2 font-display text-2xl sm:text-3xl font-semibold ${scoreColor(health.overall_score)}`}>
            {health.overall_score}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{scoreLabel(health.overall_score)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Savings rate
          </p>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-foreground">
            {health.metrics.savings_rate_percent}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Of total income</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Essential spending
          </p>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-foreground">
            {formatCurrency(health.metrics.essential_expenses ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Needs vs wants</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Subscription spend
          </p>
          <p className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-foreground">
            {formatCurrency(health.metrics.subscription_expenses ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Recurring services</p>
        </div>
      </div>

      <div className="mt-6">
        <SavingsSimulator rows={rows} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Score breakdown</h2>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Savings rate</span>
                <span className="font-medium">{health.breakdown.savings_rate_score}/40</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${(health.breakdown.savings_rate_score / 40) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Essential expenses</span>
                <span className="font-medium">{health.breakdown.essential_expense_score}/40</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${(health.breakdown.essential_expense_score / 40) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subscriptions</span>
                <span className="font-medium">{health.breakdown.subscription_score}/20</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${(health.breakdown.subscription_score / 20) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Recommendations</h2>
          {health.recommendations.map((r) => (
            <div
              key={r.title}
              className={`rounded-xl border p-5 shadow-soft ${RECO_STYLES[r.type] ?? RECO_STYLES["warning"]}`}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-current px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {r.type}
                </span>
                <p className="font-display text-sm font-semibold">{r.title}</p>
              </div>
              <p className="mt-2 text-sm text-foreground/80">{r.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
