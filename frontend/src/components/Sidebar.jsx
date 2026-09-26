import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Calculator,
  CalendarCheck2,
  BookOpen,
  FileSpreadsheet,
  Sliders,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar = ({ currentTab, onSelectTab, isOpen, onClose }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'accounts', label: 'Accounts', icon: Wallet, badge: null },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight, badge: null },
    { id: 'calculator', label: 'Daily Calculator', icon: Calculator, badge: 'Core' },
    { id: 'quarterly', label: 'Quarterly & Post', icon: CalendarCheck2, badge: 'Posting' },
    { id: 'passbook', label: 'Passbook / PDF', icon: BookOpen, badge: null },
    { id: 'csv-import', label: 'CSV Import', icon: FileSpreadsheet, badge: null },
    { id: 'slabs', label: 'Interest Slabs', icon: Sliders, badge: null },
    { id: 'settings', label: 'Formula & Docs', icon: HelpCircle, badge: null },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80 bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-glow">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-wide flex items-center">
                AgyBank
                <span className="text-sky-400 font-mono text-xs ml-1 font-semibold">DCB</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 tracking-tight">
                Daily Closing Balance
              </span>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Banking Engine
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-[0_0_15px_-3px_rgba(14,165,233,0.2)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                      active
                        ? 'bg-sky-400/20 text-sky-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer info box */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <div className="flex items-center space-x-2 text-emerald-400 font-medium mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Decimal Precision</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Calculations run on Python server with high-precision Decimal arithmetic and Actual/365 convention.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
