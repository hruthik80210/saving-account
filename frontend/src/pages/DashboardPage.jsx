import { useEffect, useState } from 'react';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Calendar,
  Sparkles,
  RefreshCw,
  Plus,
  Coins,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api } from '../services/api';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useToast } from '../components/Toast';

export const DashboardPage = ({
  account,
  onOpenAddTx,
  isAdmin,
  onNavigateToCalculator,
  onNavigateToQuarterly,
  refreshSignal,
}) => {
  const { addToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [calcResult, setCalcResult] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async (includeCalculation = false) => {
    try {
      if (includeCalculation) setLoading(true);
      const [sumData, txData] = await Promise.all([
        api.getAccountSummary(account.id),
        api.getTransactions(account.id, { limit: 8 }),
      ]);
      setSummary(sumData);
      setRecentTransactions(txData.data);

      if (!includeCalculation || txData.total === 0) {
        setCalcResult(null);
        return;
      }

      // Calculate the chart trend only on initial account load. Realtime updates
      // refresh balances and transactions without repeating this expensive job.
      const now = new Date();
      const currentYear = now.getFullYear();
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;

      try {
        const calc = await api.calculateInterest({
          account_id: account.id,
          start_date: startDate,
          end_date: endDate,
        });
        setCalcResult(calc);
      } catch {
        // In case full year has dates without slabs, fallback gracefully
      }
    } catch (err) {
      addToast('error', 'Failed to load dashboard data', err.message);
    } finally {
      if (includeCalculation) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
  }, [account.id]);

  useEffect(() => {
    if (refreshSignal > 0) fetchDashboardData(false);
  }, [refreshSignal]);

  // Prepare chart data: downsample daily points for smooth area chart if many points
  const chartData = (calcResult?.daily_breakdown || []).map((d) => ({
    date: formatDate(d.date),
    rawDate: d.date,
    balance: Number(d.closing_balance),
    interest: Number(d.daily_interest),
  }));

  const monthlyChartData = (calcResult?.monthly_summary || []).map((m) => ({
    name: m.month_name.split(' ')[0],
    deposits: Number(m.total_deposits),
    withdrawals: Number(m.total_withdrawals),
    interest: Number(m.interest_earned),
    closing: Number(m.closing_balance),
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner with Quick Actions */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/60 border border-sky-800/40 backdrop-blur-md shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Daily Closing Balance Method (RBI Standard)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Savings Interest Intelligence
            </h1>
            <p className="text-slate-300 text-sm mt-1.5 max-w-xl leading-relaxed">
              Account balance is derived dynamically for every calendar day based on value dates. Interest accrues daily and posts quarterly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && <button
              onClick={onOpenAddTx}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-glow transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Record Transaction</span>
            </button>}
            <button
              onClick={onNavigateToCalculator}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-white font-semibold text-xs border border-slate-700 transition-all"
            >
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>Daily Breakdown</span>
            </button>
            <button
              onClick={fetchDashboardData}
              className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Current Balance"
          value={formatCurrency(summary?.current_balance, account.currency)}
          subtitle={`Account: ${account.account_number}`}
          icon={Wallet}
          variant="blue"
        />
        <StatCard
          title="Average Daily Balance (ADB)"
          value={formatCurrency(summary?.average_daily_balance, account.currency)}
          subtitle="Year-to-date daily product"
          icon={TrendingUp}
          variant="purple"
        />
        <StatCard
          title="Interest Earned (Accrued)"
          value={formatCurrency(summary?.accrued_interest_ytd, account.currency)}
          subtitle="Sum of daily interest"
          icon={PiggyBank}
          variant="emerald"
          badge={{ text: 'Accrued', positive: true }}
        />
        <StatCard
          title="Interest Credited"
          value={formatCurrency(summary?.total_interest_credited, account.currency)}
          subtitle="Posted quarterly to balance"
          icon={Coins}
          variant="amber"
        />
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">Opening Balance</div>
            <div className="text-lg font-bold text-white font-mono mt-1">
              {formatCurrency(summary?.opening_balance, account.currency)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-400">
            <Wallet className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">Total Deposits</div>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
              +{formatCurrency(summary?.total_deposits, account.currency)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">Total Withdrawals</div>
            <div className="text-lg font-bold text-rose-400 font-mono mt-1">
              -{formatCurrency(summary?.total_withdrawals, account.currency)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balance Trend Area Chart */}
        <div className="rounded-3xl p-6 bg-slate-900/70 border border-slate-800 backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Daily Balance Trend</h3>
              <p className="text-xs text-slate-400">Dynamic closing balance derived from value dates</p>
            </div>
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {account.currency}
            </span>
          </div>

          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} minTickGap={30} />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    formatter={(val) => [formatCurrency(val, account.currency), 'Closing Balance']}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#balanceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No balance trend data available for current year.
              </div>
            )}
          </div>
        </div>

        {/* Deposits vs Withdrawals & Interest Chart */}
        <div className="rounded-3xl p-6 bg-slate-900/70 border border-slate-800 backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Monthly Inflows & Outflows</h3>
              <p className="text-xs text-slate-400">Deposits vs Withdrawals vs Interest Earned</p>
            </div>
            <button
              onClick={onNavigateToQuarterly}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
            >
              Post Quarter →
            </button>
          </div>

          <div className="h-64 w-full">
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    formatter={(val, name) => [formatCurrency(val, account.currency), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="deposits" name="Deposits" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="withdrawals" name="Withdrawals" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="interest" name="Interest" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No monthly data available yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Summary Table */}
      {calcResult && calcResult.monthly_summary.length > 0 && (
        <div className="rounded-3xl p-6 bg-slate-900/70 border border-slate-800 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Monthly Summary Breakdown</h3>
              <p className="text-xs text-slate-400">Statement summary showing daily product interest per calendar month</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 uppercase font-semibold text-slate-400 text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4 text-right">Opening</th>
                  <th className="py-3 px-4 text-right text-emerald-400">Deposits</th>
                  <th className="py-3 px-4 text-right text-rose-400">Withdrawals</th>
                  <th className="py-3 px-4 text-right">Closing</th>
                  <th className="py-3 px-4 text-right text-amber-400">Interest Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {calcResult.monthly_summary.map((m) => (
                  <tr key={m.month} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-sans font-medium text-white">{m.month_name}</td>
                    <td className="py-3.5 px-4 text-right">{formatCurrency(m.opening_balance, account.currency)}</td>
                    <td className="py-3.5 px-4 text-right text-emerald-400">+{formatCurrency(m.total_deposits, account.currency)}</td>
                    <td className="py-3.5 px-4 text-right text-rose-400">-{formatCurrency(m.total_withdrawals, account.currency)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-white">{formatCurrency(m.closing_balance, account.currency)}</td>
                    <td className="py-3.5 px-4 text-right text-amber-400 font-bold">+{formatCurrency(m.interest_earned, account.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Transactions List */}
      <div className="rounded-3xl p-6 bg-slate-900/70 border border-slate-800 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Recent Transactions</h3>
            <p className="text-xs text-slate-400">Showing latest entries with value date impacts</p>
          </div>
          <button
            onClick={() => onNavigateToCalculator()}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
          >
            View All →
          </button>
        </div>

        <div className="divide-y divide-slate-800/60">
          {recentTransactions.map((tx) => {
            const isCredit = ['OPENING_BALANCE', 'DEPOSIT', 'INTEREST_CREDIT'].includes(tx.transaction_type);
            return (
              <div key={tx.id} className="py-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isCredit
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isCredit ? '+' : '-'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {tx.description || tx.transaction_type.replace('_', ' ')}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-0.5">
                      <span>Value: {formatDate(tx.value_date)}</span>
                      <span>•</span>
                      <span>Booked: {formatDate(tx.transaction_date)}</span>
                      {tx.reference && <span>• Ref: {tx.reference}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className={`text-xs font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isCredit ? '+' : '-'}{formatCurrency(tx.amount, account.currency)}
                  </div>
                  {tx.running_balance !== undefined && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Bal: {formatCurrency(tx.running_balance, account.currency)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
