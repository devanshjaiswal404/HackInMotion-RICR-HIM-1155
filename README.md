
# FinSight AI — Automated Personal Finance & Bank Statement Intelligence

[![React](https://img.shields.io/badge/React-18.x-blue.svg?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Auth-3ECF8E.svg?logo=supabase)](https://supabase.com/)
[![Gemini AI](https://img.shields.io/badge/AI_Engine-Google_Gemini-orange.svg?logo=google)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> An intelligent, privacy-first personal finance platform engineered to ingest raw Indian Bank and UPI statement CSVs, auto-detect recurring obligations, compute real-time financial health analytics, and deliver conversational advisory powered by Google Gemini AI.

---

## 🌐 Live Application & Submission Links
* **Live Deployment:** [https://sightfinai.lovable.app](https://sightfinai.lovable.app)
* **GitHub Repository:** [https://github.com/devanshjaiswal404/HackInMotion-RICR-HIM-1155](https://github.com/devanshjaiswal404/HackInMotion-RICR-HIM-1155)
* **System Architecture Diagram:** [`architecture-diagram.png`](./architecture-diagram.png)
* **API Documentation:** [`api-documentation.md`](./api-documentation.md)
* **Pitch Deck Presentation:** [`presentation.pptx`](./presentation.pptx)

---

## 💡 Problem Statement & Solution

Traditional personal finance tools fail to parse messy, unstandardized Indian banking statements (UPI logs, NEFT, IMPS strings) and often expose sensitive financial credentials. **FinSight AI** bridges this gap:
1. **Intelligent Ingestion:** Automatically strips multi-line metadata headers and extracts human-readable merchant names from noisy VPA strings.
2. **Predictive Bill Tracking:** Employs heuristics to detect fixed subscriptions, telecom recharges, and utility cycles.
3. **Conversational Financial Guidance:** Delivers contextual financial planning via secure serverless Edge Functions querying Google Gemini AI.
4. **Enterprise-Grade Privacy:** Enforces PostgreSQL Row Level Security (RLS) and Cloudflare Turnstile bot protection with zero client-side credential exposure.

---

## ✨ Core Features & Technical Capabilities

### 1. Indian Bank & UPI CSV Parsing Engine
* **Metadata Header Detection:** Automatically scans and ignores leading metadata rows (e.g., "Customer History", "Phone Number") to isolate true transaction headers.
* **Parentheses Merchant Extraction:** Leverages regular expressions (`/\((.*?)\)/`) to parse clean counterparty identifiers from raw UPI strings (e.g., `xxxxxxxharge@icici(Airtel)` $\rightarrow$ `Airtel`).
* **Directional Flow Mapping:** Maps `DR`/`DEBIT` into expense workflows and `CR`/`CREDIT` into income channels.
* **Deterministic Auto-Categorization:** Sorts transactions into standard sectors including *Utilities & Telecom*, *Food & Dining*, *Shopping*, *Travel*, and *General Transfers*.

### 2. Financial Health Score & Velocity Analytics
* Dynamic scoring algorithm evaluating savings rate, budget variance, and discretionary spending velocity on a 100-point scale.
* Interactive visual breakdowns utilizing Recharts for cash flow distribution and monthly trajectory.

### 3. Predictive Recurring Bill Detector
* Scans historic debits across 30-day cadence windows to detect active recurring subscriptions (e.g., Netflix, Spotify, Airtel, Electricity).
* Tracks payment status flags and upcoming estimated due dates.

### 4. AI-Powered Advisory Assistant
* Serverless conversational advisor built with Supabase Edge Functions (`/functions/v1/chat`).
* Answers natural language financial queries regarding budget optimization and spending reduction while keeping API keys secret.

### 5. Multi-Account & Multi-Currency Engine
* Switch between domestic and foreign currencies ($USD, ₹INR, €EUR, £GBP).
* Aggregate multiple accounts across different banking institutions under a unified dashboard.

--

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Client["Client Tier (React 18 + TypeScript + Vite)"]
        UI["Visual Dashboard & Analytics\n(Tailwind CSS, Lucide, Recharts)"]
        Parser["Indian UPI / Bank CSV Parser\n(Regex Merchant Extraction & Auto-Categorization)"]
        Predictor["Recurring Bill Predictor &\nFinancial Health Scoring Engine"]
    end

    subgraph Security["Security & Identity Tier"]
        Turnstile["Cloudflare Turnstile CAPTCHA\n(Bot / Abuse Prevention)"]
        Auth["Supabase Authentication\n(JWT Session Token Verification)"]
    end

    subgraph Serverless["Edge Intelligence Tier"]
        EdgeFn["Supabase Edge Functions\n(/functions/v1/chat)"]
        Gemini["Google Gemini AI API\n(Server-Side Secure Invocations)"]
    end

    subgraph Persistence["Persistence Tier (PostgreSQL)"]
        RLS["Row Level Security Policies\n(auth.uid() = user_id)"]
        T_Tx[("transactions table")]
        T_Bg[("budgets table")]
        T_Bills[("recurring_bills table")]
        T_Hs[("health_scores table")]
    end

    UI <--> Parser
    UI <--> Predictor
    UI -- "Auth Flow" --> Turnstile --> Auth
    UI -- "Conversational Queries" --> EdgeFn
    EdgeFn -- "GEMINI_API_KEY (Server Secret)" --> Gemini
    Gemini --> EdgeFn --> UI
    UI -- "Secure CRUD Operations" --> RLS
    RLS --> T_Tx
    RLS --> T_Bg
    RLS --> T_Bills
    RLS --> T_Hs
