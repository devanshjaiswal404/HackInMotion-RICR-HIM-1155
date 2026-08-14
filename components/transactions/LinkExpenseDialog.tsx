import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatters";
import { recalculateHealthScore } from "@/lib/healthSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Txn = {
  id: string;
  user_id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number | string;
  type: string;
  linked_expense_id?: string | null;
};

export function LinkExpenseDialog({
  credit,
  expenses,
  onOpenChange,
}: {
  credit: Txn | null;
  expenses: Txn[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const creditAmount = credit ? Math.abs(Number(credit.amount)) : 0;

  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => !q || `${e.merchant} ${e.category}`.toLowerCase().includes(q))
      .slice(0, 25);
  }, [expenses, search]);

  const linkMutation = useMutation({
    mutationFn: async (expenseId: string | null) => {
      if (!credit) return;
      const { error } = await supabase
        .from("transactions")
        .update({ linked_expense_id: expenseId })
        .eq("id", credit.id);
      if (error) throw new Error(error.message);
      await recalculateHealthScore(credit.user_id);
    },
    onSuccess: (_d, expenseId) => {
      toast.success(expenseId ? "Reimbursement linked" : "Link removed");
      queryClient.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!credit} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>🔗 Link reimbursement to an expense</DialogTitle>
          <DialogDescription>
            {credit
              ? `Applying ${formatCurrency(creditAmount)} from “${credit.merchant}” against a recent expense.`
              : null}
          </DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recent expenses…"
          maxLength={80}
          className="h-9"
        />

        <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
          {options.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matching expenses found.
            </p>
          )}
          {options.map((e) => {
            const original = Math.abs(Number(e.amount));
            const net = Math.max(0, original - creditAmount);
            return (
              <button
                key={e.id}
                type="button"
                disabled={linkMutation.isPending}
                onClick={() => linkMutation.mutate(e.id)}
                className="flex w-full items-center justify-between gap-4 border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted disabled:opacity-50"
              >
                <span>
                  <span className="font-medium">{e.merchant}</span>
                  <span className="block text-xs text-muted-foreground">
                    {e.date} · {e.category}
                  </span>
                </span>
                <span className="whitespace-nowrap text-right tabular-nums">
                  <span className="text-muted-foreground line-through">
                    {formatCurrency(original)}
                  </span>{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(net)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {credit?.linked_expense_id && (
          <Button
            variant="outline"
            disabled={linkMutation.isPending}
            onClick={() => linkMutation.mutate(null)}
          >
            Remove existing link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}