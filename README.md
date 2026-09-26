# 🏦 AgyBank — Savings Account Interest Calculator (Daily Closing Balance Method)

A full-stack, production-grade banking system that calculates savings account interest using the **Daily Closing Balance (DCB)** method, engineered in accordance with banking standards (RBI Master Directions on Interest Rates on Rupee Deposits).

The core calculation logic is isolated in a modular Python engine (`interest_engine`) using high-precision `Decimal` arithmetic and configurable day-count conventions. The frontend is a **React 19 + Vite single-page app written in plain JavaScript / JSX (no TypeScript)**.

> 📚 **Documentation**
> - [Architecture](docs/ARCHITECTURE.md) — components, layers, data model and request flow.
> - [How It Works](docs/WORKING.md) — the DCB maths, calculation lifecycle, edge cases and a worked example.
> - [Deployment](docs/DEPLOYMENT.md) — local setup, configuration, production hosting and Docker.
> - [Supabase Setup](docs/SUPABASE.md) — creating a project, running migrations, RLS and connecting the app.
> - [Supabase Verification](docs/SUPABASE_VERIFICATION.md) — manually prove database connectivity, reads, writes and persistence.

---

## ✨ Key Features

- **Daily Closing Balance interest engine** with `Decimal` precision — no floating-point drift.
- **Value Date vs Booking Date** support with automatic historical recalculation.
- **Tiered (marginal) and flat** interest slabs with date-effective windows.
- **Quarterly interest posting** with a database-level duplicate-post guard.
- **Passbook / statement** with CSV export and print-to-PDF.
- **CSV batch import** with row-level validation and balance simulation.
- **Supabase PostgreSQL** with Row Level Security, plus zero-config SQLite for local dev.
- **Runtime data controls** — remove auto-seeded "static" demo data or wipe the whole database from the UI.

---

## 🧱 Technology Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 19, Vite, **JavaScript / JSX**, Tailwind CSS, Recharts, Lucide Icons |
| Backend | Python 3.12, FastAPI, Pydantic V2, SQLAlchemy 2.0 |
| Database | Supabase PostgreSQL (RLS, indexes, constraints) or local SQLite |
| Auth | Supabase Auth (JWT verification) with a demo-mode fallback |

```text
React Frontend (Vite + JSX + Tailwind)
          ↓  REST API / Bearer JWT
FastAPI Backend (Pydantic V2 + Decimal Engine)
          ↓  SQLAlchemy ORM / psycopg2
Supabase PostgreSQL (tables, RLS policies, indexes)
```

---

## 📐 The Formula at a Glance

For every calendar day `t`:

```text
Closing Balanceₜ = Opening Balanceₜ + Σ Creditsₜ − Σ Debitsₜ
Daily Interestₜ  = (Closing Balanceₜ × Applicable Annual Rateₜ) / Day-Count Denominator
Quarterly Interest = Round( Σ Daily Interestₜ )   → rounded to paise (ROUND_HALF_UP)
```

Day-count denominators: `ACTUAL_365` (default), `ACTUAL_366`, or `ACTUAL_ACTUAL` (leap-aware).
See [How It Works](docs/WORKING.md) for the full walkthrough and the Requirement-21 sample (₹161.10 for July 2026).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.10+ (3.12 recommended)
- Node.js 18+ (20+ recommended) and npm 9+

### 1. Backend

```bash
python -m venv venv

# Windows (Git Bash / PowerShell):
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Run the automated tests (21 unit + integration tests)
pytest -v

# Start the API on http://localhost:8000
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

On first startup the API creates its tables and (by default) seeds a demo account with the Requirement-21 sample transactions and default interest slabs. Copy `.env.example` to `.env` to customise this.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The app auto-logs in through backend demo mode.

### 3. Production build

```bash
cd frontend
npm run build     # emits static assets into frontend/dist
```

---

## 🗂️ Keeping Only Your Own Database Data ("static" vs live data)

"Static" data is anything the application **seeds automatically** on startup:

- the demo profile (`demo.user@antigravitybank.com`),
- the demo savings account (`SB-50982341092`) and its Requirement-21 sample transactions,
- the three default interest slabs (3.00% / 3.50% / 4.00%).

Everything you create yourself is treated as **live database data**. You can now:

| Goal | How |
| :--- | :--- |
| Clear one account's transactions | **Settings → Data & Static Seed Management → Clear This Account**, or `DELETE /api/database/accounts/{id}/clear-transactions` |
| Remove only seeded demo data, keep your accounts | **Remove Static Seed Data**, or `DELETE /api/database/purge-static` |
| Empty the entire business database | **Wipe All Data**, or `DELETE /api/database/purge-all` |
| Re-add the sample dataset on demand | **Re-seed Sample Dataset**, or `POST /api/database/seed-sample` |
| Never seed on startup | Set `AUTO_SEED_DEMO_DATA=false` (and `SEED_DEFAULT_SLABS=false`) in `.env` |

> The purge endpoints require an authenticated user (the demo token works locally). Tables and the schema are always preserved.

---

## 📂 Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── api/                 # accounts, auth, csv_import, database_admin,
│   │   │                        # interest, slabs, statement, transactions
│   │   ├── interest_engine/     # conventions, engine, pure-Decimal models
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic V2 request/response schemas
│   │   ├── services/            # auth, csv_import, interest, statement, transaction
│   │   ├── config.py            # environment settings
│   │   ├── database.py          # engine & session management
│   │   └── main.py              # FastAPI app, router registration, optional seeding
│   ├── tests/                   # 15 calculation + 6 API tests
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Modal.jsx, Navbar.jsx, Sidebar.jsx, StatCard.jsx, Toast.jsx
│   │   ├── pages/               # Dashboard, Accounts, Transactions, InterestCalculator,
│   │   │                        # QuarterlyPosting, Passbook, CSVImport, InterestSlabs, Settings
│   │   ├── services/api.js      # typed-free fetch client
│   │   ├── utils/formatters.js  # currency / date / percent formatters
│   │   ├── App.jsx              # root router & layout
│   │   └── main.jsx             # React DOM mount
│   ├── vite.config.js
│   └── package.json
│
├── supabase/
│   ├── migrations/20260101000000_init_schema.sql  # tables, indexes, RLS
│   └── seed.sql                                   # seed slabs, demo user & account
│
├── docs/                        # ARCHITECTURE, WORKING, DEPLOYMENT, SUPABASE
├── .env.example
├── pytest.ini
└── README.md
```

---

## 🧪 Testing

```bash
pytest -v
```

21 tests cover the Requirement-20 scenarios: stable balances, mid-period deposits/withdrawals, same-day netting, backdated value dates, tiered slabs, mid-quarter rate changes, leap years, zero balances, quarter boundaries, duplicate-posting prevention, negative-balance rejection, Actual/365 vs Actual/366, plus API integration tests.

---

## 📌 Business Rules & Edge Cases

1. **Backdated / value-dated transactions** re-derive daily balances from the value date onward.
2. **Negative-balance prevention** — withdrawals that would overdraw any future day are rejected (HTTP 400).
3. **Same-day ordering** — `OPENING_BALANCE → DEPOSIT → INTEREST_CREDIT → WITHDRAWAL`.
4. **Duplicate quarter posting** — enforced by `UNIQUE(account_id, period_year, period_quarter)` (HTTP 409).
5. **Leap years** — full 29-February handling for 2024, 2028 and beyond.
6. **Date-effective rate changes** — historical runs remain reproducible after new rates are announced.
7. **CSV pre-validation** — parses multiple date formats, rejects non-positive amounts, simulates balances before commit.

---

## 📄 License

Internal / demonstration project.
