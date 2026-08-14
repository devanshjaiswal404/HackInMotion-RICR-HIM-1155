# 📚 FinSight AI — API & Edge Function Documentation

## 1. Overview & Architecture
FinSight AI utilizes Supabase REST APIs (PostgREST) backed by PostgreSQL Row Level Security (RLS) and serverless Supabase Edge Functions for secure, server-side Google Gemini AI interactions.

---

## 2. Serverless Edge Functions

### `POST /functions/v1/chat`
Invokes the Google Gemini AI conversational financial advisor with contextual financial data.

* **Endpoint URL:** `https://sightfinai.lovable.app/functions/v1/chat`
* **Method:** `POST`
* **Headers:**
  ```http
  Authorization: Bearer <SUPABASE_ANON_OR_USER_JWT>
  Content-Type: application/json
  {
  "prompt": "How much did I spend on food this month?",
  "context": {
    "currency": "₹",
    "totalIncome": 85000,
    "totalExpenses": 42300,
    "recentTransactions": [
      {
        "id": "c1f7a062-8b9a-4c28-98e6-123456789abc",
        "date": "2026-08-10",
        "merchant": "Swiggy",
        "category": "Food & Dining",
        "amount": 450.00,
        "type": "expense",
        "payment_mode": "UPI"
      }
    ]
  }
}
{
  "reply": "You spent ₹4,250 on Food & Dining this month across 8 transactions. This represents roughly 10% of your total expenses, well within a healthy discretionary spending limit."
}
{
  "error": "GEMINI_API_KEY environment variable is not set"
}
