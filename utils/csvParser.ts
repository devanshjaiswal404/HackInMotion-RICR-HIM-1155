import { normalizeDate, parseAmount, type ReviewRow } from "@/lib/transactions";

/**
 * Parser for Indian bank / UPI transaction statements that ship with leading
 * metadata lines ("Transaction History", "Customer Mobile Number", ...) and a
 * Sender / Receiver / DR|CR / Amount (in Rs.) column layout.
 */

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADER_TOKENS = {
  date: ["date", "transactiondate", "txndate", "dateandtime", "datetime"],
  sender: ["sender", "senderdetails", "sendervpa", "from", "fromvpa", "payer", "senderupiid"],
  receiver: ["receiver", "receiverdetails", "receivervpa", "to", "tovpa", "payee", "receiverupiid", "beneficiary"],
  drcr: ["drcr", "crdr", "type", "debitcredit", "transactiontype"],
  amount: ["amountinrs", "amountinr", "amount", "amountrs", "transactionamount", "txnamount"],
  status: ["status", "transactionstatus"],
  ref: ["upitransactionid", "transactionid", "refno", "rrn", "utr"],
};

function findIndex(header: string[], tokens: string[]): number {
  const cells = header.map(norm);
  const exact = cells.findIndex((c) => tokens.includes(c));
  if (exact >= 0) return exact;
  return cells.findIndex((c) => c && tokens.some((t) => c.includes(t)));
}

/**
 * Locates the real header row, skipping metadata lines above it.
 * Returns -1 when the file is not a Sender/Receiver + DR/CR statement.
 */
export function findHeaderRow(rows: string[][]): number {
  return rows.findIndex((r) => {
    const cells = r.map(norm);
    const hasDate = cells.some((c) => HEADER_TOKENS.date.includes(c));
    const hasParty =
      cells.some((c) => HEADER_TOKENS.sender.includes(c)) || cells.some((c) => HEADER_TOKENS.receiver.includes(c));
    const hasDrCr = cells.some((c) => c === "drcr" || c === "crdr" || c === "debitcredit");
    const hasAmount = cells.some((c) => c.startsWith("amount"));
    return hasDate && hasParty && hasDrCr && hasAmount;
  });
}

/** "xxxxxxxharge@icici(Airtel)" -> "Airtel"; falls back to cleaning the UPI id. */
export function extractCounterparty(raw: string): string {
  const input = (raw || "").trim();
  if (!input) return "";

  const inParens = input.match(/\(([^)]*)\)/);
  if (inParens && inParens[1] && inParens[1].trim()) return titleize(inParens[1].trim());

  return titleize(cleanUpiId(input));
}

/** Strips the VPA handle, masking x's and reference digits from a raw UPI id. */
export function cleanUpiId(raw: string): string {
  const local = (raw || "").split("@")[0] ?? "";
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/\bx{2,}\b/gi, " ")
    .replace(/x{3,}/gi, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || (raw || "").trim();
}

function titleize(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

const UPI_CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  {
    category: "Utilities & Telecom",
    keywords: ["airtel", "jio", "vodafone", "vi ", "bsnl", "recharge", "electricity", "bescom", "tata power", "adani", "broadband", "wifi", "gas", "water"],
  },
  {
    category: "Shopping",
    keywords: ["myntra", "flipkart", "amazon", "ajio", "meesho", "nykaa", "tatacliq", "tata cliq", "croma", "reliance", "shopping", "lenskart", "decathlon"],
  },
  {
    category: "Food & Dining",
    keywords: ["swiggy", "zomato", "food", "cafe", "restaurant", "blinkit", "zepto", "instamart", "dominos", "pizza", "starbucks", "bakery", "chai"],
  },
];

export const UPI_DEFAULT_CATEGORY = "General & UPI Transfers";

/** Maps an extracted merchant name to a standard category. */
export function categorizeUpi(merchant: string): string {
  const text = ` ${(merchant || "").toLowerCase()} `;
  for (const rule of UPI_CATEGORY_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.category;
  }
  return UPI_DEFAULT_CATEGORY;
}

/** Strips currency symbols, commas and Dr/Cr markers, returning a positive amount. */
export function parseIndianAmount(raw: string): number | null {
  const value = parseAmount(raw);
  return value === null ? null : Math.abs(value);
}

function directionOf(raw: string): "expense" | "income" | null {
  const v = norm(raw);
  if (!v) return null;
  if (v === "dr" || v.startsWith("debit") || v === "withdrawal") return "expense";
  if (v === "cr" || v.startsWith("credit") || v === "deposit") return "income";
  return null;
}

/**
 * Parses an Indian bank / UPI statement into review rows.
 * Returns null when the CSV does not match that layout, so callers can fall
 * back to the generic statement parser.
 */
export function parseUpiStatement(rows: string[][]): ReviewRow[] | null {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) return null;

  const header = rows[headerIdx] ?? [];
  const idx = {
    date: findIndex(header, HEADER_TOKENS.date),
    sender: findIndex(header, HEADER_TOKENS.sender),
    receiver: findIndex(header, HEADER_TOKENS.receiver),
    drcr: findIndex(header, HEADER_TOKENS.drcr),
    amount: findIndex(header, HEADER_TOKENS.amount),
    status: findIndex(header, HEADER_TOKENS.status),
  };

  const out: ReviewRow[] = [];

  rows.slice(headerIdx + 1).forEach((cells, i) => {
    const get = (n: number) => (n >= 0 ? (cells[n] ?? "").trim() : "");
    if (cells.every((c) => (c ?? "").trim() === "")) return;

    const joined = cells.join(" ").toLowerCase().trim();
    if (/^(total|closing balance|opening balance|grand total|end of statement)/.test(joined)) return;

    const status = get(idx.status).toLowerCase();
    if (status && /fail|declin|reject|pending/.test(status)) return;

    const type = directionOf(get(idx.drcr)) ?? "expense";
    const counterparty = type === "expense" ? get(idx.receiver) : get(idx.sender);
    const merchant = extractCounterparty(counterparty) || "Unknown Merchant";
    const amount = parseIndianAmount(get(idx.amount));
    const date = normalizeDate(get(idx.date)) ?? "";

    if (amount === null && !date && merchant === "Unknown Merchant") return;

    out.push({
      key: `upi-${i}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      merchant,
      category: type === "income" ? "Income" : categorizeUpi(`${merchant} ${counterparty}`),
      amount: amount !== null ? String(amount) : get(idx.amount),
      type,
      payment_mode: "UPI",
    });
  });

  return out.length > 0 ? out : null;
}
