import { useState, useEffect } from 'react';
import {
  CalendarCheck2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Coins,
  ArrowRight,
  TrendingUp,
  History,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { StatCard } from '../components/StatCard';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

export const QuarterlyPostingPage = ({
  account,
  onRefreshAccount,
}) => {
  const { addToast } = useToast();

  const [year, setYear] = useState(2026);
  const [quarter, setQuarter] = useState('Q3');
  const [convention, setConvention] = useState('ACTUAL_365');

  // Preview calculation
  const [previewResult, setPreviewResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Past postings list
  const [postings, setPostings] = useState([]);

  // Confirmation Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [postingInProgress, setPostingInProgress] = useState(false);

  const fetchPostings = async () => {
    try {
      const data = await api.getInterestPostings(account.id);
      setPostings(data);
    } catch {
      // Ignored if empty
    }
  };

  const fetchQuarterPreview = async () => {
    try {
      setLoading(true);
      const res = await api.getQuarterPreview(account.id, year, quarter, convention);
      setPreviewResult(res);
    } catch (err) {
      addToast('error', 'Preview Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuarterPreview();
    fetchPostings();
  }, [account.id, year, quarter, convention]);

  // Check if quarter is already posted
  const isAlreadyPosted = postings.some(
    (p) => p.period_year === year && p.period_quarter.toUpperCase() === quarter
  );

  const handleConfirmPost = async () => {
    if (!previewResult) return;
    try {
      setPostingInProgress(true);
      const res = await api.postQuarterlyInterest({
        account_id: account.id,
        year,
        quarter,
        day_count_convention: convention,
      });

      addToast(
        'success',
        'Interest Posted Successfully',
        `${res.message} Added INTEREST_CREDIT of ${formatCurrency(res.interest_amount, account.currency)}`
      );

      setIsConfirmModalOpen(false);
      fetchPostings();
      fetchQuarterPreview();
      onRefreshAccount();
    } catch (err) {
      addToast('error', 'Posting Failed', err.message);
    } finally {
      setPostingInProgress(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Quarterly Interest Posting</h1>
        <p className="text-xs text-slate-400 mt-1">
          Review quarterly accrued interest and post verified credits to customer account
        </p>
      </div>

      {/* Quarter Selector */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Financial Year</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value={2024}>2024 (Leap Year)</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Calendar Quarter</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="Q1">Q1: January – March</option>
              <option value="Q2">Q2: April – June</option>
              <option value="Q3">Q3: July – September</option>
              <option value="Q4">Q4: October – December</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Day-Count Convention</label>
            <select
              value={convention}
              onChange={(e) => setConvention(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="ACTUAL_365">Actual / 365 (Default)</option>
              <option value="ACTUAL_366">Actual / 366</option>
            </select>
          </div>
        </div>

        {/* Status Alert Banner */}
        {isAlreadyPosted ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-300 text-xs">
            <div className="flex items-center space-x-3">
              <Lock className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <span className="font-bold text-sm block text-white">Quarter Already Posted</span>
                <span>Interest for {quarter} {year} has already been credited to this account. Duplicate posting is strictly blocked.</span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px]">
              POSTED
            </span>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between text-sky-300 text-xs">
            <div className="flex items-center space-x-3">
              <CalendarCheck2 className="w-5 h-5 text-sky-400 flex-shrink-0" />
              <div>
                <span className="font-bold text-sm block text-white">Ready for Quarter Posting</span>
                <span>Review the preview calculation below and click "Post Interest" to credit the account.</span>
              </div>
            </div>
            <button
              onClick={() => setIsConfirmModalOpen(true)}
              disabled={loading || !previewResult || Number(previewResult.total_interest_earned) <= 0}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-glow-emerald transition-all active:scale-95 disabled:opacity-50"
            >
              Post Interest
            </button>
          </div>
        )}
      </div>

      {/* Quarter Preview KPIs */}
      {previewResult && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in duration-200">
          <StatCard
            title={`Interest Earned (${quarter} ${year})`}
            value={formatCurrency(previewResult.total_interest_earned, account.currency)}
            subtitle={`${previewResult.total_days} days in quarter`}
            icon={Coins}
            variant="emerald"
            badge={{ text: isAlreadyPosted ? 'Already Posted' : 'Draft Preview', positive: !isAlreadyPosted }}
          />
          <StatCard
            title="Average Daily Balance (ADB)"
            value={formatCurrency(previewResult.average_daily_balance, account.currency)}
            subtitle="Quarterly ADB"
            icon={TrendingUp}
            variant="blue"
          />
          <StatCard
            title="Quarter Opening Balance"
            value={formatCurrency(previewResult.opening_balance, account.currency)}
            subtitle={`As of ${formatDate(previewResult.period_start)}`}
            icon={Calendar}
            variant="slate"
          />
          <StatCard
            title="Quarter Closing Balance"
            value={formatCurrency(previewResult.closing_balance, account.currency)}
            subtitle={`As of ${formatDate(previewResult.period_end)}`}
            icon={Calendar}
            variant="purple"
          />
        </div>
      )}

      {/* Historical Interest Postings Table */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Interest Posting History</h3>
              <p className="text-xs text-slate-400">Audit log of all interest credits posted to this account</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 uppercase font-semibold text-slate-400 text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4">Posted Date</th>
                <th className="py-3.5 px-4 text-right">Interest Amount</th>
                <th className="py-3.5 px-4">Posting ID</th>
                <th className="py-3.5 px-4">Transaction Ref</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {postings.length > 0 ? (
                postings.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-sans font-bold text-white">
                      {p.period_quarter} {p.period_year}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-sans">
                      {new Date(p.posted_at).toLocaleString('en-GB')}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">
                      +{formatCurrency(p.interest_amount, account.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px] truncate max-w-[120px]">
                      {p.id}
                    </td>
                    <td className="py-3.5 px-4 text-sky-400 text-[11px]">
                      {p.transaction_id}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 font-sans">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Credited</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-sans">
                    No quarterly interest has been posted to this account yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post Interest Confirmation Preview Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Interest Posting"
        subtitle="This action will create an official INTEREST_CREDIT transaction"
      >
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Quarter Period:</span>
              <span className="font-bold text-white font-mono">{quarter} {year}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Account:</span>
              <span className="font-mono text-white">{account.account_number}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Average Daily Balance:</span>
              <span className="font-mono text-white">{formatCurrency(previewResult?.average_daily_balance, account.currency)}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-300">Interest Earned:</span>
              <span className="font-mono font-extrabold text-emerald-400 text-lg">
                +{formatCurrency(previewResult?.total_interest_earned, account.currency)}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-2 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <div>
              <strong>Duplicate Prevention Guarantee:</strong> Once posted, this quarter is locked in the database. Future transactions backdated into this quarter will trigger an audit alert.
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={postingInProgress}
              onClick={handleConfirmPost}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-glow-emerald transition-all active:scale-95 disabled:opacity-50"
            >
              {postingInProgress ? 'Posting Interest...' : 'Confirm & Post'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
