# Deployment

This guide covers running the stack locally, configuring it through environment variables,
managing static vs live data, and shipping it to production.

For the database specifically, see the dedicated [Supabase Setup](SUPABASE.md) guide.

---

## 1. Prerequisites

- **Python 3.10+** (3.12 recommended) and `pip`
- **Node.js 18+** (20+ recommended) and `npm`
- A **PostgreSQL / Supabase** database for production (SQLite is fine for local dev)

---

## 2. Environment Configuration

Copy the template and edit it:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | yes | Defaults to SQLite locally. Use your Supabase PostgreSQL URL in production. |
| `SUPABASE_URL` | prod | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | prod | Public anon key (used where client-side auth is involved). |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | Server-side privileged key — keep secret; never expose to the browser. |
| `SUPABASE_JWT_SECRET` | prod | Enables real JWT verification. Without it the API falls back to demo auth. |
| `DEFAULT_DAY_COUNT_CONVENTION` | no | `ACTUAL_365` (default), `ACTUAL_366`, `ACTUAL_ACTUAL`. |
| `ROUNDING_MODE` | no | `HALF_UP`. |
| `ALLOW_NEGATIVE_BALANCE` | no | `false` by default. |
| `AUTO_SEED_DEMO_DATA` | no | `true` locally; set `false` for an empty production database. |
| `SEED_DEFAULT_SLABS` | no | Seed the three default slabs on startup. |
| `ALLOW_DEMO_AUTH` | no | `true` for local tests; set `false` in production so deleted Supabase users cannot reappear through demo-token. |

The frontend reads only build-time variables (put them in `frontend/.env`):

```bash
VITE_API_URL=https://your-api.example.com
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

> Never ship `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` in the frontend.

---

## 3. Local Development

### Backend

```bash
python -m venv venv
source venv/Scripts/activate        # Windows (Git Bash); use venv/bin/activate on macOS/Linux
pip install -r backend/requirements.txt

pytest -v                            # 21 tests
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Swagger UI: <http://localhost:8000/docs> · Health: <http://localhost:8000/api/health>

### Frontend

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

The Vite dev server proxies no API — the client calls `VITE_API_URL` (defaults to
`http://localhost:8000`).

---

## 4. Managing Static vs Live Data

The app seeds demo content only when `AUTO_SEED_DEMO_DATA=true`. To run with **only your own
data**:

1. Set `AUTO_SEED_DEMO_DATA=false` (and optionally `SEED_DEFAULT_SLABS=false`) in `.env`.
2. Or purge existing seed data at runtime from **Settings → Data & Static Seed Management**, or:

```bash
# Remove only seeded demo data (demo profile/account/transactions + default slabs)
curl -X DELETE http://localhost:8000/api/database/purge-static \
     -H "Authorization: Bearer demo-token"

# Empty the entire business database (schema preserved)
curl -X DELETE http://localhost:8000/api/database/purge-all \
     -H "Authorization: Bearer demo-token"

# Clear a single account
curl -X DELETE http://localhost:8000/api/database/accounts/<account-id>/clear-transactions \
     -H "Authorization: Bearer demo-token"
```

In production these require a valid Supabase JWT instead of `demo-token`.

---

## 5. Production Build

### Frontend (static)

```bash
cd frontend
npm run build        # outputs frontend/dist
```

Deploy `frontend/dist` to any static host:

- **Vercel / Netlify** — set build command `npm run build`, publish directory `dist`.
- **Nginx / S3+CDN** — upload `dist` and serve `index.html` as the SPA fallback:

```nginx
location / {
    root /var/www/app;
    try_files $uri $uri/ /index.html;
}
```

Set `VITE_API_URL` to the deployed API URL **at build time** (Vite inlines env vars).

### Backend

Run with a production ASGI server behind a reverse proxy:

```bash
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Hosting notes:

- **Render / Railway / Fly.io** — start command as above; add environment variables from
  section 2; expose port `8000`.
- **Docker** (example):

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**CORS:** add your frontend origin to the allowed list. Editing `CORS_ORIGINS` in
`backend/app/config.py` (or overriding via env) is recommended rather than the current
permissive `"*"`.

**Health check:** point your platform's probe at `GET /api/health`.

---

## 6. Database Migration (Production)

Apply the schema before first start:

```sql
-- In the Supabase SQL editor, run:
-- supabase/migrations/20260101000000_init_schema.sql
```

Optionally seed demo data with `supabase/seed.sql` (skip this for a clean production
database — or seed then purge it). Full steps are in [Supabase Setup](SUPABASE.md).

> The backend also calls `Base.metadata.create_all()` on startup, so tables are created
> automatically — but the migration additionally installs constraints, indexes and RLS
> policies and should still be run.

---

## 7. Post-Deploy Checklist

- [ ] `GET /api/health` returns `{"status":"healthy", ...}`.
- [ ] Frontend can reach the API (correct `VITE_API_URL`, CORS allows the origin).
- [ ] `DATABASE_URL` points at PostgreSQL, not a leftover SQLite file.
- [ ] `SUPABASE_JWT_SECRET` set so auth is verified (not demo mode).
- [ ] `AUTO_SEED_DEMO_DATA=false` if you want an empty production database.
- [ ] Secrets (`SERVICE_ROLE_KEY`, `JWT_SECRET`) are server-side only.
- [ ] Backups / point-in-time recovery enabled on the database.

---

## 8. Deploy Backend to Render

Create a **Web Service** in Render connected to this repository.

Use these settings:

| Render setting | Value |
| :--- | :--- |
| Runtime | Python 3 |
| Root directory | Leave blank (`D:\Project` repository root) |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/api/health` |
Root Directory: blank
Build Command: pip install -r backend/requirements.txt
Start Command: uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
Do not set the root directory to `backend`. The application imports `backend.app...` and must start from the repository root.

Add these Render environment variables:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@POOLER_HOST:6543/postgres?sslmode=require
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
DEFAULT_DAY_COUNT_CONVENTION=ACTUAL_365
ROUNDING_MODE=HALF_UP
ALLOW_NEGATIVE_BALANCE=false
AUTO_SEED_DEMO_DATA=false
SEED_DEFAULT_SLABS=false
CORS_ORIGINS=["https://YOUR-APP.vercel.app"]
```

Use the exact PostgreSQL URI from Supabase. The pooler URI on port `6543` is usually the best choice for hosted services. Do not paste the brackets around the password, and URL-encode special password characters. Keep `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` only in Render.

After deployment, copy the Render URL, for example `https://agybank-api.onrender.com`, and test:

```powershell
Invoke-RestMethod https://agybank-api.onrender.com/api/health
```

It should return a healthy response. The first Render request may be slow while a free instance wakes up.

## 9. Deploy Frontend to Vercel

Create a Vercel project connected to the same repository.

Use these settings:

| Vercel setting | Value |
| :--- | :--- |
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

Add this Vercel environment variable for **Production**, **Preview**, and **Development**:

```dotenv
VITE_API_URL=https://agybank-api.onrender.com
```

Use your real Render URL. Do not add a trailing slash. `VITE_` variables are compiled into browser JavaScript, so only public values belong there. This project does not need the Supabase service-role key in Vercel.

After the first Vercel deployment, copy its URL and update Render's `CORS_ORIGINS`:

```dotenv
CORS_ORIGINS=["https://your-project.vercel.app"]
```

Redeploy Render after changing this value. If you use a custom domain, include that exact `https://` origin too. For temporary Vercel preview URLs, either add each preview origin or use a controlled CORS strategy in the backend.

## 10. Production Verification

1. In Supabase SQL Editor, run the migration before the first Render deploy.
2. Confirm Render logs contain `Application startup complete`.
3. Open `https://YOUR-RENDER-URL/api/health`.
4. Open the Vercel URL and confirm the browser network requests target the Render URL, not `localhost` or `127.0.0.1`.
5. Create a small test transaction in the UI.
6. Confirm it in Supabase:

```sql
select transaction_type, amount, description, reference
from public.transactions
order by created_at desc
limit 10;
```

7. Remove the test row when finished.

### Authentication and roles

The frontend now provides email/password login, logout, and customer registration. Registration
always creates a `CUSTOMER`; only `ADMIN` profiles can create or edit accounts, transactions,
interest slabs, imports, postings, or database seed/purge data. These permissions are enforced by
the backend as well as hidden in the customer UI.

Writes are committed synchronously to `DATABASE_URL`, and the active frontend refreshes account,
dashboard, transaction, and passbook data every three seconds so changes from another session become
visible quickly. This is polling, not Supabase Realtime. True Supabase Realtime requires migrating
the browser session to Supabase Auth and enabling authenticated table subscriptions; do not expose
the service-role key or make business tables publicly readable just to create a websocket channel.

For local/demo use, the seeded administrator is `demo.user@antigravitybank.com` with password
`Admin@123`. Change or remove this demo account before a public deployment. The `/api/auth/demo-login`
endpoint remains available for automated local smoke tests and returns the admin demo session.

For a public deployment, replace local email/password auth with Supabase Auth sign-in and send the
resulting access token to the backend. Keep `SUPABASE_JWT_SECRET` configured on Render so real
tokens are verified.
