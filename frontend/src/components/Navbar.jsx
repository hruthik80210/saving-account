import { useState } from 'react';
import { Menu, Wallet, ChevronDown, Plus, User, Check, Sparkles, LogOut } from 'lucide-react';

export const Navbar = ({
  accounts,
  selectedAccount,
  onSelectAccount,
  user,
  onOpenMobileMenu,
  onOpenAddTx,
  onCreateAccount,
  onLogout,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between">
      {/* Left: Mobile hamburger & account selector */}
      <div className="flex items-center space-x-4">
        {user?.role === 'ADMIN' && <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>}

        {/* Account Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-sky-500/50 transition-all text-left group"
          >
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20 transition-colors">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Active Account
              </div>
              <div className="text-xs font-mono font-semibold text-white flex items-center space-x-1.5">
                <span>{selectedAccount ? selectedAccount.account_number : 'No account'}</span>
                <span className="text-[10px] text-sky-400 font-normal">({selectedAccount?.currency || 'INR'})</span>
              </div>
              {user?.role === 'ADMIN' && selectedAccount?.owner_name && <div className="text-[10px] text-slate-400 truncate max-w-40">{selectedAccount.owner_name}</div>}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors ml-1" />
          </button>

          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute left-0 mt-2 w-72 rounded-2xl glass-dropdown p-2 shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Switch Account
                </div>
                <div className="max-h-60 overflow-y-auto py-1 space-y-1">
                  {accounts.map((acc) => {
                    const isSelected = selectedAccount?.id === acc.id;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => {
                          onSelectAccount(acc);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors ${
                          isSelected
                            ? 'bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30'
                            : 'text-slate-300 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-mono text-white">{acc.account_number}</span>
                          <span className="text-[10px] text-slate-400">
                            {acc.account_type} • {acc.currency}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-sky-400" />}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-slate-800 mt-1">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onCreateAccount();
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium text-sky-400 hover:bg-sky-500/10 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Open New Savings Account</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right actions: Add Transaction button & User Profile */}
      <div className="flex items-center space-x-3">
        {user?.role === 'ADMIN' && <button
          onClick={onOpenAddTx}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-semibold shadow-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Transaction</span>
        </button>}

        {/* Demo Mode Badge */}
        <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Live Backend</span>
        </div>

        {/* User Pill */}
        <div className="flex items-center space-x-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-white leading-none">
              {user?.full_name || 'Rajesh Sharma'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{user?.role || 'CUSTOMER'}</div>
          </div>
          <button onClick={onLogout} title="Log out" className="p-2 text-slate-400 hover:text-rose-400"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>
    </header>
  );
};
