import {
  absAmount,
  healthOf,
  isIncome,
  monthSpan,
  spendByCategory,
  totalExpenses,
  totalIncome,
  type AnalyticsRow,
} from "@/lib/analytics";
import { formatCurrency } from "@/utils/formatters";

const MODEL_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export function getGeminiKey(): string | null {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const key = env["VITE_GEMINI_API_KEY"];
  return key && key.trim().length > 10 ? key.trim() : null;
}

export const SYSTEM_PROMPT = `You are FinSight AI, a friendly personal-finance assistant inside a spending tracker app.
Rules:
- Answer questions about the user's own spending using ONLY the transaction data provided below. Quote exact figures with the same currency symbol used in the data.
- You can also answer general personal-finance questions (budgeting, 50/30/20 rule, emergency funds, investing basics, debt payoff).
- Reply in the same language/style the user writes in, including Hinglish (Hindi written in Latin script) when they do.
- Be concise: 2-5 short sentences, no markdown headings, no disclaimers about being an AI.
- If the data does not contain the answer, say so plainly and suggest what to add.`;

/** Serializes the user's transactions + derived metrics into prompt context. */
export function buildFinancialContext(rows: AnalyticsRow[]): string {
  if (!rows.length) return "No transactions recorded yet.";
  const income = totalIncome(rows);
  const expenses = totalExpenses(rows);
  const months = monthSpan(rows);
  const health = healthOf(rows);
  const byCategory = Object.entries(spendByCategory(rows))
    .sort((a, b) => b[1] - a[1])
    .map(([c, v]) => `${c}: ${formatCurrency(v)}`)
    .join(", ");

  const merchants = new Map<string, number>();
  rows.filter((r) => !isIncome(r)).forEach((r) => {
    const k = (r.merchant ?? "Unknown").trim();
    merchants.set(k, (merchants.get(k) ?? 0) + absAmount(r));
  });
  const topMerchants = Array.from(merchants.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([m, v]) => `${m}: ${formatCurrency(v)}`)
    .join(", ");

  const recent = rows
    .slice(-40)
    .map(
      (r) =>
        `${r.date ?? "?"} | ${r.merchant ?? "?"} | ${r.category} | ${
          isIncome(r) ? "+" : "-"
        }${formatCurrency(absAmount(r))}`,
    )
    .join("\n");

  return [
    `SUMMARY (${months} month(s) of data)`,
    `Total income: ${formatCurrency(income)}`,
    `Total expenses: ${formatCurrency(expenses)}`,
    `Net savings: ${formatCurrency(income - expenses)} (${
      income > 0 ? Math.round(((income - expenses) / income) * 100) : 0
    }% savings rate)`,
    `Financial health score: ${health.overall_score}/100`,
    `Spend by category: ${byCategory}`,
    `Top merchants: ${topMerchants}`,
    "",
    "RECENT TRANSACTIONS (date | merchant | category | amount)",
    recent,
  ].join("\n");
}

/** Direct REST call to Gemini. Throws on any failure so callers can fall back. */
export async function askGemini(
  question: string,
  rows: AnalyticsRow[],
  history: { role: "user" | "assistant"; text: string }[] = [],
): Promise<string> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("missing-key");

  const contents = [
    ...history.slice(-6).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })),
    {
      role: "user",
      parts: [
        {
          text: `${question}\n\n---\nUSER FINANCIAL DATA:\n${buildFinancialContext(rows)}`,
        },
      ],
    },
  ];

  const res = await fetch(`${MODEL_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`gemini-${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("gemini-empty");
  return text;
}
