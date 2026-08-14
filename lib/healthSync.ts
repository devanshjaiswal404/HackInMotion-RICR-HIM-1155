import { supabase } from "@/integrations/supabase/client";
import { calculateFinancialHealth } from "@/utils/healthScore";
import { netAdjustedRows } from "@/lib/reimbursements";

/**
 * Recalculates and stores the signed-in user's financial health score from
 * all transactions currently in the database.
 */
export async function recalculateHealthScore(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, merchant, amount, category, type, linked_expense_id")
    .eq("user_id", userId);
  if (error || !data || data.length === 0) return null;

  const health = calculateFinancialHealth(
    netAdjustedRows(data).map((t) => ({
      category: t.category,
      amount: t.type === "income" ? Number(t.amount) : -Math.abs(Number(t.amount)),
    })),
  );

  await supabase.from("health_scores").delete().eq("user_id", userId);
  await supabase.from("health_scores").insert({
    user_id: userId,
    score: health.overall_score,
    metrics_json: {
      breakdown: health.breakdown,
      metrics: health.metrics,
      recommendations: health.recommendations,
    },
  });
  return health.overall_score;
}