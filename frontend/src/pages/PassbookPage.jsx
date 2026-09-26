import { useState, useEffect } from 'react';
import {
  BookOpen,
  Download,
  Printer,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useToast } from '../components/Toast';

export const PassbookPage = ({ account, refreshSignal }) => {
  const { addToast } = useToast();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStatement = async () => {
    try {
      setLoading(true);
      const res = await api.getStatement(account.id, startDate || undefined, endDate || undefined);
      setStatement(res);
    } catch (err) {
      addToast('error', 'Failed to generate passbook statement', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [account.id, startDate, endDate, refreshSignal]);

  const handleDownloadCsv = () => {
    const url = api.getStatementCsvDownloadUrl(account.id, startDate || undefined, endDate || undefined);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Passbook Statement</h1>
          <p className="text-xs text-slate-400 mt-1">
            Chronological bank passbook showing booked date, value date, debits, credits, and running balance
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchStatement}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleDownloadCsv}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-glow transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Date Filters (Hidden during print) */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm print:hidden flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
          <Calendar className="w-4 h-4 text-sky-400" />
          <span>Statement Range:</span>
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="Start Date"
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
        />
        <span className="text-slate-500 text-xs">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="End Date"
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
        />
        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Printable Statement Container */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl p-6 sm:p-8 space-y-6 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        {/* Passbook Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 print:border-slate-300 gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-sky-400 print:text-sky-700">
              AgyBank • Savings Deposit Statement
            </div>
            <h2 className="text-2xl font-mono font-extrabold text-white print:text-black mt-1">
              {account.account_number}
            </h2>
            <div className="text-xs text-slate-400 print:text-slate-600 mt-1">
              Currency: <strong>{account.currency}</strong> • Product: Savings Account (DCB)
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400 print:text-slate-600">Generated On</div>
            <div className="text-sm font-medium text-white print:text-black font-mono">
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Statement Summary KPI Cards */}
        {statement && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 print:bg-slate-50 print:border-slate-300">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-500">Opening Balance</div>
              <div className="text-sm sm:text-base font-bold text-white print:text-black font-mono mt-1">
                {formatCurrency(statement.opening_balance, account.currency)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-400 print:text-emerald-700">Total Credits</div>
              <div className="text-sm sm:text-base font-bold text-emerald-400 print:text-emerald-700 font-mono mt-1">
                +{formatCurrency(statement.total_credits, account.currency)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-rose-400 print:text-rose-700">Total Debits</div>
              <div className="text-sm sm:text-base font-bold text-rose-400 print:text-rose-700 font-mono mt-1">
                -{formatCurrency(statement.total_debits, account.currency)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-sky-400 print:text-sky-700">Closing Balance</div>
              <div className="text-sm sm:text-base font-extrabold text-sky-400 print:text-sky-700 font-mono mt-1">
                {formatCurrency(statement.closing_balance, account.currency)}
              </div>
            </div>
          </div>
        )}

        {/* Passbook Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 print:text-black">
            <thead className="bg-slate-950 uppercase font-semibold text-slate-400 print:text-slate-600 print:bg-slate-100 text-[10px] tracking-wider border-y border-slate-800 print:border-slate-300">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Value Date</th>
                <th className="py-3 px-4">Description / Reference</th>
                <th className="py-3 px-4 text-right text-rose-400 print:text-rose-700">Debit (-)</th>
                <th className="py-3 px-4 text-right text-emerald-400 print:text-emerald-700">Credit (+)</th>
                <th className="py-3 px-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 print:divide-slate-200 font-mono">
              {/* Initial Opening balance row */}
              {statement && (
                <tr className="bg-slate-950/40 print:bg-slate-50 italic text-slate-400 print:text-slate-600">
                  <td className="py-3 px-3 font-sans">
                    {statement.period_start ? formatDate(statement.period_start) : '-'}
                  </td>
                  <td className="py-3 px-3 font-sans">-</td>
                  <td className="py-3 px-4 font-sans font-medium">Brought Forward (Opening Balance)</td>
                  <td className="py-3 px-4 text-right">-</td>
                  <td className="py-3 px-4 text-right">-</td>
                  <td className="py-3 px-4 text-right font-bold text-white print:text-black">
                    {formatCurrency(statement.opening_balance, account.currency)}
                  </td>
                </tr>
              )}

              {statement && statement.entries.length > 0 ? (
                statement.entries.map((entry) => (
                  <tr key={entry.transaction_id} className="hover:bg-slate-800/20 print:hover:bg-transparent">
                    <td className="py-3 px-3 font-sans text-slate-400 print:text-slate-700">
                      {formatDate(entry.transaction_date)}
                    </td>
                    <td className="py-3 px-3 font-sans font-semibold text-white print:text-black">
                      {formatDate(entry.value_date)}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-medium text-white print:text-black">{entry.description}</div>
                      {entry.reference && (
                        <div className="text-[10px] text-slate-500 font-mono print:text-slate-600">
                          {entry.reference}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-400 print:text-rose-700 font-bold">
                      {entry.debit !== null && entry.debit !== undefined ? formatCurrency(entry.debit, account.currency) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-400 print:text-emerald-700 font-bold">
                      {entry.credit !== null && entry.credit !== undefined ? formatCurrency(entry.credit, account.currency) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white print:text-black">
                      {formatCurrency(entry.balance, account.currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
                    {loading ? 'Compiling passbook statement...' : 'No statement records found for this period.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
