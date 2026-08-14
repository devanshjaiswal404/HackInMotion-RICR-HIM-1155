import { useMemo } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/formatters";
import { calculateFinancialHealth } from "@/utils/healthScore";
import {
  detectSubscriptions,
  excludeCanceled,
  type DetectorTxn,
} from "@/utils/subscriptionDetector";
import { useCanceledSubscriptions } from "@/lib/canceledSubscriptions";
import { Button } from "@/components/ui/button";

type Props = {
  rows: DetectorTxn[];
  /** Renders a compact variant without the intro copy. */
  compact?: boolean;
};

function scoreFor(rows: DetectorTxn[], canceledKeys: string[]) {
  const kept = excludeCanceled(rows, canceledKeys);
  const normalized = kept.map((r) => ({
    ...r,
    amount: r.type === "income" ? Number(r.amount) : -Math.abs(Number(r.amount)),
  }));
  return calculateFinancialHealth(normalized).overall_score;
}

export function SubscriptionAudit({ rows, compact = false }: Props) {
  const { canceledKeys, cancel, restore } = useCanceledSubscriptions();

  const totalIncome = useMemo(
    () =>
      rows.reduce(
        (sum, r) =>
          r.type === "income" || r.category === "Income" ? sum + Math.abs(Number(r.amount)) : sum,
        0,
      ),
    [rows],
  );

  const audit = useMemo(
    () => detectSubscriptions(rows, { totalIncome, canceledKeys }),
    [rows, totalIncome, canceledKeys],
  );

  const handleCancel = (key: string, merchant: string) => {
    const before = scoreFor(rows, canceledKeys);
    const after = scoreFor(rows, [...canceledKeys, key]);
    cancel(key);
    const delta = Math.max(0, Math.round(after - before));
    toast.success(`🎉 Health Score boosted by +${delta} pts!`, {
      description: `${merchant} removed from your monthly overhead.`,
      action: { label: "Undo", onClick: () => restore(key) },
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Recurring Subscriptions & Audit</h2>
          {!compact && (
            <p className="mt-1 text-sm text-muted-foreground">
              Detected recurring charges, forgotten services and overlapping streaming plans.
            </p>
          )}
        </div>
        {canceledKeys.length > 0 && (
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {canceledKeys.length} marked canceled
          </span>
        )}
      </div>

      <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total Monthly Recurring Overhead
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {formatCurrency(audit.totalMonthlySubscriptionSpend)}
          </p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Potential Monthly Savings
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            {formatCurrency(audit.potentialMonthlySavings)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Share of Income
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {audit.subscriptionPercentageOfIncome.toFixed(1)}%
          </p>
        </div>
      </div>

      {audit.subscriptions.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No recurring subscriptions detected yet.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border">
          {audit.subscriptions.map((s) => {
            const flagged = s.flags.length > 0;
            return (
              <li key={s.key} className="flex flex-wrap items-center gap-3 py-3">
                <span aria-hidden className="text-xl">
                  {s.icon}
                </span>
                <div className="min-w-[9rem] flex-1">
                  <p className="text-sm font-medium">{s.merchant}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {s.frequency} · last charge {s.lastCharge}
                    {flagged && s.flagReason ? ` · ${s.flagReason}` : ""}
                  </p>
                </div>
                <p className="tabular-nums text-sm font-semibold">
                  {formatCurrency(s.amount)}
                  {s.frequency === "annual" && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({formatCurrency(s.monthlyCost)}/mo)
                    </span>
                  )}
                </p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                    flagged
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {flagged ? "⚠️ Flagged: Unused/Overhead" : "Active"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleCancel(s.key, s.merchant)}
                >
                  Mark as Canceled
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
