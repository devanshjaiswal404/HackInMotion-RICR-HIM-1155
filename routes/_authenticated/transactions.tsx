import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatters";
import { CATEGORIES, SAMPLE_CSV } from "@/lib/transactions";
import { TransactionFormDialog } from "@/components/transactions/TransactionFormDialog";
import { CsvImportDialog } from "@/components/transactions/CsvImportDialog";
import { LinkExpenseDialog } from "@/components/transactions/LinkExpenseDialog";
import { buildReimbursementMap, isP2PCredit } from "@/lib/reimbursements";
import { loadDemoPitchState } from "@/lib/demoData";
import { SubscriptionAudit } from "@/components/subscriptions/SubscriptionAudit";
import { AccountFilter, AccountBadge } from "@/components/accounts/AccountFilter";
import { accountOf, filterByAccount } from "@/lib/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — FinSight AI" },
      {
        name: "description",
        content:
          "Add transactions manually or bulk-import a bank CSV with automatic categorization and row-level validation.",
      },
      { property: "og:title", content: "Transactions — FinSight AI" },
      {
        property: "og:description",
        content: "Manual entry, CSV import and auto-categorized spending records in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Transactions,
});

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-bank-statement.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function Transactions() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [account, setAccount] = useState("All Accounts");
  const [linkCreditId, setLinkCreditId] = useState<string | null>(null);

  const demoMutation = useMutation({
    mutationFn: loadDemoPitchState,
    onSuccess: ({ inserted, score }) => {
      toast.success(`Loaded ${inserted} demo transactions — health score ${score}`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["health_scores"] });
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Transaction deleted");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filterByAccount(data ?? [], account).filter((t) => {
      if (q && !`${t.merchant} ${t.category} ${t.payment_mode ?? ""}`.toLowerCase().includes(q)) return false;
      if (category !== "all" && t.category !== category) return false;
      if (type !== "all" && t.type !== type) return false;
      return true;
    });
  }, [data, search, category, type, account]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(CATEGORIES);
    (data ?? []).forEach((t) => set.add(t.category));
    return Array.from(set).sort();
  }, [data]);

  const reimbursements = useMemo(() => buildReimbursementMap(data ?? []), [data]);
  const expenseOptions = useMemo(
    () => (data ?? []).filter((t) => t.type === "expense"),
    [data],
  );
  const linkCredit = useMemo(
    () => (data ?? []).find((t) => t.id === linkCreditId) ?? null,
    [data, linkCreditId],
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Recent Transactions & AI Categorization
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automatically categorizing transactions with keyword & rules engine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setFormOpen(true)}>➕ Add Single Transaction</Button>
          <Button
            onClick={() => setImportOpen(true)}
            className="bg-emerald-500 text-white hover:bg-emerald-600"
          >
            📥 Upload Bank CSV Statement
          </Button>
          <Button
            variant="outline"
            onClick={() => demoMutation.mutate()}
            disabled={demoMutation.isPending}
          >
            {demoMutation.isPending ? "Loading demo…" : "⚡ Load Demo Dataset"}
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchant, category or mode…"
          maxLength={80}
          className="h-9 w-full sm:w-72"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AccountFilter value={account} onChange={setAccount} className="w-full sm:w-auto" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" className="w-full sm:ml-auto sm:w-auto" onClick={downloadSampleCsv}>
          📥 Download Sample Bank Statement (CSV)
        </Button>
      </div>

      <div className="mt-6 w-full overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Loading transactions…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-destructive">
                  Could not load transactions.
                </td>
              </tr>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {(data?.length ?? 0) === 0
                    ? "No transactions yet — add one or import a CSV."
                    : "No transactions match your filters."}
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const p2p = isP2PCredit(t);
              const net = reimbursements.get(t.id);
              return (
              <tr key={t.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{t.date}</td>
                <td className="px-4 py-3 font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{t.merchant}</span>
                    {p2p && (
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-300">
                        P2P Credit
                      </span>
                    )}
                    {net && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(net.original)} Original → {formatCurrency(net.net)} Net Spend
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <AccountBadge account={accountOf(t)} />
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                    {t.category}
                  </span>
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                    t.type === "income" ? "text-primary" : "text-foreground"
                  }`}
                >
                  {t.type === "income" ? "+" : "−"}
                  {formatCurrency(t.amount)}
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{t.type}</td>
                <td className="px-4 py-3 text-right">
                  {p2p && (
                    <button
                      onClick={() => setLinkCreditId(t.id)}
                      className="mr-2 rounded-md border border-blue-500/40 px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/10 dark:text-blue-300"
                    >
                      🔗 {t.linked_expense_id ? "Relink" : "Link to Expense"}
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(t.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <SubscriptionAudit rows={data ?? []} compact />
      </div>

      <TransactionFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <LinkExpenseDialog
        credit={linkCredit}
        expenses={expenseOptions}
        onOpenChange={(open) => !open && setLinkCreditId(null)}
      />
    </div>
  );
}
