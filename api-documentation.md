# 📚 FinSight AI — Database Architecture & API Documentation

## 1. Database Architecture & Schema Design
FinSight AI uses PostgreSQL via Supabase with relational integrity, indexed keys, and multi-tenant scoping.

### Tables Specification:
* **`transactions`**: Stores user income and expense records with category classification, account tags (`account_name`), reference IDs, and timestamp indexing.
* **`budgets`**: Enforces monthly spending ceilings per category with unique user-category constraints.
* **`recurring_bills`**: Manages predicted recurring utility, telecom, and subscription due dates with payment status flags.

---

## 2. Security & Row Level Security (RLS)
* **Kernel-Level Multi-Tenancy**: Every table enforces `ENABLE ROW LEVEL SECURITY`.
* **Policy Isolation**: All CRUD policies use `auth.uid() = user_id`, guaranteeing users cannot access or tamper with data belonging to other accounts.
* **Secret Protection**: AI endpoints run via server-side Edge Functions (`/functions/v1/chat`); the `GEMINI_API_KEY` is never exposed to the client.
