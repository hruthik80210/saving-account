import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  Clock,
  ArrowUpDown,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

export const TransactionsPage = ({
  account,
  isAddModalOpen,
  onCloseAddModal,
  onOpenAddModal,
}) => {
  const { addToast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Add / Edit Form State
  const [editingTx, setEditingTx] = useState(null);
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    value_date: new Date().toISOString().split('T')[0],
    transaction_type: 'DEPOSIT',
    amount: '',
    description: '',
    reference: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.getTransactions(account.id, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        type: typeFilter,
        search: search || undefined,
        page,
        limit,
      });
      setTransactions(res.data);
      setTotalCount(res.total);
    } catch (err) {
      addToast('error', 'Failed to fetch transactions', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [account.id, page, typeFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const isBackdated = formData.value_date && formData.transaction_date && formData.value_date < formData.transaction_date;

  const handleOpenAdd = () => {
    setEditingTx(null);
    setFormData({
      transaction_date: new Date().toISOString().split('T')[0],
      value_date: new Date().toISOString().split('T')[0],
      transaction_type: 'DEPOSIT',
      amount: '',
      description: '',
      reference: '',
    });
    onOpenAddModal();
  };

  const handleOpenEdit = (tx) => {
    setEditingTx(tx);
    setFormData({
      transaction_date: tx.transaction_date,
      value_date: tx.value_date,
      transaction_type: tx.transaction_type,
      amount: tx.amount.toString(),
      description: tx.description || '',
      reference: tx.reference || '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      addToast('error', 'Invalid amount', 'Amount must be greater than zero.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingTx) {
        await api.updateTransaction(editingTx.id, {
          transaction_date: formData.transaction_date,
          value_date: formData.value_date,
          transaction_type: formData.transaction_type,
          amount: amt,
          description: formData.description,
          reference: formData.reference,
        });
        addToast('success', 'Transaction updated', 'Historical balances and interest recalculated.');
        setEditingTx(null);
      } else {
        await api.createTransaction({
          account_id: account.id,
          transaction_date: formData.transaction_date,
          value_date: formData.value_date,
          transaction_type: formData.transaction_type,
          amount: amt,
          description: formData.description,
          reference: formData.reference,
        });
        addToast('success', 'Transaction recorded', 'Balances and daily interest recalculated.');
        onCloseAddModal();
      }
      fetchTransactions();
    } catch (err) {
      addToast('error', 'Transaction rejected', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tx) => {
    if (!window.confirm(`Delete transaction "${tx.description || tx.reference || tx.id}"? All subsequent balances will be recalculated.`)) {
      return;
    }
    try {
      await api.deleteTransaction(tx.id);
      addToast('success', 'Transaction deleted', 'Subsequent balances recalculated.');
      fetchTransactions();
    } catch (err) {
      addToast('error', 'Cannot delete transaction', err.message);
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Transaction Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manual transaction booking with independent Transaction Date & Value Date logic
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchTransactions}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-glow transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search description, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="OPENING_BALANCE">Opening Balance</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="INTEREST_CREDIT">Interest Credit</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>

          {/* Date range filters */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              placeholder="From Date"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              placeholder="To Date"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
        </form>

        {(search || typeFilter !== 'ALL' || startDate || endDate) && (
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span>Filtered results: {totalCount} transactions found</span>
            <button
              onClick={handleResetFilters}
              className="text-sky-400 hover:text-sky-300 font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 uppercase font-semibold text-slate-400 text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Booking Date</th>
                <th className="py-3.5 px-4">Value Date (Interest Base)</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Description / Reference</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-right">Running Balance</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {transactions.length > 0 ? (
                transactions.map((tx) => {
                  const isCredit = ['OPENING_BALANCE', 'DEPOSIT', 'INTEREST_CREDIT'].includes(tx.transaction_type);
                  const isBack = tx.value_date < tx.transaction_date;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 text-slate-400 font-sans">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-white">{formatDate(tx.value_date)}</span>
                          {isBack && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Value date is earlier than booking date">
                              Backdated
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                            tx.transaction_type === 'OPENING_BALANCE'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : tx.transaction_type === 'DEPOSIT'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : tx.transaction_type === 'WITHDRAWAL'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : tx.transaction_type === 'INTEREST_CREDIT'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {tx.transaction_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <div className="text-white font-medium">{tx.description || '-'}</div>
                        {tx.reference && <div className="text-[10px] text-slate-400 font-mono">{tx.reference}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isCredit ? '+' : '-'}{formatCurrency(tx.amount, account.currency)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">
                        {tx.running_balance !== undefined ? formatCurrency(tx.running_balance, account.currency) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleOpenEdit(tx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                            title="Edit Transaction"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete Transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    {loading ? 'Loading transactions...' : 'No transactions found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page {page} of {totalPages} ({totalCount} total)
            </div>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      <Modal
        isOpen={isAddModalOpen || editingTx !== null}
        onClose={() => {
          onCloseAddModal();
          setEditingTx(null);
        }}
        title={editingTx ? 'Edit Transaction' : 'Record New Transaction'}
        subtitle="Historical balances and daily interest will automatically recalculate from the value date"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Transaction Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Booking Date (Transaction Date)
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="date"
                  required
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Date when entry is initiated</span>
            </div>

            {/* Value Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Value Date (Interest Date)</span>
                <span className="text-[10px] text-sky-400 font-normal">Core Field</span>
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-sky-400" />
                <input
                  type="date"
                  required
                  value={formData.value_date}
                  onChange={(e) => setFormData({ ...formData, value_date: e.target.value })}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-semibold"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Determines when amount affects closing balance & interest
              </span>
            </div>
          </div>

          {/* Backdated Notice */}
          {isBackdated && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-2 text-amber-300 text-xs">
              <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold">Backdated Transaction:</span> Value date ({formatDate(formData.value_date)}) is earlier than booking date. The engine will automatically re-run calculations for all subsequent days.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Transaction Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Transaction Type
              </label>
              <select
                value={formData.transaction_type}
                onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="DEPOSIT">Deposit (+ Credit)</option>
                <option value="WITHDRAWAL">Withdrawal (- Debit)</option>
                <option value="OPENING_BALANCE">Opening Balance (+ Credit)</option>
                <option value="INTEREST_CREDIT">Interest Credit (+ Credit)</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount ({account.currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="50000.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Description / Narration
              </label>
              <input
                type="text"
                placeholder="e.g. Cash Deposit Branch 04"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Reference Number
              </label>
              <input
                type="text"
                placeholder="e.g. DEP-20260705-02"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                onCloseAddModal();
                setEditingTx(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-glow transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Calculating...' : editingTx ? 'Save & Recalculate' : 'Record & Recalculate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
