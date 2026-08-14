import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORIES,
  PAYMENT_MODES,
  dedupeKey,
  detectAnomalies,
  mapCsvToRows,
  parseAmount,
  parseCsv,
  validateRow,
  type ReviewRow,
} from "@/lib/transactions";
import { parseUpiStatement } from "@/utils/csvParser";
import { recalculateHealthScore } from "@/lib/healthSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function CsvImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const { data: existing } = useQuery({
    queryKey: ["transactions", "dedupe-keys"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("date, merchant, amount");
      if (error) throw error;
      return data;
    },
  });

  const existingKeys = useMemo(
    () => new Set((existing ?? []).map((t) => dedupeKey(t.date, t.merchant, Number(t.amount)))),
    [existing],
  );

  const validity = useMemo(() => (rows ?? []).map((r) => validateRow(r)), [rows]);
  const flags = useMemo(() => detectAnomalies(rows ?? [], existingKeys), [rows, existingKeys]);
  const validCount = validity.filter((v) => Object.keys(v).length === 0).length;
  const invalidCount = (rows?.length ?? 0) - validCount;
  const duplicateCount = flags.filter((f) => f.duplicate).length;
  const anomalyCount = flags.filter((f) => f.highSpend).length;

  function reset() {
    setRows(null);
    setDragging(false);
    setFileError(null);
  }

  async function handleFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setFileError("Please upload a .csv file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileError("File is too large (max 2 MB).");
      return;
    }
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      const parsed = parseUpiStatement(grid) ?? mapCsvToRows(grid);
      if (parsed.length === 0) {
        setFileError("No data rows found in that CSV.");
        return;
      }
      setRows(parsed);
    } catch {
      setFileError("Could not read that file. Try re-exporting it as CSV.");
    }
  }

  function update(key: string, patch: Partial<ReviewRow>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? prev);
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const clean = (rows ?? []).filter((r) => Object.keys(validateRow(r)).length === 0);
      if (clean.length === 0) throw new Error("There are no valid rows to import.");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Your session expired. Please log in again.");
      const userId = userData.user.id;

      const payload = clean.map((r) => ({
        user_id: userId,
        date: r.date,
        merchant: r.merchant.trim().slice(0, 120),
        category: r.category.slice(0, 60),
        amount: Math.abs(parseAmount(r.amount)!),
        type: r.type,
        payment_mode: r.payment_mode ? r.payment_mode.slice(0, 20) : null,
      }));

      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from("transactions").insert(payload.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
      return payload.length;
    },
    onSuccess: async (count) => {
      toast.success(`Imported ${count} transaction${count === 1 ? "" : "s"}`);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) await recalculateHealthScore(userData.user.id);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["health_scores"] });
      queryClient.invalidateQueries();
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {rows ? "Pre-import data review" : "Import bank CSV"}
          </DialogTitle>
          <DialogDescription>
            {rows
              ? "Fix flagged rows inline or discard them, then save the clean records."
              : "Drop your bank statement below. Categories are assigned automatically from the description."}
          </DialogDescription>
        </DialogHeader>

        {!rows && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleFile(e.dataTransfer.files[0]);
              }}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragging ? "border-primary bg-accent/50" : "border-border bg-muted/40"
              }`}
            >
              <p className="font-medium">
                Drag and drop your bank CSV statement here, or click to browse files.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Supports standard bank formats.</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => inputRef.current?.click()}>
                Choose CSV file
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </div>
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            <p className="text-xs text-muted-foreground">
              Expected columns: Date, Description/Merchant, Amount, Type, Payment Mode. Messy and relative
              dates are standardized automatically.
            </p>
          </div>
        )}

        {rows && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
                {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="rounded-full bg-destructive/10 px-3 py-1 font-medium text-destructive">
                  {invalidCount} need attention
                </span>
              )}
              {duplicateCount > 0 && (
                <span className="rounded-full bg-destructive/10 px-3 py-1 font-medium text-destructive">
                  {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"}
                </span>
              )}
              {anomalyCount > 0 && (
                <span className="rounded-full bg-amber-500/15 px-3 py-1 font-medium text-amber-600">
                  {anomalyCount} high spend
                </span>
              )}
              <button
                type="button"
                onClick={reset}
                className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Upload a different file
              </button>
            </div>

            <div className="max-h-[46vh] overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Merchant</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const errors = validity[i] ?? {};
                    const bad = Object.keys(errors).length > 0;
                    const flag = flags[i] ?? { duplicate: false, highSpend: false };
                    return (
                      <tr key={row.key} className={`border-t border-border ${bad ? "bg-destructive/5" : ""}`}>
                        <td className="px-3 py-2">
                          <Input
                            type="date"
                            value={row.date}
                            aria-invalid={!!errors.date}
                            onChange={(e) => update(row.key, { date: e.target.value })}
                            className={`h-9 w-[9.5rem] ${errors.date ? "border-destructive ring-1 ring-destructive" : ""}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={row.merchant}
                            placeholder="Merchant required"
                            aria-invalid={!!errors.merchant}
                            onChange={(e) => update(row.key, { merchant: e.target.value })}
                            className={`h-9 min-w-[11rem] ${errors.merchant ? "border-destructive ring-1 ring-destructive" : ""}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Select value={row.category} onValueChange={(v) => update(row.key, { category: v })}>
                            <SelectTrigger className="h-9 w-[10.5rem]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={row.type}
                            onValueChange={(v) => update(row.key, { type: v as "expense" | "income" })}
                          >
                            <SelectTrigger className="h-9 w-[7.5rem]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="expense">Expense</SelectItem>
                              <SelectItem value="income">Income</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={row.payment_mode || "none"}
                            onValueChange={(v) => update(row.key, { payment_mode: v === "none" ? "" : v })}
                          >
                            <SelectTrigger className="h-9 w-[7.5rem]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {PAYMENT_MODES.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={row.amount}
                            inputMode="decimal"
                            placeholder="0.00"
                            aria-invalid={!!errors.amount}
                            onChange={(e) => update(row.key, { amount: e.target.value })}
                            className={`h-9 w-28 ${errors.amount ? "border-destructive ring-1 ring-destructive" : ""}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-start gap-1">
                            {flag.duplicate && (
                              <span className="whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                ⚠️ Duplicate
                              </span>
                            )}
                            {flag.highSpend && (
                              <span className="whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
                                ⚡ High Spend Anomaly
                              </span>
                            )}
                            {!flag.duplicate && !flag.highSpend && !bad && (
                              <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                ✓ Clean
                              </span>
                            )}
                            {bad && (
                              <span className="whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                ✗ Needs fix
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setRows((prev) => prev?.filter((r) => r.key !== row.key) ?? prev)}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                          >
                            Discard
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-emerald-500 text-white hover:bg-emerald-600"
                disabled={validCount === 0 || importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending
                  ? "Saving…"
                  : `Confirm & Import Clean Data (${validCount})`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
