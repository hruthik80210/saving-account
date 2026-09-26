# Supabase Deployment & Connection Guide

This guide walks through creating a Supabase project, applying the database schema and
security policies, connecting the FastAPI backend, and verifying the setup.

---

## 1. Create a Supabase Project

1. Sign in at <https://supabase.com> and click **New project**.
2. Choose an organisation, name the project, set a **database password** (save it — you need it
   in the connection string) and pick a region close to your backend.
3. Wait for provisioning to finish.

You now have a project reference (the `<project-ref>` in `https://<project-ref>.supabase.co`).

---

## 2. Apply the Schema (Migration)

The schema lives in [`supabase/migrations/20260101000000_init_schema.sql`](../supabase/migrations/20260101000000_init_schema.sql)
and creates: `profiles`, `accounts`, `transactions`, `interest_slabs`, `interest_calculations`,
`interest_daily_breakdown`, `interest_postings`, their indexes/constraints, and all RLS policies.

**Option A — SQL Editor (quickest)**

1. Open **SQL Editor** in the dashboard.
2. Paste the entire contents of the migration file and click **Run**.
3. Confirm all tables appear under **Table Editor**.

**Option B — Supabase CLI (repeatable)**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase db push          # applies files in supabase/migrations/
```

> Re-running the migration is safe: it uses `CREATE TABLE IF NOT EXISTS`,
> `CREATE INDEX IF NOT EXISTS` and `ON CONFLICT DO NOTHING` where applicable.

---

## 3. (Optional) Seed Demo Data

Run [`supabase/seed.sql`](../supabase/seed.sql) in the SQL editor to insert the three default
interest slabs, the demo profile and the Requirement-21 sample account/transactions.

Skip this for a clean production database, or seed then remove it later with the purge
endpoints described below.

> Important: `profiles.id` references `auth.users(id)`. The seed inserts a **standalone**
> profile row for the demo user. If you intend to log in as that user through Supabase Auth,
> create the auth user first or let the backend auto-create the profile from a valid JWT.

---

## 4. Row Level Security (RLS)

RLS is enabled on every table by the migration. Policies enforce that users only reach their
own data:

- `profiles` — a user can select/update only their own row (`auth.uid() = id`).
- `accounts` — select/insert/update/delete only where `auth.uid() = user_id`.
- `transactions` — gated through the parent account (`EXISTS (... accounts.user_id = auth.uid())`).
- `interest_calculations` / `interest_daily_breakdown` / `interest_postings` — same parent-account check.
- `interest_slabs` — selectable by any authenticated user.

Because the FastAPI backend connects with a database role, RLS applies to that connection too.
If the backend must bypass RLS (for admin operations), connect with the **service role** — and
never expose that key to the browser.

---

## 5. Get Connection Details

In the dashboard, open **Project Settings**:

### Connection string — direct (best for long-lived servers)

**Settings → Database → Connection string → URI**

```text
postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres
```

### Connection string — pooler (best for serverless / many short connections)

**Settings → Database → Connection pooling**

```text
postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres
```

> Use the **transaction** pooler (port `6543`) for serverless. If you hit prepared-statement
> errors through the pooler, append `?sslmode=require` or disable prepared statements.

### API keys

**Settings → API**: copy the **Project URL** and the **anon** public key (and the
**service_role** key only if a server-side admin path needs it).

### JWT secret

**Settings → API → JWT Settings**: copy the **JWT secret**. The backend uses it to verify
Supabase Auth tokens (HS256).

---

## 6. Configure the Backend

Put the values into `.env`:

```bash
# Direct connection (recommended for a normal server)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres

# Or, for serverless / connection pooling:
# DATABASE_URL=postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-side only
SUPABASE_JWT_SECRET=<jwt-secret>

# Start with a clean database — no auto-seeded demo content
AUTO_SEED_DEMO_DATA=false
```

`DATABASE_URL` alone is enough to connect; the Supabase API/JWT values are needed for real
authentication. `psycopg2-binary` (already in `backend/requirements.txt`) is the PostgreSQL
driver.

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --port 8000 --reload
```

---

## 7. Configure the Frontend

Store public values in `frontend/.env` (they are inlined at build time):

```bash
VITE_API_URL=https://your-api.example.com
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Only the **anon** key belongs here. The frontend talks to your FastAPI backend, which performs
the actual privileged database work.

---

## 8. Verify the Connection

1. **Backend up:** `GET http://localhost:8000/api/health` → `{"status":"healthy", ...}`.
2. **Data reads:** `GET /api/interest-slabs` returns the seeded slabs (or `[]` if you skipped
   seeding). This proves the PostgreSQL connection works.
3. **Auth:** send a real Supabase access token as `Authorization: Bearer <token>`; the backend
   verifies it with `SUPABASE_JWT_SECRET` and auto-creates the matching profile on first use.
4. **RLS sanity check:** insert an account for user A, then query `accounts` as user B through
   the PostgREST API — row B should see nothing.

---

## 9. Removing Seeded Data from Supabase

If you ran `seed.sql` and later want a clean database, either:

- run in the SQL editor:

```sql
DELETE FROM public.interest_postings;
DELETE FROM public.interest_daily_breakdown;
DELETE FROM public.interest_calculations;
DELETE FROM public.transactions;
DELETE FROM public.interest_slabs;
DELETE FROM public.accounts;
DELETE FROM public.profiles;
```

- or call the backend endpoints (see [Deployment](DEPLOYMENT.md#4-managing-static-vs-live-data)):

```bash
curl -X DELETE https://your-api.example.com/api/database/purge-static -H "Authorization: Bearer <token>"
curl -X DELETE https://your-api.example.com/api/database/purge-all    -H "Authorization: Bearer <token>"
```

> Deletion order matters because of foreign keys (children before parents). The `purge-all`
> endpoint already deletes in the correct order.

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
| :--- | :--- |
| `psycopg2.OperationalError: could not connect` | Wrong host/port or password; ensure the project is not paused. |
| `FATAL: no pg_hba.conf entry ... SSL off` | Use `sslmode=require` in the connection string (Supabase requires TLS). |
| `prepared statement "..." already exists` | You're on the pooler in session mode; use port `6543` transaction mode or disable prepared statements. |
| Auth always falls back to demo | `SUPABASE_JWT_SECRET` is missing/mismatched. |
| `new row violates row-level security policy` | The connection role lacks the required policy, or the JWT `sub` doesn't own the row. |
| Tables missing after deploy | Run the migration; `create_all()` creates tables but not the RLS policies/indexes. |
| Interest slab reads return `[]` | No active slabs — seed them or add via `/api/interest-slabs`. |

---

## 11. Related Documentation

- [Deployment](DEPLOYMENT.md) — general hosting, environment and Docker.
- [Architecture](ARCHITECTURE.md) — data model, RLS model and request flow.
- [How It Works](WORKING.md) — the interest calculation itself.
