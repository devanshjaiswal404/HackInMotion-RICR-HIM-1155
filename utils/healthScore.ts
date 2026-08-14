import { formatCurrency } from './formatters';

/**
 * Calculates the Financial Health Score (0-100) and actionable insights.
 * @param {Array<Object>} transactions - Normalized transaction list
 * @returns {Object} Health score object containing overall score, breakdown, metrics, and insights.
 */
export function calculateFinancialHealth(transactions) {
  const ESSENTIAL_CATEGORIES = new Set([
    'Rent & Housing',
    'Utilities',
    'Food & Dining',
    'Health & Fitness',
    'Transportation'
  ]);

  let totalIncome = 0;
  let totalExpenses = 0;
  let essentialExpenses = 0;
  let subscriptionExpenses = 0;

  transactions.forEach((tx) => {
    const rawAmount = parseFloat(tx.amount);
    if (isNaN(rawAmount)) return;

    const amount = Math.abs(rawAmount);

    if (tx.category === 'Income' || rawAmount > 0) {
      totalIncome += amount;
    } else {
      totalExpenses += amount;

      if (ESSENTIAL_CATEGORIES.has(tx.category)) {
        essentialExpenses += amount;
      }
      if (tx.category === 'Subscriptions') {
        subscriptionExpenses += amount;
      }
    }
  });

  if (totalIncome === 0) {
    return {
      overall_score: 0,
      breakdown: { savings_rate_score: 0, essential_expense_score: 0, subscription_score: 0 },
      metrics: { total_income: 0, total_expenses: totalExpenses, savings_rate_percent: 0 },
      recommendations: [{ type: 'warning', title: 'No Income Found', message: 'Add income transactions to calculate your health score.' }]
    };
  }

  const netSavings = totalIncome - totalExpenses;
  const savingsRatePercent = (netSavings / totalIncome) * 100;
  const essentialRatioPercent = (essentialExpenses / totalIncome) * 100;
  const subscriptionRatioPercent = (subscriptionExpenses / totalIncome) * 100;

  let savingsScore = 0;
  if (savingsRatePercent >= 20) {
    savingsScore = 40;
  } else if (savingsRatePercent > 0) {
    savingsScore = (savingsRatePercent / 20) * 40;
  }

  let essentialScore = 40;
  if (essentialRatioPercent > 50) {
    essentialScore = Math.max(0, 40 - (essentialRatioPercent - 50) * 0.8);
  }

  let subscriptionScore = 20;
  if (subscriptionRatioPercent > 5) {
    subscriptionScore = Math.max(0, 20 - (subscriptionRatioPercent - 5) * 2);
  }

  const overallScore = Math.min(100, Math.max(0, Math.round(savingsScore + essentialScore + subscriptionScore)));

  const recommendations = [];

  // a) Subscription Analysis
  if (subscriptionRatioPercent > 5) {
    recommendations.push({
      type: 'warning',
      title: 'Subscription Overhead Alert',
      message: `You spent ${subscriptionRatioPercent.toFixed(1)}% of your monthly income on recurring digital services. Canceling unused subscriptions could save up to ${formatCurrency(subscriptionExpenses * 0.3)}/mo.`
    });
  } else {
    recommendations.push({
      type: 'success',
      title: 'Optimized Subscriptions',
      message: `Subscriptions account for ${subscriptionRatioPercent.toFixed(1)}% of your income, comfortably under the 5% threshold.`
    });
  }

  // b) Savings Velocity Analysis
  if (savingsRatePercent >= 20) {
    recommendations.push({
      type: 'success',
      title: 'High Savings Velocity',
      message: `Your current savings rate is ${savingsRatePercent.toFixed(1)}%, exceeding the recommended 20% benchmark. Moving extra funds to high-yield savings boosts your Health Score!`
    });
  } else {
    recommendations.push({
      type: 'danger',
      title: 'Low Savings Margin',
      message: `Your current savings rate is ${savingsRatePercent.toFixed(1)}%. Aim for at least 20% to strengthen your financial health.`
    });
  }

  // c) Expense Ratio Analysis
  if (essentialRatioPercent > 50) {
    recommendations.push({
      type: 'info',
      title: 'Essential Category Heavy',
      message: `Essential expenses (housing, utilities, food) consume ${essentialRatioPercent.toFixed(1)}% of your income. Review discretionary limits to free up margin.`
    });
  } else {
    recommendations.push({
      type: 'info',
      title: 'Balanced Category Distribution',
      message: `Essential spending is well balanced at ${essentialRatioPercent.toFixed(1)}% of overall income.`
    });
  }

  return {
    overall_score: overallScore,
    breakdown: {
      savings_rate_score: Number(savingsScore.toFixed(1)),
      essential_expense_score: Number(essentialScore.toFixed(1)),
      subscription_score: Number(subscriptionScore.toFixed(1))
    },
    metrics: {
      total_income: Number(totalIncome.toFixed(2)),
      total_expenses: Number(totalExpenses.toFixed(2)),
      essential_expenses: Number(essentialExpenses.toFixed(2)),
      subscription_expenses: Number(subscriptionExpenses.toFixed(2)),
      savings_rate_percent: Number(savingsRatePercent.toFixed(1)),
      essential_ratio_percent: Number(essentialRatioPercent.toFixed(1)),
      subscription_ratio_percent: Number(subscriptionRatioPercent.toFixed(1))
    },
    recommendations
  };
}
