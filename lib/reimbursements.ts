/** Smart Reimbursement Linker helpers: P2P credit detection and net-spend math. */

export const P2P_KEYWORDS = ["upi", "venmo", "zelle", "wise", "paypal", "transfer"] as const;

export type LinkableTxn = {
  id: string;
  merchant: string;
  category: string;
  amount: number | string;
  type: string;
  date?: string;
  linked_expense_id?: string | null;
};

/** True when the row is incoming money that came through a peer-to-peer service. */
export function isP2PCredit(t: Pick<LinkableTxn, "merchant" | "type">): boolean {
  if (t.type !== "income") return false;
  const text = (t.merchant ?? "").toLowerCase();
  return P2P_KEYWORDS.some((k) => text.includes(k));
}

export type NetSpend = { original: number; reimbursed: number; net: number };

/** Maps expense id -> original/reimbursed/net amounts based on linked P2P credits. */
export function buildReimbursementMap<T extends LinkableTxn>(rows: T[]): Map<string, NetSpend> {
  const expenses = new Map<string, T>();
  rows.forEach((r) => {
    if (r.type === "expense") expenses.set(r.id, r);
  });

  const map = new Map<string, NetSpend>();
  rows.forEach((r) => {
    if (!r.linked_expense_id || r.type !== "income") return;
    const expense = expenses.get(r.linked_expense_id);
    if (!expense) return;
    const original = Math.abs(Number(expense.amount));
    const prev = map.get(expense.id);
    const reimbursed = (prev?.reimbursed ?? 0) + Math.abs(Number(r.amount));
    map.set(expense.id, {
      original,
      reimbursed,
      net: Math.max(0, original - reimbursed),
    });
  });
  return map;
}

/**
 * Returns rows adjusted for reimbursements: linked expenses shrink to their net
 * spend and the linked P2P credits drop out (they are not real income).
 */
export function netAdjustedRows<T extends LinkableTxn>(rows: T[]): T[] {
  const map = buildReimbursementMap(rows);
  return rows
    .filter((r) => !(r.type === "income" && r.linked_expense_id && map.has(r.linked_expense_id)))
    .map((r) => {
      const net = map.get(r.id);
      return net ? { ...r, amount: net.net } : r;
    });
}