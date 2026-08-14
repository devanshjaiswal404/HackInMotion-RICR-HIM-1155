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
