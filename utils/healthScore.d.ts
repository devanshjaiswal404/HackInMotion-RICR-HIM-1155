export type HealthRecommendation = {
  type: "warning" | "danger" | "success";
  title: string;
  message: string;
};

export type HealthResult = {
  overall_score: number;
  breakdown: {
    savings_rate_score: number;
    essential_expense_score: number;
    subscription_score: number;
  };
  metrics: {
    total_income: number;
    total_expenses: number;
    essential_expenses?: number;
    subscription_expenses?: number;
    savings_rate_percent: number;
    essential_ratio_percent?: number;
    subscription_ratio_percent?: number;
  };
  recommendations: HealthRecommendation[];
};

export declare function calculateFinancialHealth(
  transactions: Array<{ amount: number | string; category?: string | null; [key: string]: unknown }>,
): HealthResult;
