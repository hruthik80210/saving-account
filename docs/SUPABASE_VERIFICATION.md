# Supabase Storage Verification

This project stores business data through the FastAPI backend. The backend uses SQLAlchemy and the `DATABASE_URL` connection string; the browser does not write directly to Supabase.

```text
React frontend
    -> FastAPI REST API
        -> SQLAlchemy
            -> Supabase PostgreSQL
```

## 1. Configure Supabase

In the root `.env` file, configure the database connection copied from Supabase Project Settings -> Database -> Connection string:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres?sslmode=require
```

Also configure the Supabase project values when using real authentication:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET=YOUR_JWT_SECRET
```

Do not commit `.env` or expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend.

The project accepts a normal `postgresql://` URL and selects the installed `psycopg2` driver automatically.

## 2. Apply the Database Schema

Run `supabase/migrations/20260101000000_init_schema.sql` in Supabase SQL Editor, or apply it with the Supabase CLI. It creates:

- `profiles`
- `accounts`
- `transactions`
- `interest_slabs`
- `interest_calculations`
- `interest_daily_breakdown`
- `interest_postings`

The backend `create_all()` call can create tables, but it does not replace the migration because the migration also creates indexes and RLS policies.

## 3. Start the Backend Correctly

Run these commands from the project root, `D:\Project`:

```powershell
.\venv\Scripts\Activate.ps1
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend must start without a PostgreSQL connection error. If it fails with `could not translate host name`, the Supabase hostname, project state, DNS, or network is the problem. If it fails with `password authentication failed`, reset or replace the database password. Supabase commonly requires `sslmode=require`.

## 4. Check the Connection Without Changing Data

In another PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Expected result:

```text
status  app                                  version
------  ---                                  -------
healthy Savings Account Interest Calculator 1.0.0
```

Health only proves that the API process is running. This request proves that the API can read database data:

```powershell
$headers = @{ Authorization = 'Bearer demo-token' }
Invoke-RestMethod -Headers $headers http://localhost:8000/api/interest-slabs
Invoke-RestMethod -Headers $headers http://localhost:8000/api/accounts
```

The response should contain the interest slabs and accounts stored in the configured PostgreSQL database. An empty array is still a successful database read if demo seeding is disabled.

## 5. Verify Data in Supabase Dashboard

Open Supabase -> Table Editor and inspect the `public` schema:

1. Open `profiles` and find the authenticated/demo profile.
2. Open `accounts` and note an account `id`.
3. Open `transactions` and filter by that `account_id`.
4. Open `interest_slabs` to verify the configured rates.
5. After quarterly posting, inspect `interest_calculations`, `interest_daily_breakdown`, and `interest_postings`.

You can also use SQL Editor:

```sql
select count(*) as profiles from public.profiles;
select count(*) as accounts from public.accounts;
select count(*) as transactions from public.transactions;
select count(*) as slabs from public.interest_slabs;

select id, account_number, user_id, status
from public.accounts
order by created_at desc;

select id, account_id, transaction_type, amount, transaction_date, value_date, reference
from public.transactions
order by created_at desc
limit 20;
```

The row counts and records should match the API responses.

## 6. Prove a Write and Read It Back

Use an existing account ID from `/api/accounts`. The demo account ID is normally `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` when automatic demo seeding is enabled.

```powershell
$headers = @{
  Authorization = 'Bearer demo-token'
  'Content-Type' = 'application/json'
}

$body = @{
  account_id = 'YOUR_ACCOUNT_ID'
  transaction_date = '2026-09-26'
  value_date = '2026-09-26'
  transaction_type = 'DEPOSIT'
  amount = 1.23
  description = 'Supabase persistence test'
  reference = 'SUPABASE-CHECK-20260926'
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri http://localhost:8000/api/transactions `
  -Headers $headers `
  -Body $body
```

Read it back through the API:

```powershell
Invoke-RestMethod -Headers @{ Authorization = 'Bearer demo-token' } `
  'http://localhost:8000/api/accounts/YOUR_ACCOUNT_ID/transactions?search=SUPABASE-CHECK-20260926'
```

Then run this in Supabase SQL Editor:

```sql
select account_id, transaction_type, amount, description, reference
from public.transactions
where reference = 'SUPABASE-CHECK-20260926';
```

The API response and SQL result should contain the same row. This is the definitive manual proof that the application is writing to Supabase.

Delete the test row afterward if required:

```sql
delete from public.transactions
where reference = 'SUPABASE-CHECK-20260926';
```

## 7. Normal Application Workflow

1. Start FastAPI with the Supabase `DATABASE_URL`.
2. FastAPI creates missing tables and optionally seeds demo data.
3. Open the Vite frontend at `http://localhost:5173`.
4. The frontend calls `/api/auth/demo-login` in local demo mode.
5. The frontend calls `/api/accounts`, then loads summaries, transactions, slabs, statements, and calculations.
6. Adding a transaction sends `POST /api/transactions`.
7. FastAPI validates the transaction, stores it in PostgreSQL, and recalculates affected balances.
8. The frontend refreshes the affected page or dashboard data.
9. Quarterly posting stores the calculation, daily breakdown, posting record, and interest-credit transaction.

## 8. Important Distinctions

- `GET /api/health` does not prove database connectivity.
- Successful `/api/accounts` or `/api/interest-slabs` reads prove database connectivity.
- A successful transaction POST followed by a matching SQL row proves persistence.
- The frontend currently uses REST polling/refetches, not Supabase Realtime subscriptions. Other browser tabs will not update automatically until they refresh or refetch.
- If `DATABASE_URL` starts with `sqlite:///`, all writes go to a local SQLite file instead of Supabase.
- Relative SQLite paths depend on the directory used to start the backend. Use an absolute SQLite path for predictable local testing.

## 9. Troubleshooting

| Symptom | Meaning | Action |
| --- | --- | --- |
| `ModuleNotFoundError: No module named 'backend'` | Backend started from `D:\Project\backend` | Start it from `D:\Project` |
| `could not translate host name` | Supabase hostname is not reachable or does not resolve | Verify project ref, project status, DNS, VPN/firewall, and connection string |
| `password authentication failed` | Database password is wrong | Reset the database password and update `.env` |
| `SSL off` or `no pg_hba.conf entry` | TLS is required | Add `?sslmode=require` to `DATABASE_URL` |
| API starts but tables are missing | Migration was not applied | Run the migration in Supabase SQL Editor |
| API returns `[]` | Database is reachable but empty or seeding is disabled | Check `AUTO_SEED_DEMO_DATA` and inspect Table Editor |
| Browser shows connection refused | FastAPI is not running on port 8000 | Start the backend and reload the frontend |

Never paste database passwords or service-role keys into source files, tickets, screenshots, or chat messages.
