import { useState, useEffect } from 'react';
import {
  Calculator,
  Calendar,
  Sparkles,
  Download,
  Info,
  ChevronRight,
  TrendingUp,
  Wallet,
  Coins,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency, formatDate, formatPercent } from '../utils/formatters';
import { StatCard } from '../components/StatCard';
import { useToast } from '../components/Toast';

export const InterestCalculatorPage = ({ account }) => {
  const { addToast } = useToast();

  // Inputs
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2026-07-31');
  const [dayCountConvention, setDayCountConvention] = useState('ACTUAL_365');
  const [roundingMode, setRoundingMode] = useState('HALF_UP');

  // Calculation output
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDayItem, setSelectedDayItem] = useState(null);

  const runCalculation = async (start = startDate, end = endDate, convention = dayCountConvention) => {
    try {
      setLoading(true);
      const res = await api.calculateInterest({
        account_id: account.id,
        start_date: start,
        end_date: end,
        day_count_convention: convention,
        rounding_mode: roundingMode,
      });
      setResult(res);
      setSelectedDayItem(null);
    } catch (err) {
      addToast('error', 'Calculation Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runCalculation();
  }, [account.id]);

  // Quick Preset Handlers
  const handleApplyPreset = (preset) => {
    const now = new Date();
    const currentYear = now.getFullYear();

    if (preset === 'REQ_21_JULY') {
      setStartDate('2026-07-01');
      setEndDate('2026-07-31');
      runCalculation('2026-07-01', '2026-07-31');
    } else if (preset === 'Q1') {
      setStartDate(`${currentYear}-01-01`);
      setEndDate(`${currentYear}-03-31`);
      runCalculation(`${currentYear}-01-01`, `${currentYear}-03-31`);
    } else if (preset === 'Q2') {
      setStartDate(`${currentYear}-04-01`);
      setEndDate(`${currentYear}-06-30`);
      runCalculation(`${currentYear}-04-01`, `${currentYear}-06-30`);
    } else if (preset === 'Q3') {
      setStartDate(`${currentYear}-07-01`);
      setEndDate(`${currentYear}-09-30`);
      runCalculation(`${currentYear}-07-01`, `${currentYear}-09-30`);
    } else if (preset === 'Q4') {
      setStartDate(`${currentYear}-10-01`);
      setEndDate(`${currentYear}-12-31`);
      runCalculation(`${currentYear}-10-01`, `${currentYear}-12-31`);
    } else if (preset === 'FULL_YEAR') {
      setStartDate(`${currentYear}-01-01`);
      setEndDate(`${currentYear}-12-31`);
      runCalculation(`${currentYear}-01-01`, `${currentYear}-12-31`);
    }
  };

  const handleExportDailyCsv = () => {
    if (!result) return;
    const rows = [
      ['Date', 'Opening Balance', 'Net Transactions', 'Closing Balance', 'Rate %', 'Daily Interest (High Precision)', 'Daily Interest (Paise)'],
      ...result.daily_breakdown.map((d) => [
        d.date,
        d.opening_balance,
        d.transactions_total,
        d.closing_balance,
        d.interest_rate,
        d.daily_interest,
        d.daily_interest_rounded,
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daily_interest_${account.account_number}_${result.period_start}_to_${result.period_end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Interest Calculation Engine</h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect daily product accruals with customizable day-count conventions and slab tiers
        </p>
      </div>

      {/* Control Panel / Presets */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl space-y-6">
        {/* Preset quick buttons */}
        <div>
          <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider mb-2.5">
            Quick Period Presets
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleApplyPreset('REQ_21_JULY')}
              className="px-3.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-medium transition-all"
            >
              July 2026 Sample (Req 21: ₹161.10)
            </button>
            <button
              onClick={() => handleApplyPreset('Q1')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Q1 (Jan–Mar)
            </button>
            <button
              onClick={() => handleApplyPreset('Q2')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Q2 (Apr–Jun)
            </button>
            <button
              onClick={() => handleApplyPreset('Q3')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Q3 (Jul–Sep)
            </button>
            <button
              onClick={() => handleApplyPreset('Q4')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Q4 (Oct–Dec)
            </button>
            <button
              onClick={() => handleApplyPreset('FULL_YEAR')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Full Calendar Year
            </button>
          </div>
        </div>

        {/* Custom Controls Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Day-Count Convention</label>
            <select
              value={dayCountConvention}
              onChange={(e) => setDayCountConvention(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="ACTUAL_365">Actual / 365 (Default Standard)</option>
              <option value="ACTUAL_366">Actual / 366 (366 Denominator)</option>
              <option value="ACTUAL_ACTUAL">Actual / Actual (Leap Year Aware)</option>
            </select>
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={() => runCalculation()}
              disabled={loading}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-glow transition-all active:scale-95 disabled:opacity-50"
            >
              <Calculator className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Computing...' : 'Recalculate'}</span>
            </button>
            {result && (
              <button
                onClick={handleExportDailyCsv}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="Export Daily Table CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards for the period */}
      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in duration-200">
          <StatCard
            title="Total Interest Earned"
            value={formatCurrency(result.total_interest_earned, account.currency)}
            subtitle={`Accrued over ${result.total_days} calendar days`}
            icon={Coins}
            variant="emerald"
            badge={{ text: `${result.day_count_convention}`, positive: true }}
          />
          <StatCard
            title="Average Daily Balance (ADB)"
            value={formatCurrency(result.average_daily_balance, account.currency)}
            subtitle="Sum of closing balances / total days"
            icon={TrendingUp}
            variant="blue"
          />
          <StatCard
            title="Closing Balance"
            value={formatCurrency(result.closing_balance, account.currency)}
            subtitle={`As of ${formatDate(result.period_end)}`}
            icon={Wallet}
            variant="purple"
          />
          <StatCard
            title="Period Inflows / Outflows"
            value={`+${formatCurrency(result.total_deposits, account.currency)}`}
            subtitle={`-${formatCurrency(result.total_withdrawals, account.currency)} withdrawals`}
            icon={Calendar}
            variant="slate"
          />
        </div>
      )}

      {/* Full Daily Calculation Table */}
      {result && (
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Daily Closing Balance & Interest Table</span>
                <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                  {result.total_days} Days
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Formula: Daily Interest = (Daily Closing Balance × Annual Rate) / {result.day_count_convention === 'ACTUAL_366' ? '366' : '365'}
              </p>
            </div>

            <button
              onClick={handleExportDailyCsv}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Daily CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 z-10 bg-slate-950 uppercase font-semibold text-slate-400 text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Opening Balance</th>
                  <th className="py-3.5 px-4 text-right">Transactions</th>
                  <th className="py-3.5 px-4 text-right">Closing Balance</th>
                  <th className="py-3.5 px-4 text-right">Applicable Rate</th>
                  <th className="py-3.5 px-4 text-right text-emerald-400">Daily Interest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {result.daily_breakdown.map((item) => {
                  const hasTx = Number(item.transactions_total) !== 0;
                  return (
                    <tr
                      key={item.date}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        hasTx ? 'bg-sky-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-sans font-medium text-white flex items-center space-x-2">
                        <span>{formatDate(item.date)}</span>
                        {hasTx && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold font-mono">
                            Activity
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {formatCurrency(item.opening_balance, account.currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasTx ? (
                          <span className={Number(item.transactions_total) > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {Number(item.transactions_total) > 0 ? '+' : ''}
                            {formatCurrency(item.transactions_total, account.currency)}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {formatCurrency(item.closing_balance, account.currency)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300 font-semibold">
                        {formatPercent(item.interest_rate)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                        +{formatCurrency(item.daily_interest_rounded, account.currency)}
                        <span className="text-[10px] text-slate-500 ml-1.5 font-normal">
                          ({Number(item.daily_interest).toFixed(4)})
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Aggregate footer */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-mono gap-2">
            <div>
              Total Period Product: {result.total_days} Days | Convention: {result.day_count_convention}
            </div>
            <div className="flex items-center space-x-4">
              <span>
                Average Daily Balance: <strong className="text-white">{formatCurrency(result.average_daily_balance, account.currency)}</strong>
              </span>
              <span>
                Net Interest Earned: <strong className="text-emerald-400 font-bold">{formatCurrency(result.total_interest_earned, account.currency)}</strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
