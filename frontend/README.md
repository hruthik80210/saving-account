# AgyBank Frontend

React 19 + Vite single-page app for the Savings Account Interest Calculator, written in
**plain JavaScript / JSX (no TypeScript)** with Tailwind CSS, Recharts and Lucide icons.

## Scripts

```bash
npm install      # install dependencies
npm run dev      # start the dev server on http://localhost:5173
npm run build    # production build -> dist/
npm run preview  # preview the production build
npm run lint     # oxlint
```

## Environment

Create `frontend/.env` (Vite only exposes `VITE_`-prefixed variables):

```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

`VITE_API_URL` defaults to `http://localhost:8000` when unset.

## Structure

```text
src/
├── components/   Modal, Navbar, Sidebar, StatCard, Toast (+ useToast)
├── pages/        Dashboard, Accounts, Transactions, InterestCalculator,
│                 QuarterlyPosting, Passbook, CSVImport, InterestSlabs, Settings
├── services/     api.js — fetch client with bearer-token handling
├── utils/        formatters.js — currency / date / percent helpers
├── App.jsx       root layout, tab routing and shared state
├── main.jsx      React DOM mount
└── index.css     Tailwind layers and custom fintech styling
```

Only **.jsx / .js** files are used. There is no `tsconfig.json`, and the build runs
`vite build` directly (no `tsc` step).

See the repository root [README](../README.md) and [docs/](../docs) for the full
architecture, calculation logic and deployment guides.
