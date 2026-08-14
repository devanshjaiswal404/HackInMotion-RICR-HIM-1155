import { Users } from "lucide-react";
import {
  DINING_CATEGORIES,
  DISCRETIONARY_CATEGORIES,
  HOUSING_CATEGORIES,
  spendInCategories,
  totalExpenses,
  totalIncome,
  type AnalyticsRow,
} from "@/lib/analytics";

type Benchmark = {
  label: string;
  yours: number;
  peer: number;
  /** true when a higher value is better (savings rate). */
  higherIsBetter?: boolean;
};

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function PeerBenchmarks({ rows }: { rows: AnalyticsRow[] }) {
  const income = totalIncome(rows);
  const expenses = totalExpenses(rows);
  const base = income > 0 ? income : expenses;

  const benchmarks: Benchmark[] = [
    { label: "Food & Dining", yours: pct(spendInCategories(rows, DINING_CATEGORIES), base), peer: 15 },
    { label: "Housing & Bills", yours: pct(spendInCategories(rows, HOUSING_CATEGORIES), base), peer: 35 },
    {
      label: "Discretionary / Shopping",
      yours: pct(spendInCategories(rows, DISCRETIONARY_CATEGORIES), base),
      peer: 12,
    },
    {
      label: "Savings Rate",
      yours: pct(Math.max(0, income - expenses), income),
      peer: 25,
      higherIsBetter: true,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 size-5 text-primary" aria-hidden />
        <div>
          <h2 className="font-display text-lg font-semibold">Peer Spending Benchmarks</h2>
          <p className="text-xs text-muted-foreground">
            Compared with Young Professionals (Income ₹50k – ₹1L / $3k – $6k/mo)
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {benchmarks.map((b) => {
          const better = b.higherIsBetter ? b.yours >= b.peer : b.yours <= b.peer;
          const diff = Math.round(Math.abs(b.yours - b.peer) * 10) / 10;
          const scale = Math.max(b.yours, b.peer, 1) * 1.15;
          return (
            <div key={b.label}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{b.label}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    better
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                  }`}
                >
                  {better ? "Outperforming" : b.higherIsBetter ? "Below peers" : "Overspending"} by {diff} pts
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] text-muted-foreground">You</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${better ? "bg-emerald-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, (b.yours / scale) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums">
                    {b.yours}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Peer avg</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                      style={{ width: `${Math.min(100, (b.peer / scale) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {b.peer}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
