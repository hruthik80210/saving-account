import { useState } from 'react';
import {
  HelpCircle,
  Calculator,
  ShieldCheck,
  Calendar,
  Lock,
  Database,
  Layers,
  Code2,
  CheckCircle2,
  Trash2,
  Sprout,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

export const SettingsPage = ({ account, onRefreshAccounts, onDataChanged }) => {
  const { addToast } = useToast();
  const [busyAction, setBusyAction] = useState(null);

  const runAction = async (key, fn, successTitle) => {
    if (busyAction) return;
    try {
      setBusyAction(key);
      const res = await fn();
      addToast('success', successTitle, res?.message || 'Operation completed successfully.');
      if (onDataChanged) onDataChanged();
      if (onRefreshAccounts) onRefreshAccounts();
    } catch (err) {
      addToast('error', 'Operation failed', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleClearAccount = () => {
    if (!account) {
      addToast('warning', 'No account selected', 'Select a savings account before clearing transactions.');
      return;
    }
    if (!window.confirm(`Delete every transaction for account ${account.account_number}? Balances will reset to zero.`)) return;
    runAction('clear-account', () => api.clearAccountTransactions(account.id), 'Account cleared');
  };

  const handlePurgeStatic = () => {
    if (!window.confirm('Remove all seeded demo data (demo profile, sample account/transactions and default slabs) while keeping accounts you created? This cannot be undone.')) return;
    runAction('purge-static', () => api.purgeStaticData(), 'Seeded data removed');
  };

  const handlePurgeAll = () => {
    if (!window.confirm('Delete ALL business data (accounts, transactions, slabs, calculations and postings), leaving an empty database? This cannot be undone.')) return;
    runAction('purge-all', () => api.purgeAllData(), 'Database emptied');
  };

  const handleSeedSample = () => {
    runAction('seed', () => api.resetSeedData(), 'Sample data seeded');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Calculation Architecture & Guidelines</h1>
        <p className="text-xs text-slate-400 mt-1">
          Detailed explanation of the Daily Closing Balance method, conventions, rounding, and Supabase security
        </p>
      </div>

      {/* Core Formula Box */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-sky-950/40 via-slate-900 to-indigo-950/30 border border-sky-800/40 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Daily Closing Balance Method (RBI Directive)</h2>
            <p className="text-xs text-slate-400">Master Circular on Interest Rates on Rupee Deposits</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 font-mono text-xs text-sky-300 space-y-2">
          <div>Daily Interest = (Daily Closing Balance × Annual Rate) / Day-Count Denominator</div>
          <div>Quarterly Interest = ∑ (Daily Interest for every day t in Quarter)</div>
          <div className="text-slate-400 font-sans text-[11px] pt-1 border-t border-slate-800">
            Default Denominator = 365 (Actual/365). 366 is used when configured for leap years.
          </div>
        </div>
      </div>

      {/* Core Architectural Tenets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Value Date vs Booking Date */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl space-y-3">
          <div className="flex items-center space-x-2 text-sky-400 font-semibold text-sm">
            <Calendar className="w-4 h-4" />
            <span>Value Date vs Transaction Date</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            In standard banking, a transaction carries both a <strong>Booking Date</strong> (when the entry was captured) and a <strong>Value Date</strong> (when funds legally start or cease earning interest).
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            If a deposit is made with a backdated value date, the Python engine will dynamically recalculate the closing balances for all subsequent calendar days and re-accumulate the exact interest product.
          </p>
        </div>

        {/* Tiered Margins */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            <span>Tiered (Marginal) Interest Slabs</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            In tiered savings calculations:
          </p>
          <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
            <li>₹0 to ₹1,00,000 earns 3.00% p.a.</li>
            <li>₹1,00,001 to ₹5,00,000 earns 3.50% p.a.</li>
            <li>Above ₹5,00,000 earns 4.00% p.a.</li>
          </ul>
          <p className="text-xs text-slate-400 leading-relaxed">
            A balance of ₹2,50,000 is partitioned: ₹1,00,000 earns 3.00% and ₹1,50,000 earns 3.50%.
          </p>
        </div>

        {/* Strict Decimal Arithmetic */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl space-y-3">
          <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
            <Code2 className="w-4 h-4" />
            <span>No Floating Point Arithmetic</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Standard IEEE 754 floating-point numbers can produce binary representation errors (e.g. 0.1 + 0.2 ≠ 0.3).
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Our backend strictly uses Python's <code className="text-sky-300 font-mono">decimal.Decimal</code> with <code className="text-sky-300 font-mono">ROUND_HALF_UP</code> banking rounding rules.
          </p>
        </div>

        {/* Supabase PostgreSQL & RLS */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl space-y-3">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-sm">
            <Database className="w-4 h-4" />
            <span>Supabase & Row Level Security (RLS)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every table has Row Level Security enabled. Users can only select and modify transactions and accounts belonging to their verified <code className="text-sky-300 font-mono">auth.uid()</code>.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            The frontend communicates with FastAPI, which enforces JWT validation and business rules before interacting with the database.
          </p>
        </div>
      </div>

      {/* Data & Static Seed Management */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl space-y-5">
        <div className="flex items-center space-x-2">
          <Trash2 className="w-5 h-5 text-rose-400" />
          <div>
            <h3 className="text-base font-bold text-white">Data & Static Seed Management</h3>
            <p className="text-xs text-slate-400">
              Remove auto-seeded "static" demo data and keep only the records you create in the database.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Clear current account */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="text-sm font-semibold text-white">Clear This Account</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Deletes every transaction, calculation and posting for the selected account ({account ? account.account_number : 'no account selected'}).
            </p>
            <button
              onClick={handleClearAccount}
              disabled={busyAction !== null}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'clear-account' ? 'animate-spin' : ''}`} />
              <span>Clear Account Transactions</span>
            </button>
          </div>

          {/* Purge static */}
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-3">
            <div className="text-sm font-semibold text-amber-300">Remove Static / Demo Data</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Purges the seeded demo profile, sample account &amp; transactions and the default interest slabs, while leaving the accounts you created untouched.
            </p>
            <button
              onClick={handlePurgeStatic}
              disabled={busyAction !== null}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Remove Static Seed Data</span>
            </button>
          </div>

          {/* Purge all */}
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 space-y-3">
            <div className="text-sm font-semibold text-rose-300">Wipe Entire Database</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Deletes <strong>all</strong> business records across every table, leaving a completely empty database (schema and tables are preserved).
            </p>
            <button
              onClick={handlePurgeAll}
              disabled={busyAction !== null}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wipe All Data</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2 text-xs text-sky-300">
            <Sprout className="w-4 h-4 flex-shrink-0 mt-0.5 text-sky-400" />
            <div>
              <strong className="block text-white">Need the sample dataset again?</strong>
              Seed the Requirement-21 July 2026 sample transactions back into your primary account.
            </div>
          </div>
          <button
            onClick={handleSeedSample}
            disabled={busyAction !== null}
            className="flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
          >
            <Sprout className={`w-3.5 h-3.5 ${busyAction === 'seed' ? 'animate-pulse' : ''}`} />
            <span>Re-seed Sample Dataset</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Tip: set <code className="font-mono text-slate-400">AUTO_SEED_DEMO_DATA=false</code> in your backend <code className="font-mono text-slate-400">.env</code> to stop the server from re-inserting demo data on every restart.
        </p>
      </div>

      {/* System Diagnostic Status */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>System Engine Status</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400">Calculation Backend</div>
            <div className="text-emerald-400 font-bold font-mono mt-1 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Python 3.12 / FastAPI</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400">Database Layer</div>
            <div className="text-sky-400 font-bold font-mono mt-1 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Supabase PostgreSQL / RLS</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400">Financial Rounding</div>
            <div className="text-amber-400 font-bold font-mono mt-1 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>ROUND_HALF_UP (2 decimals)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
