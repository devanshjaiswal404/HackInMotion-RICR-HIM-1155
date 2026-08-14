import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DINING_CATEGORIES,
  DISCRETIONARY_CATEGORIES,
  SUBSCRIPTION_CATEGORIES,
  healthOf,
  monthSpan,
  simulatedHealth,
  spendInCategories,
  type AnalyticsRow,
} from "@/lib/analytics";

export function SavingsSimulator({ rows }: { rows: AnalyticsRow[] }) {
  const queryClient = useQueryClient();
  const [dining, setDining] = useState(30);
  const [subs, setSubs] = useState(50);
  const [shopping, setShopping] = useState(20);

  const months = monthSpan(rows);
  const diningSpend = spendInCategories(rows, DINING_CATEGORIES);
  const subsSpend = spendInCategories(rows, SUBSCRIPTION_CATEGORIES);
  const discSpend = spendInCategories(rows, DISCRETIONARY_CATEGORIES);

  const savedTotal =
    (diningSpend * dining) / 100 + (subsSpend * subs) / 100 + (discSpend * shopping) / 100;
  const monthlySavings = savedTotal / months;
  const annualSavings = monthlySavings * 12;

  const currentScore = healthOf(rows).overall_score;
  const newScore = simulatedHealth(rows, {
    dining,
    subscriptions: subs,
    discretionary: shopping,
  }).overall_score;
  const boost = Math.max(0, newScore - currentScore);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Your session expired. Please log in again.");
      const userId = userData.user.id;

      const goals: { category: string; monthly_limit: number }[] = [
        { category: "Food & Dining", monthly_limit: (diningSpend / months) * (1 - dining / 100) },
        { category: "Subscriptions", monthly_limit: (subsSpend / months) * (1 - subs / 100) },
        { category: "Shopping", monthly_limit: (discSpend / months) * (1 - shopping / 100) },
      ].filter((g) => g.monthly_limit > 0);

      if (goals.length === 0) throw new Error("No spending found in these categories to budget.");

      const { error: delError } = await supabase
        .from("budgets")
        .delete()
        .eq("user_id", userId)
        .in(
          "category",
          goals.map((g) => g.category),
        );
      if (delError) throw new Error(delError.message);

      const { error } = await supabase.from("budgets").insert(
        goals.map((g) => ({
          user_id: userId,
          category: g.category,
          monthly_limit: Math.round(g.monthly_limit * 100) / 100,
        })),
      );
      if (error) throw new Error(error.message);
      return goals.length;
    },
    onSuccess: (count) => {
      toast.success(`Applied simulation to ${count} budget goals`);
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sliders = [
    { label: "Reduce Food Delivery / Dining by", value: dining, set: setDining },
    { label: "Cancel Unused Subscriptions", value: subs, set: setSubs },
    { label: "Trim Discretionary Shopping by", value: shopping, set: setShopping },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-5 text-primary" aria-hidden />
        <div>
          <h2 className="font-display text-lg font-semibold">Savings Simulator</h2>
          <p className="text-xs text-muted-foreground">
            Drag the sliders to see what small habit changes would do for you.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {sliders.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold tabular-nums">{s.value}%</span>
            </div>
            <Slider
              className="mt-2"
              value={[s.value]}
              min={0}
              max={100}
              step={5}
              aria-label={s.label}
              onValueChange={(v) => s.set(v[0] ?? 0)}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Projected monthly savings
          </p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            +{formatCurrency(monthlySavings)}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Projected annual savings
          </p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            +{formatCurrency(annualSavings)}
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
            Simulated health score boost
          </p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums text-primary">
            {currentScore} → {newScore} pts (+{boost})
          </p>
        </div>
      </div>

      <Button
        className="mt-5"
        onClick={() => applyMutation.mutate()}
        disabled={applyMutation.isPending}
      >
        {applyMutation.isPending ? "Applying…" : "Apply Simulation to Budget Goals"}
      </Button>
    </div>
  );
}
