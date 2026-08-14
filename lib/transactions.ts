export const CATEGORIES = [
  "Income",
  "Food & Dining",
  "Rent & Housing",
  "Utilities",
  "Transportation",
  "Travel",
  "Health & Fitness",
  "Subscriptions",
  "Shopping",
  "Bills",
  "General Expense",
] as const;

export const PAYMENT_MODES = [
  "Credit Card",
  "Debit Card",
  "ACH",
  "Bank Transfer",
  "Direct Deposit",
  "Direct Debit",
  "Wire Transfer",
  "Apple Pay",
  "UPI",
  "Cash",
] as const;

const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  { category: "Income", keywords: ["salary", "payroll", "freelance", "consulting", "refund", "interest", "dividend", "cashback", "received from"] },
  {
    category: "Subscriptions",
    keywords: [
      "netflix", "spotify", "hulu", "linkedin premium", "apple.com", "prime video", "amazon prime", "hotstar",
      "youtube", "jiocinema", "sonyliv", "zee5", "bookmyshow", "pvr", "inox", "subscription", "audible",
    ],
  },
  {
    category: "Food & Dining",
    keywords: [
      "swiggy", "zomato", "blinkit", "zepto", "instamart", "bigbasket", "dunzo", "eatfit", "faasos", "box8",
      "starbucks", "trader joe", "whole foods", "chipotle", "bakery", "mcdonald", "burger king", "kfc",
      "domino", "pizza", "restaurant", "cafe", "chai", "barbeque", "haldiram", "grocer", "supermarket",
    ],
  },
  { category: "Rent & Housing", keywords: ["rent", "apartment", "mortgage", "landlord", "hoa", "maintenance", "society fee", "society maint", "nobroker"] },
  {
    category: "Utilities",
    keywords: [
      "electric", "edison", "water bill", "water board", "utility", "util", "wifi", "broadband", "internet",
      "airtel", "jio", "vodafone", "vi recharge", "bsnl", "bescom", "mseb", "tata power", "adani electricity",
      "torrent power", "gas bill", "indane", "billdesk",
    ],
  },
  {
    category: "Transportation",
    keywords: ["chevron", "shell", "bpcl", "hpcl", "iocl", "indian oil", "gas", "fuel", "petrol", "parking", "transit", "metro", "fastag", "rapido", "ola", "auto"],
  },
  {
    category: "Travel",
    keywords: ["uber", "lyft", "flight", "airlines", "indigo", "vistara", "spicejet", "hotel", "airbnb", "oyo", "train", "irctc", "redbus", "makemytrip", "goibibo", "cleartrip", "yatra"],
  },
  {
    category: "Health & Fitness",
    keywords: ["gym", "equinox", "cult.fit", "cultfit", "cure.fit", "pharmacy", "pharmeasy", "netmeds", "1mg", "apollo", "practo", "cvs", "walgreens", "clinic", "hospital", "dental", "diagnostic"],
  },
  {
    category: "Shopping",
    keywords: ["amazon", "walmart", "target", "shopping", "flipkart", "myntra", "meesho", "tata cliq", "tatacliq", "nykaa", "ajio", "reliance retail", "reliance digital", "croma", "decathlon", "ikea", "best buy", "lenskart", "snapdeal"],
  },
  { category: "Bills", keywords: ["credit card pymt", "card payment", "loan", "emi", "insurance", "lic ", "premium", "bill", "recharge"] },
];

const UPI_NOISE = new Set([
  "upi", "imps", "neft", "rtgs", "ach", "atm", "pos", "vps", "ecom", "ecs", "nach", "ref", "refno", "txn",
  "paid", "to", "from", "received", "payment", "transfer", "sent", "by", "via", "collect", "mandate",
  "india", "private", "pvt", "ltd", "limited", "inc", "llp", "technologies", "services", "solutions",
]);

const BANK_SUFFIXES = /(okhdfcbank|okicici|okaxis|oksbi|ybl|paytm|apl|axl|ibl|upi|hdfcbank|icici|sbi|axisbank|kotak|yesbank|pnb|barodampay|airtel|jio|fbl|idfcbank|indus)$/i;

function titleCase(word: string): string {
  if (word.length <= 3 && word === word.toUpperCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Cleans raw UPI/bank narrations into a human-readable merchant name.
 * "UPI-SWIGGY-BANGALORE-12345" -> "Swiggy Bangalore", "PAID TO ZOMATO INDIA" -> "Zomato".
 */
export function cleanMerchant(raw: string): string {
  const input = (raw || "").trim();
  if (!input) return "";

  // Drop VPA handles like swiggy@ybl -> swiggy
  const withoutVpa = input.replace(/([a-z0-9._-]+)@[a-z]+/gi, "$1");

  const tokens = withoutVpa
    .split(/[\s\-_/|,:;*.]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !/^\d+$/.test(t)) // pure numeric refs
    .filter((t) => !/^[a-z]*\d{4,}[a-z0-9]*$/i.test(t)) // alphanumeric ref ids
    .filter((t) => !UPI_NOISE.has(t.toLowerCase()));

  const cleaned = tokens
    .map((t) => t.replace(BANK_SUFFIXES, "") || t)
    .filter(Boolean)
    .slice(0, 4)
    .map(titleCase)
    .join(" ")
    .trim();

  return cleaned || input;
}

/** Assigns a category by matching keywords in the merchant/description text. */
export function categorize(merchant: string): string {
  const text = (merchant || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.category;
  }
  return "General Expense";
}


const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 100) y += y > 70 ? 1900 : 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Normalizes messy or relative date strings into ISO YYYY-MM-DD. Returns null when unparseable. */
export function normalizeDate(input: string): string | null {
  let raw = (input || "").trim();
  if (!raw) return null;

  // Drop time component / timezone suffix: "12/08/2026 14:32:01", "2026-08-12T10:00:00Z"
  raw = raw.replace(/[T,]/g, " ").replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*(am|pm|z|[+-]\d{2}:?\d{2})?$/i, "").trim();
  raw = raw.replace(/\s+(am|pm)$/i, "").trim();
  const lower = raw.toLowerCase();

  if (lower === "today") return daysAgo(0);
  if (lower === "yesterday") return daysAgo(1);
  const rel = lower.match(/^(\d+)\s*days?\s*ago$/);
  if (rel) return daysAgo(Number(rel[1]!));

  // ISO
  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) return iso(+isoMatch[1]!, +isoMatch[2]!, +isoMatch[3]!);

  // 12 Aug 2026 / 12-Aug-2026 / 12 August 2026
  const textual = lower.match(/^(\d{1,2})[\s-]([a-z]{3,})[\s-,]*(\d{2,4})$/);
  const textualMonth = textual ? MONTHS[textual[2]!.slice(0, 3)] : undefined;
  if (textual && textualMonth) return iso(+textual[3]!, textualMonth, +textual[1]!);

  // Aug 12, 2026
  const textual2 = lower.match(/^([a-z]{3,})[\s-]+(\d{1,2}),?[\s-]+(\d{2,4})$/);
  const textual2Month = textual2 ? MONTHS[textual2[1]!.slice(0, 3)] : undefined;
  if (textual2 && textual2Month) return iso(+textual2[3]!, textual2Month, +textual2[2]!);

  // a/b/yyyy — Indian statements are DD/MM/YYYY (and DD-MM-YYYY / DD.MM.YYYY)
  const parts = raw.match(/^(\d{1,2})([-/.])(\d{1,2})\2(\d{2,4})$/);
  if (parts) {
    const a = +parts[1]!;
    const b = +parts[3]!;
    const y = +parts[4]!;
    if (a > 12) return iso(y, b, a);
    if (b > 12) return iso(y, a, b);
    return iso(y, b, a);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

/**
 * Parses an amount that may contain currency symbols (₹, INR, Rs.), commas,
 * Dr/Cr suffixes, or parentheses for negatives.
 */
export function parseAmount(input: string): number | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const stripped = lower
    .replace(/₹|inr|rs\.?/g, " ")
    .replace(/\b(dr|debit|db|withdrawal)\b\.?/g, " -")
    .replace(/\b(cr|credit|deposit)\b\.?/g, " ")
    .trim();
  const negative = /^\(.*\)$/.test(stripped) || stripped.includes("-");
  const cleaned = stripped.replace(/[^0-9.]/g, "");
  if (!cleaned || Number.isNaN(Number(cleaned))) return null;
  const value = Number(cleaned);
  if (value <= 0) return null;
  return negative ? -value : value;
}


/** Minimal RFC4180-ish CSV parser supporting quoted fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

export type ReviewRow = {
  key: string;
  date: string;
  merchant: string;
  category: string;
  amount: string;
  type: "expense" | "income";
  payment_mode: string;
};

/** Fuzzy header matcher: normalizes casing/punctuation and matches any candidate token. */
function pick(header: string[], candidates: string[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cands = candidates.map(norm);
  const exact = header.findIndex((h) => cands.includes(norm(h)));
  if (exact >= 0) return exact;
  return header.findIndex((h) => cands.some((c) => norm(h).includes(c)));
}

const DATE_HEADERS = ["date", "txndate", "transactiondate", "valuedate", "dateandtime", "datetime", "date&time"];
const MERCHANT_HEADERS = [
  "description", "paidtoreceivedfrom", "paidto", "receivedfrom", "narration", "remarks", "merchant",
  "details", "particulars", "particular", "transactiondetails", "name",
];
const AMOUNT_HEADERS = ["amount", "txnamount", "amountinr", "transactionamount", "value", "amountrs"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawalamt", "debitamount", "dr"];
const CREDIT_HEADERS = ["credit", "deposit", "depositamt", "creditamount", "cr"];

/** Maps parsed CSV rows into editable review rows with normalized dates and auto categories. */
export function mapCsvToRows(rows: string[][]): ReviewRow[] {
  if (rows.length === 0) return [];

  // Some statements begin with bank/account summary lines before the real header row.
  const headerIdx = rows.findIndex((r) =>
    r.some((h) => /date|merchant|descr|amount|type|mode|narration|particular|remark|debit|credit|paid to/i.test(h)),
  );
  const looksLikeHeader = headerIdx >= 0;
  const header = looksLikeHeader ? (rows[headerIdx] ?? []).map((h) => h.trim().toLowerCase()) : [];
  const body = looksLikeHeader ? rows.slice(headerIdx + 1) : rows;

  const idx = looksLikeHeader
    ? {
        date: pick(header, DATE_HEADERS),
        merchant: pick(header, MERCHANT_HEADERS),
        amount: pick(header, AMOUNT_HEADERS),
        debit: pick(header, DEBIT_HEADERS),
        credit: pick(header, CREDIT_HEADERS),
        type: pick(header, ["type", "drcr", "crdr", "direction", "transactiontype"]),
        mode: pick(header, ["mode", "method", "payment", "paymentmode", "paymentmethod", "channel"]),
        category: pick(header, ["category"]),
      }
    : { date: 0, merchant: 1, amount: 2, debit: -1, credit: -1, type: 3, mode: 4, category: -1 };

  const out: ReviewRow[] = [];

  body.forEach((cells, i) => {
    const get = (n: number) => (n >= 0 ? (cells[n] ?? "").trim() : "");

    // Skip blank rows and summary/footer rows (e.g. "Closing Balance", "Total")
    if (cells.every((c) => (c ?? "").trim() === "")) return;
    const joined = cells.join(" ").toLowerCase();
    if (/^\s*(closing balance|opening balance|total|grand total|statement summary|end of statement)/.test(joined.trim())) return;

    const rawMerchant = get(idx.merchant);
    const rawType = get(idx.type).toLowerCase();

    const debit = idx.debit >= 0 ? parseAmount(get(idx.debit)) : null;
    const credit = idx.credit >= 0 ? parseAmount(get(idx.credit)) : null;
    const rawAmount = get(idx.amount);
    const plain = parseAmount(rawAmount);

    let amount: number | null;
    let type: "expense" | "income";

    if (debit !== null && credit === null) {
      amount = Math.abs(debit);
      type = "expense";
    } else if (credit !== null && debit === null) {
      amount = Math.abs(credit);
      type = "income";
    } else if (/income|credit|^cr$|\bcr\b|deposit/.test(rawType)) {
      amount = plain !== null ? Math.abs(plain) : null;
      type = "income";
    } else if (/expense|debit|^dr$|\bdr\b|withdraw/.test(rawType)) {
      amount = plain !== null ? Math.abs(plain) : null;
      type = "expense";
    } else if (plain !== null) {
      amount = Math.abs(plain);
      type = plain < 0 ? "expense" : "income";
    } else {
      amount = null;
      type = "expense";
    }

    // Nothing usable at all in this row — skip instead of failing the import.
    if (amount === null && !rawMerchant && !get(idx.date)) return;

    const merchant = cleanMerchant(rawMerchant) || "Unknown Merchant";
    const csvCategory = get(idx.category);
    const category =
      csvCategory ||
      (type === "income" ? "Income" : categorize(`${rawMerchant} ${merchant}`)) ||
      "General Expense";

    out.push({
      key: `csv-${i}-${Math.random().toString(36).slice(2, 8)}`,
      date: normalizeDate(get(idx.date)) ?? "",
      merchant,
      category,
      amount: amount !== null ? String(amount) : rawAmount,
      type,
      payment_mode: get(idx.mode) || (/upi/i.test(rawMerchant) ? "UPI" : ""),
    });
  });

  return out;
}


export type RowErrors = { date?: string; merchant?: string; amount?: string };

export const DISCRETIONARY_CATEGORIES = ["Food & Dining", "Shopping", "Travel"] as const;
export const HIGH_SPEND_THRESHOLD = 500;

export type RowFlags = { duplicate: boolean; highSpend: boolean };

/** Stable identity used for duplicate detection: date + merchant + absolute amount. */
export function dedupeKey(date: string, merchant: string, amount: number): string {
  return `${date}|${merchant.trim().toLowerCase()}|${Math.abs(amount).toFixed(2)}`;
}

/** Flips the sign of every parsed amount, swapping expense/income accordingly. */
export function invertRows(rows: ReviewRow[]): ReviewRow[] {
  return rows.map((r) => {
    const amount = parseAmount(r.amount);
    if (amount === null) return { ...r, type: r.type === "income" ? "expense" : "income" };
    const flipped = r.type === "income" ? "expense" : "income";
    return {
      ...r,
      type: flipped,
      category: flipped === "income" ? "Income" : r.category === "Income" ? categorize(r.merchant) : r.category,
      amount: String(Math.abs(amount)),
    };
  });
}

/** Computes duplicate + high-spend anomaly flags for each review row. */
export function detectAnomalies(rows: ReviewRow[], existingKeys: Set<string> = new Set()): RowFlags[] {
  const seen = new Map<string, number>();
  rows.forEach((r) => {
    const amount = parseAmount(r.amount);
    if (amount === null || !r.date) return;
    const k = dedupeKey(r.date, r.merchant, amount);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  });

  return rows.map((r) => {
    const amount = parseAmount(r.amount);
    if (amount === null || !r.date) return { duplicate: false, highSpend: false };
    const k = dedupeKey(r.date, r.merchant, amount);
    return {
      duplicate: (seen.get(k) ?? 0) > 1 || existingKeys.has(k),
      highSpend:
        r.type === "expense" &&
        Math.abs(amount) > HIGH_SPEND_THRESHOLD &&
        (DISCRETIONARY_CATEGORIES as readonly string[]).includes(r.category),
    };
  });
}

export function validateRow(row: ReviewRow): RowErrors {
  const errors: RowErrors = {};
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) errors.date = "Invalid date";
  if (!row.merchant.trim()) errors.merchant = "Merchant required";
  const amount = parseAmount(row.amount);
  if (amount === null) errors.amount = "Invalid amount";
  return errors;
}

export const SAMPLE_CSV = `Date,Description,Category,Amount,Payment_Mode
2026-08-01,TechCorp Salary,Income,4500.00,Direct Deposit
2026-08-02,STARBUCKS #1024,Food & Dining,-5.75,Debit Card
08/02/2026,TRADER JOES #402,,-124.50,Credit Card
03-08-2026,METROPOLITAN ELEC,Utilities,-85.20,ACH
2026-08-04,NETFLIX.COM,Subscriptions,-19.99,Credit Card
08/05/2026,UBER TRIP 8492,Travel,-28.40,Credit Card
06-08-2026,EQUINOX GYM,Health & Fitness,-150.00,Direct Debit
2026-08-07,,,-45.00,Debit Card
2026-08-08,AMAZON MKTPLACE,Shopping,-142.99,Credit Card
08/13/2026,CITY APARTMENTS RENT,Rent & Housing,-1850.00,Bank Transfer
2026-08-20,FREELANCE CONSULTING,Income,850.00,Wire Transfer
`;

