import { supabase } from "@/integrations/supabase/client";
import { calculateFinancialHealth } from "@/utils/healthScore";

export type DemoRow = {
  date: string;
  merchant: string;
  amount: number;
  type: "expense" | "income";
  category: string;
  payment_mode: string;
};

/** Member 2's official demo dataset — 25 rows for the pitch state. */
export const DEMO_TRANSACTIONS: DemoRow[] = [
  { date: "2026-08-01", merchant: "TechCorp Salary", amount: 4500.0, type: "income", category: "Income", payment_mode: "Direct Deposit" },
  { date: "2026-08-02", merchant: "STARBUCKS #1024", amount: 5.75, type: "expense", category: "Food & Dining", payment_mode: "Debit Card" },
  { date: "2026-08-02", merchant: "TRADER JOES #402", amount: 124.5, type: "expense", category: "Food & Dining", payment_mode: "Credit Card" },
  { date: "2026-08-03", merchant: "METROPOLITAN ELEC", amount: 85.2, type: "expense", category: "Utilities", payment_mode: "ACH" },
  { date: "2026-08-04", merchant: "NETFLIX.COM", amount: 19.99, type: "expense", category: "Subscriptions", payment_mode: "Credit Card" },
  { date: "2026-08-05", merchant: "UBER TRIP 8492", amount: 28.4, type: "expense", category: "Travel", payment_mode: "Credit Card" },
  { date: "2026-08-06", merchant: "EQUINOX GYM", amount: 150.0, type: "expense", category: "Health & Fitness", payment_mode: "Direct Debit" },
  { date: "2026-08-07", merchant: "Unnamed Merchant", amount: 45.0, type: "expense", category: "General Expense", payment_mode: "Debit Card" },
  { date: "2026-08-08", merchant: "AMAZON MKTPLACE", amount: 142.99, type: "expense", category: "Shopping", payment_mode: "Credit Card" },
  { date: "2026-08-09", merchant: "SPOTIFY PREMIUM", amount: 10.99, type: "expense", category: "Subscriptions", payment_mode: "Credit Card" },
  { date: "2026-08-10", merchant: "SQ *CITY BAKERY", amount: 14.5, type: "expense", category: "Food & Dining", payment_mode: "Apple Pay" },
  { date: "2026-08-11", merchant: "CHEVRON GAS", amount: 45.2, type: "expense", category: "Transportation", payment_mode: "Credit Card" },
  { date: "2026-08-12", merchant: "CHIPOTLE 1289", amount: 15.8, type: "expense", category: "Food & Dining", payment_mode: "Debit Card" },
  { date: "2026-08-13", merchant: "CITY APARTMENTS RENT", amount: 1850.0, type: "expense", category: "Rent & Housing", payment_mode: "Bank Transfer" },
  { date: "2026-08-14", merchant: "LINKEDIN PREMIUM", amount: 39.99, type: "expense", category: "Subscriptions", payment_mode: "Credit Card" },
  { date: "2026-08-15", merchant: "CVS PHARMACY", amount: 32.4, type: "expense", category: "Health & Fitness", payment_mode: "Debit Card" },
  { date: "2026-08-16", merchant: "WHOLE FOODS", amount: 185.6, type: "expense", category: "Food & Dining", payment_mode: "Credit Card" },
  { date: "2026-08-18", merchant: "HULU STREAMING", amount: 14.99, type: "expense", category: "Subscriptions", payment_mode: "Credit Card" },
  { date: "2026-08-19", merchant: "CON EDISON UTIL", amount: 110.0, type: "expense", category: "Utilities", payment_mode: "ACH" },
  { date: "2026-08-20", merchant: "FREELANCE CONSULTING", amount: 850.0, type: "income", category: "Income", payment_mode: "Wire Transfer" },
  { date: "2026-08-21", merchant: "UNKNOWN MERCHANT LLC", amount: 68.0, type: "expense", category: "General Expense", payment_mode: "Credit Card" },
  { date: "2026-08-22", merchant: "TARGET STORES", amount: 94.3, type: "expense", category: "Shopping", payment_mode: "Debit Card" },
  { date: "2026-08-24", merchant: "APPLE.COM/BILL", amount: 2.99, type: "expense", category: "Subscriptions", payment_mode: "Credit Card" },
  { date: "2026-08-25", merchant: "Cash Withdrawal", amount: 12.0, type: "expense", category: "Food & Dining", payment_mode: "Cash" },
  { date: "2026-08-28", merchant: "CHASE CREDIT CARD PYMT", amount: 300.0, type: "expense", category: "Bills", payment_mode: "ACH" },
];

/**
 * Clears the signed-in user's transactions, inserts the 25 demo rows and
 * recalculates their stored financial health score.
 */
export async function loadDemoPitchState(): Promise<{ inserted: number; score: number }> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("You must be signed in to load the demo state.");
  const userId = auth.user.id;

  const { error: deleteError } = await supabase.from("transactions").delete().eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase
    .from("transactions")
    .insert(DEMO_TRANSACTIONS.map((r) => ({ ...r, user_id: userId })));
  if (insertError) throw new Error(insertError.message);

  const health = calculateFinancialHealth(
    DEMO_TRANSACTIONS.map((r) => ({
      ...r,
      amount: r.type === "income" ? r.amount : -r.amount,
    })),
  );

  await supabase.from("health_scores").delete().eq("user_id", userId);
  const { error: scoreError } = await supabase.from("health_scores").insert({
    user_id: userId,
    score: health.overall_score,
    metrics_json: { breakdown: health.breakdown, metrics: health.metrics, recommendations: health.recommendations },
  });
  if (scoreError) throw new Error(scoreError.message);

  return { inserted: DEMO_TRANSACTIONS.length, score: health.overall_score };
}
