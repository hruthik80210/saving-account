import { useState } from 'react';
import {
  Wallet,
  Plus,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Building,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/formatters';

export const AccountsPage = ({
  accounts,
  selectedAccount,
  onSelectAccount,
  onRefreshAccounts,
  isCreateModalOpen,
  onCloseCreateModal,
  onOpenCreateModal,
  user,
}) => {
  const { addToast } = useToast();

  const [accountNumber, setAccountNumber] = useState(
    `SB-${Math.floor(1000000000 + Math.random() * 9000000000)}`
  );
  const [accountType, setAccountType] = useState('SAVINGS');
  const [currency, setCurrency] = useState('INR');
  const [initialOpeningBalance, setInitialOpeningBalance] = useState('25000.00');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const newAcc = await api.createAccount({
        account_number: accountNumber,
        account_type: accountType,
        currency,
      });

      // If initial opening balance is provided, record opening balance transaction
      const initAmt = parseFloat(initialOpeningBalance);
      if (!isNaN(initAmt) && initAmt > 0) {
        const today = new Date().toISOString().split('T')[0];
        await api.createTransaction({
          account_id: newAcc.id,
          transaction_date: today,
          value_date: today,
          transaction_type: 'OPENING_BALANCE',
          amount: initAmt,
          description: 'Initial Opening Balance Deposit',
          reference: `OPN-${Math.floor(100000 + Math.random() * 900000)}`,
        });
      }

      addToast('success', 'Account Created', `Savings account ${newAcc.account_number} opened successfully.`);
      onCloseCreateModal();
      onRefreshAccounts();
      onSelectAccount(newAcc);
    } catch (err) {
      addToast('error', 'Creation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Savings Accounts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage personal and business savings accounts with daily closing balance calculation
          </p>
        </div>

        {user?.role === 'ADMIN' && <button
          onClick={onOpenCreateModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Open New Account</span>
        </button>}
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => {
          const isSelected = selectedAccount?.id === acc.id;
          return (
            <div
              key={acc.id}
              onClick={() => onSelectAccount(acc)}
              className={`cursor-pointer group relative overflow-hidden rounded-3xl p-6 border backdrop-blur-md transition-all duration-300 ${
                isSelected
                  ? 'bg-gradient-to-br from-sky-950/60 via-slate-900 to-indigo-950/40 border-sky-500/60 shadow-glow'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-3 rounded-2xl ${
                      isSelected
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{acc.account_type}</h3>
                    <span className="text-[10px] text-slate-400">{acc.currency} • Active</span>
                  </div>
                </div>

                {isSelected ? (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">
                    Click to switch →
                  </span>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Account Number
                </div>
                <div className="text-lg font-mono font-bold text-white tracking-wider mt-0.5">
                  {acc.account_number}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Opened: {formatDate(acc.created_at.split('T')[0])}</span>
                  <span className="text-emerald-400 font-medium">Daily Interest On</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Open Account Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={onCloseCreateModal}
        title="Open New Savings Account"
        subtitle="Create a new savings ledger with daily product interest capability"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Account Number
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Account Type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="SAVINGS">Individual Savings Account</option>
                <option value="SALARY_SAVINGS">Corporate Salary Account</option>
                <option value="PREMIUM_SAVINGS">High-Yield Premium Savings</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="INR">INR (₹ Indian Rupee)</option>
                <option value="USD">USD ($ US Dollar)</option>
                <option value="EUR">EUR (€ Euro)</option>
                <option value="GBP">GBP (£ British Pound)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Initial Opening Balance (Optional)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="25000.00"
              value={initialOpeningBalance}
              onChange={(e) => setInitialOpeningBalance(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Will automatically create an OPENING_BALANCE transaction effective today
            </span>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onCloseCreateModal}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-glow transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Opening...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
