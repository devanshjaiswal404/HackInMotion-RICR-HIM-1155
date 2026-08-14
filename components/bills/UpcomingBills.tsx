import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatters";
import {
  billUrgency,
  formatDueDate,
  predictUpcomingBills,
  type BillTxn,
  type PredictedBill,
} from "@/utils/billPredictor";
import { paidToken, useBillReminders } from "@/lib/billReminders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const BADGE_STYLES: Record<string, string> = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  overdue: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  "due-soon": "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  upcoming: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

function badgeText(bill: PredictedBill, urgency: string) {
  if (urgency === "paid") return "✅ Paid";
  if (urgency === "overdue") return `🔴 Overdue by ${Math.abs(bill.daysRemaining)} day${Math.abs(bill.daysRemaining) === 1 ? "" : "s"}`;
  if (urgency === "due-soon") return `⏰ Due in ${bill.daysRemaining} day${bill.daysRemaining === 1 ? "" : "s"}`;
  return `📅 Upcoming (${bill.daysRemaining} days left)`;
}

export function useBillPredictions(rows: BillTxn[]) {
  const { paidTokens, alertKeys, markPaid, toggleAlert } = useBillReminders();
  const bills = useMemo(() => predictUpcomingBills(rows), [rows]);
  const isPaid = (b: PredictedBill) => paidTokens.includes(paidToken(b.key, b.nextDueDate));
  return { bills, isPaid, alertKeys, markPaid, toggleAlert };
}

/** Top banner shown when bills are overdue or due within 3 days. */
export function BillAlertBanner({ rows }: { rows: BillTxn[] }) {
  const { bills, isPaid } = useBillPredictions(rows);
  const urgent = bills.filter((b) => !isPaid(b) && b.daysRemaining <= 3);
  if (urgent.length === 0) return null;
  const total = urgent.reduce((s, b) => s + b.estimatedAmount, 0);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
      ⏰ Reminder: You have {urgent.length} bill{urgent.length === 1 ? "" : "s"} totaling{" "}
      <span className="font-semibold tabular-nums">{formatCurrency(total)}</span> due in the next 3
      days. Pay now to avoid late fees!
    </div>
  );
}

export function UpcomingBills({ rows }: { rows: BillTxn[] }) {
  const queryClient = useQueryClient();
  const { bills, isPaid, alertKeys, markPaid, toggleAlert } = useBillPredictions(rows);
  const [pending, setPending] = useState<string | null>(null);

  const payMutation = useMutation({
    mutationFn: async (bill: PredictedBill) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Your session expired. Please log in again.");
      const { error } = await supabase.from("transactions").insert({
        user_id: userData.user.id,
        date: new Date().toISOString().slice(0, 10),
        merchant: bill.merchant,
        category: bill.category,
        amount: bill.estimatedAmount,
        type: "expense",
        payment_mode: bill.paymentMode,
      });
      if (error) throw new Error(error.message);
      return bill;
    },
    onMutate: (bill: PredictedBill) => setPending(bill.key),
    onSettled: () => setPending(null),
    onSuccess: (bill) => {
      markPaid(paidToken(bill.key, bill.nextDueDate));
      toast.success("🎉 Bill paid! Updated your Financial Health Score");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (bills.length === 0) return null;

  const unpaid = bills.filter((b) => !isPaid(b));
  const totalDue = unpaid.reduce((s, b) => s + b.estimatedAmount, 0);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold sm:text-lg">
            Upcoming Bills &amp; Smart Reminders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Predicted from your recurring payment history.
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming this month</p>
            <p className="font-display text-xl font-semibold tabular-nums">{unpaid.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total estimated due</p>
            <p className="font-display text-xl font-semibold tabular-nums">{formatCurrency(totalDue)}</p>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {bills.map((bill) => {
          const paid = isPaid(bill);
          const urgency = billUrgency(bill, paid);
          const alertOn = alertKeys.includes(bill.key);
          return (
            <li
              key={bill.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  <span aria-hidden className="mr-1.5">{bill.icon}</span>
                  {bill.label} — {bill.merchant}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Due {formatDueDate(bill.nextDueDate)} · Est.{" "}
                  <span className="tabular-nums">{formatCurrency(bill.estimatedAmount)}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant="outline"
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE_STYLES[urgency]}`}
                >
                  {badgeText(bill, urgency)}
                </Badge>

                <div className="flex items-center gap-1.5">
                  <Switch
                    id={`alert-${bill.key}`}
                    checked={alertOn}
                    onCheckedChange={() => toggleAlert(bill.key)}
                  />
                  <Label htmlFor={`alert-${bill.key}`} className="text-xs text-muted-foreground">
                    Set alert
                  </Label>
                </div>

                <Button
                  size="sm"
                  variant={paid ? "secondary" : "default"}
                  disabled={paid || pending === bill.key}
                  onClick={() => payMutation.mutate(bill)}
                >
                  {paid ? "Paid ✅" : pending === bill.key ? "Saving…" : "Mark as Paid"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
