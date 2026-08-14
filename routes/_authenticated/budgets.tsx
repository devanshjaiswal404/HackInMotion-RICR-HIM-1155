import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/transactions";
import { formatCurrency } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/budgets")({
  component: BudgetRules,
  head: () => ({
    meta: [
      { title: "Budget Rules — FinSight AI" },
      {
        name: "description",
        content: "Set monthly spending limits per category and stay ahead of your budget.",
      },
      { property: "og:title", content: "Budget Rules — FinSight AI" },
      {
        property: "og:description",
        content: "Monthly category spending limits and budget tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const currency = formatCurrency;

function BudgetRules() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");

  const { data: budgets, isLoading } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("budgets")
        .select("id, category, monthly_limit, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return rows ?? [];
    },
  });

  const { data: spentByCategory } = useQuery({
    queryKey: ["budgets-spending"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data: rows, error } = await supabase
        .from("transactions")
        .select("category, amount")
        .eq("type", "expense")
        .gte("date", startOfMonth);
      if (error) throw error;
      return (rows ?? []).reduce<Record<string, number>>((acc, r) => {
        acc[r.category] = (acc[r.category] ?? 0) + Math.abs(Number(r.amount));
        return acc;
      }, {});
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(limit);
      if (!category) throw new Error("Select a category.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a positive monthly limit.");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Your session expired. Please log in again.");

      const { error } = await supabase.from("budgets").insert({
        user_id: userData.user.id,
        category,
        monthly_limit: amount,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Budget rule added");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      setCategory("");
      setLimit("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Budget rule deleted");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const usedCategories = new Set(budgets?.map((b) => b.category) ?? []);
  const availableCategories = CATEGORIES.filter((c) => !usedCategories.has(c));

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Budget Rules</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Set monthly spending limits for each category and track your progress.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-soft lg:col-span-1">
          <h2 className="font-display text-lg font-semibold">Add budget rule</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
            className="mt-4 space-y-4"
          >
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Monthly limit</Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={addMutation.isPending || availableCategories.length === 0}>
              {addMutation.isPending ? "Saving…" : "Add Budget Rule"}
            </Button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-soft lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Active rules</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading budget rules…</p>
          ) : budgets?.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No budget rules yet. Add one to start tracking category spending.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {budgets?.map((b) => {
                const spent = spentByCategory?.[b.category] ?? 0;
                const pct = Math.min(100, Math.round((spent / Number(b.monthly_limit)) * 100));
                return (
                  <div key={b.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{b.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {currency(spent)} of {currency(Number(b.monthly_limit))} this month
                        </p>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(b.id)}
                        disabled={deleteMutation.isPending}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-xs text-muted-foreground">{pct}% used</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
