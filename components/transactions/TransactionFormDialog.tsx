import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, PAYMENT_MODES, categorize } from "@/lib/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  merchant: z.string().trim().min(1, "Merchant is required").max(120, "Keep it under 120 characters"),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(100000000),
  type: z.enum(["expense", "income"]),
  category: z.string().trim().min(1, "Category is required").max(60),
  payment_mode: z.string().max(20).optional(),
});

const today = () => new Date().toISOString().slice(0, 10);

export function TransactionFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(today);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("General Expense");
  const [paymentMode, setPaymentMode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDate(today());
    setMerchant("");
    setAmount("");
    setType("expense");
    setCategory("General Expense");
    setPaymentMode("");
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ date, merchant, amount, type, category, payment_mode: paymentMode });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Your session expired. Please log in again.");

      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: userData.user.id,
        date: parsed.data.date,
        merchant: parsed.data.merchant,
        category: parsed.data.category,
        amount: parsed.data.amount,
        type: parsed.data.type,
        payment_mode: parsed.data.payment_mode ? parsed.data.payment_mode : null,
      });
      if (insertError) throw new Error(insertError.message);
    },
    onSuccess: () => {
      toast.success("Transaction added");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Add transaction</DialogTitle>
          <DialogDescription>Record a single expense or income entry.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="tx-date">Date</Label>
            <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tx-amount">Amount</Label>
            <Input
              id="tx-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="tx-merchant">Merchant / description</Label>
            <Input
              id="tx-merchant"
              maxLength={120}
              placeholder="e.g. Swiggy order"
              value={merchant}
              onChange={(e) => {
                setMerchant(e.target.value);
                if (type === "expense") setCategory(categorize(e.target.value));
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                const next = v as "expense" | "income";
                setType(next);
                setCategory(next === "income" ? "Income" : categorize(merchant));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Payment mode (optional)</Label>
            <Select value={paymentMode || "none"} onValueChange={(v) => setPaymentMode(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Not specified" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
