# Architecture

This document describes how the Savings Account Interest Calculator is structured, the
responsibilities of each layer, and how a request flows through the system.

---

## 1. High-Level View

```text
┌──────────────────────────────────────────────────────────────┐
│                    Browser (React 19 + JSX)                  │
│  Pages → components, api.js fetch client, formatters         │
└───────────────▲──────────────────────────────┬───────────────┘
                │ JSON over HTTPS (Bearer JWT) │
┌───────────────┴──────────────────────────────▼───────────────┐
│                      FastAPI application                     │
│  Routers (api/)  →  Services (services/)  →  Engine          │
│  Pydantic schemas         SQLAlchemy ORM                     │
└───────────────▲──────────────────────────────┬───────────────┘
                │                              │
        Supabase Auth (JWT)          Supabase PostgreSQL / SQLite
```

- The **frontend is presentation-only**. All financial logic lives in the backend so the
  maths is testable and consistent.
- The **backend** owns authentication, validation, business rules and persistence.
- The **database** enforces integrity (constraints, unique keys, RLS) as a second line of defence.

---

## 2. Frontend (`frontend/`)

A single-page React app written in **plain JS / JSX** (no TypeScript) and bundled by Vite.

| Area | Files | Responsibility |
| :--- | :--- | :--- |
| Entry | `src/main.jsx`, `src/App.jsx` | Mount React, hold top-level state (current tab, accounts, selected account, global modals) and route between pages. |
| Components | `src/components/*.jsx` | Reusable UI: `Sidebar`, `Navbar`, `Modal`, `StatCard`, `Toast` (+ `useToast` context). |
| Pages | `src/pages/*.jsx` | One component per feature: Dashboard, Accounts, Transactions, Daily Calculator, Quarterly Posting, Passbook, CSV Import, Interest Slabs, Settings. |
| Services | `src/services/api.js` | Thin `fetch` wrapper (`ApiService`) that attaches the bearer token, normalises errors and exposes one method per endpoint. |
| Utils | `src/utils/formatters.js` | Currency (₹ Indian numbering), date and percentage formatting. |

**State management:** local `useState`/`useEffect` per page plus the shared `ToastProvider`.
There is no global store — `App.jsx` lifts only what the navbar/sidebar need.

**Data flow inside a page:** render → `useEffect` calls `api.*` → response stored in local
state → tables/charts re-render. Mutations call `api.*`, then re-fetch and raise a toast.

---

## 3. Backend (`backend/app/`)

### Layered responsibilities

| Layer | Location | Responsibility |
| :--- | :--- | :--- |
| API / routers | `api/` | HTTP concerns: paths, status codes, dependency injection (`get_db`, `get_current_user`). |
| Schemas | `schemas/schemas.py` | Pydantic V2 request/response models and field validators (positive amounts, allowed types/rates). |
| Services | `services/` | Orchestration and business rules across multiple entities. |
| Interest engine | `interest_engine/` | Pure, framework-free calculation core using `Decimal`. |
| Models | `models/models.py` | SQLAlchemy ORM mappings. |
| Infra | `config.py`, `database.py`, `main.py` | Settings, engine/session, app wiring and optional seeding. |

### Routers

| Router | Prefix | Purpose |
| :--- | :--- | :--- |
| `auth.py` | `/api/auth` | `GET /me`, `POST /demo-login`. |
| `accounts.py` | `/api/accounts` | CRUD, account summary (balance, deposits, ADB, accrued interest). |
| `transactions.py` | `/api/transactions` | Create / update / delete transactions, paginated listing. |
| `interest.py` | `/api/interest` | Ad-hoc calculation, quarter preview, posting, posting history. |
| `slabs.py` | `/api/interest-slabs` | Interest slab CRUD. |
| `statement.py` | `/api/accounts/{id}/statement` | Passbook JSON + CSV download. |
| `csv_import.py` | `/api/import/csv` | Validate an uploaded CSV, then confirm the import. |
| `database_admin.py` | `/api/database` | Clear account data, purge static/demo data, wipe all data, re-seed. |

### Services

- **`auth_service.py`** — verifies Supabase JWTs (HS256) when a secret is configured and
  otherwise falls back to a lazily-created demo profile (local/offline use).
- **`transaction_service.py`** — converts ORM rows to engine records, validates that a
  withdrawal never drives a future balance negative, and computes running balances.
- **`interest_service.py`** — resolves quarter date ranges, runs the engine, persists
  calculation + daily breakdown, creates the `INTEREST_CREDIT` transaction and blocks
  duplicate quarter postings.
- **`statement_service.py`** — builds the chronological passbook with opening balance,
  debit/credit split and running balance.
- **`csv_import_service.py`** — parses CSV, validates each row, simulates balances and
  reports per-row errors before anything is committed.

### Interest engine (`interest_engine/`)

The engine has **no dependency on FastAPI, SQLAlchemy or the database** — it accepts plain
dataclasses and returns a `CalculationResult`. This makes it trivially unit-testable and
safe to reuse.

| File | Contents |
| :--- | :--- |
| `models.py` | `TransactionRecord`, `InterestSlabRecord`, `DailyBreakdownItem`, `CalculationResult`, `SlabTierType`. |
| `conventions.py` | `DayCountConvention` (Actual/365, Actual/366, Actual/Actual), `RoundingMode`, and the paise quantizer. |
| `engine.py` | `InterestEngine.calculate()` — the daily-product loop, tier splitting, negative-balance guard and `calculate_balance_on_date()` helper. |

---

## 4. Data Model

All tables use UUID primary keys. See `supabase/migrations/20260101000000_init_schema.sql`
for the full DDL, constraints and RLS policies.

```text
profiles (id ─▶ auth.users)
   │ 1
   │ n
accounts (user_id ─▶ profiles)
   │ 1                     │ 1                     │ 1
   ├───────── n ───────────┤                       │
transactions          interest_slabs         interest_postings
   ▲ 1                                          │ 1 ──▶ transaction_id
   │                                            │ 1 ──▶ calculation_id
   │ 1                                          ▼
interest_calculations ◀── 1 ── n ── interest_daily_breakdown
```

| Table | Purpose | Notable constraints |
| :--- | :--- | :--- |
| `profiles` | App user mirroring a Supabase auth user. | `id` FK → `auth.users`. |
| `accounts` | Savings accounts. | `account_number` UNIQUE; status enum check. |
| `transactions` | Ledger entries. | `amount > 0`; type check; `value_date` drives interest. |
| `interest_slabs` | Date-effective rate brackets. | `max_balance > min_balance`; tier/status checks. |
| `interest_calculations` | One row per posting run. | convention check; `period_end >= period_start`. |
| `interest_daily_breakdown` | Per-day interest snapshot of a calculation. | FK → `interest_calculations`. |
| `interest_postings` | Idempotency guard for quarterly posting. | `UNIQUE(account_id, period_year, period_quarter)`. |

Indexes exist on `accounts(user_id)`, `transactions(account_id, value_date, transaction_date)`,
`interest_slabs(status, effective_from, effective_to)` and the calculation/posting tables.

---

## 5. Authentication & Security

1. The frontend stores a bearer token and sends it on every request.
2. `get_current_user` verifies the token:
   - with `SUPABASE_JWT_SECRET` set, it performs full HS256 verification and auto-creates the
     profile from the token on first sight;
   - without it (local/demo), it accepts a demo token and returns a demo profile.
3. **Row Level Security** is enabled on every table. Row access is gated on
   `auth.uid() = user_id` (accounts) or an `EXISTS` check through the parent account
   (transactions, calculations, postings). Interest slabs are read-only to authenticated users.
4. The backend always re-validates business rules (positive amounts, no overdraft, duplicate
   posting) regardless of what the client sends.

---

## 6. Configuration & Data Seeding

`config.py` (Pydantic Settings) reads `.env`:

| Setting | Default | Meaning |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./savings_calculator.db` | SQLAlchemy connection string. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | `None` | Supabase project credentials. |
| `SUPABASE_JWT_SECRET` | `None` | Enables real JWT verification. |
| `DEFAULT_DAY_COUNT_CONVENTION` | `ACTUAL_365` | Engine default. |
| `ROUNDING_MODE` | `HALF_UP` | Rounding for posted interest. |
| `ALLOW_NEGATIVE_BALANCE` | `false` | Overdraft switch. |
| `AUTO_SEED_DEMO_DATA` | `true` | Seed demo profile/account/transactions/slabs on startup. |
| `SEED_DEFAULT_SLABS` | `true` | Seed the three default slabs (only when the above is true). |

On startup `init_db_and_seed()` always creates missing tables; it seeds demo content only when
`AUTO_SEED_DEMO_DATA` is true. Static data can also be removed at runtime through
`api/database_admin.py` (see [Deployment](DEPLOYMENT.md)).

---

## 7. Request Lifecycle (example: post quarterly interest)

```text
Settings/Quarterly page → api.postQuarterlyInterest()
   → POST /api/interest/post
      → get_current_user (JWT/demo)
      → InterestService.post_quarterly_interest()
          1. check interest_postings for a duplicate (raise 409 if found)
          2. run_calculation() → InterestEngine.calculate()
                • derive daily closing balances from value dates
                • split balances across active slabs
                • accumulate daily interest with Decimal
          3. persist InterestCalculation + InterestDailyBreakdown rows
          4. create INTEREST_CREDIT transaction
          5. persist InterestPosting
      → 200 JSON (posting id, interest amount)
   → toast + refresh postings/account
```

The same calculate → persist → guard pattern is reused by the ad-hoc calculator (without
persisting) and by the summary endpoint.
