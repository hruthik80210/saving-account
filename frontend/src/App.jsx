import { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { api } from './services/api';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { AccountsPage } from './pages/AccountsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { InterestCalculatorPage } from './pages/InterestCalculatorPage';
import { QuarterlyPostingPage } from './pages/QuarterlyPostingPage';
import { PassbookPage } from './pages/PassbookPage';
import { CSVImportPage } from './pages/CSVImportPage';
import { InterestSlabsPage } from './pages/InterestSlabsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { CustomerManagementPage } from './pages/CustomerManagementPage';
import { subscribeToAccountChanges } from './services/realtime';

const AppContent = () => {
  const { addToast } = useToast();

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Accounts
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [syncRevision, setSyncRevision] = useState(0);

  // Modals triggered globally
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);

  const initApp = async () => {
    try {
      setLoadingInitial(true);
      if (!api.getToken()) {
        setLoadingInitial(false);
        return;
      }
      const profile = await api.getProfile();
      setUser(profile);

      // Fetch accounts
      const accs = await api.getAccounts();
      setAccounts(accs);
      if (accs.length > 0) {
        setSelectedAccount(accs[0]);
      }
    } catch (err) {
      api.clearToken();
      setUser(null);
      addToast('error', 'Initialization error', err.message);
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const syncTimer = window.setInterval(async () => {
      try {
        const accs = await api.getAccounts();
        setAccounts(accs);
        setSelectedAccount((current) => current ? accs.find((acc) => acc.id === current.id) || accs[0] || null : accs[0] || null);
        setSyncRevision((revision) => revision + 1);
      } catch {
        // A transient sync failure should not interrupt the active session.
      }
    }, 30000);
    return () => window.clearInterval(syncTimer);
  }, [user]);

  useEffect(() => {
    if (!user || !selectedAccount || !api.getToken()) return undefined;
    return subscribeToAccountChanges({
      accessToken: api.getToken(),
      accountId: selectedAccount.id,
      userId: user.id,
      onChange: () => setSyncRevision((revision) => revision + 1),
    });
  }, [user, selectedAccount]);

  if (!user && !loadingInitial) {
    return <AuthPage onAuthenticated={(authenticatedUser) => { setUser(authenticatedUser); refreshAccounts(); }} />;
  }

  const refreshAccounts = async () => {
    try {
      const accs = await api.getAccounts();
      setAccounts(accs);
      if (selectedAccount) {
        const found = accs.find((a) => a.id === selectedAccount.id);
        if (found) setSelectedAccount(found);
        else setSelectedAccount(accs.length > 0 ? accs[0] : null);
      } else if (accs.length > 0) {
        setSelectedAccount(accs[0]);
      }
    } catch (err) {
      addToast('error', 'Refresh error', err.message);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center animate-pulse shadow-glow">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="text-sm font-semibold text-slate-300">Connecting to Banking Interest Engine...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navbar */}
        <Navbar
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelectAccount={(acc) => setSelectedAccount(acc)}
          user={user}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenAddTx={() => {
            setCurrentTab('transactions');
            setIsAddTxModalOpen(true);
          }}
          onCreateAccount={() => setIsCreateAccountModalOpen(true)}
          onLogout={async () => { await api.logout(); setUser(null); setAccounts([]); setSelectedAccount(null); }}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'customers' && user?.role === 'ADMIN' ? (
            <CustomerManagementPage currentUser={user} />
          ) : selectedAccount ? (
            <>
              {currentTab === 'dashboard' && (
                <DashboardPage
                  account={selectedAccount}
                  onOpenAddTx={() => {
                    setCurrentTab('transactions');
                    setIsAddTxModalOpen(true);
                  }}
                  onNavigateToCalculator={() => setCurrentTab('calculator')}
                  onNavigateToQuarterly={() => setCurrentTab('quarterly')}
                  isAdmin={user?.role === 'ADMIN'}
                  refreshSignal={syncRevision}
                />
              )}

              {currentTab === 'accounts' && (
                <AccountsPage
                  accounts={accounts}
                  selectedAccount={selectedAccount}
                  onSelectAccount={(acc) => setSelectedAccount(acc)}
                  onRefreshAccounts={refreshAccounts}
                  isCreateModalOpen={isCreateAccountModalOpen}
                  onCloseCreateModal={() => setIsCreateAccountModalOpen(false)}
                  onOpenCreateModal={() => setIsCreateAccountModalOpen(true)}
                  user={user}
                />
              )}

              {currentTab === 'transactions' && (
                <TransactionsPage
                  account={selectedAccount}
                  isAddModalOpen={isAddTxModalOpen}
                  onCloseAddModal={() => setIsAddTxModalOpen(false)}
                  onOpenAddModal={() => setIsAddTxModalOpen(true)}
                  isAdmin={user?.role === 'ADMIN'}
                  refreshSignal={syncRevision}
                />
              )}

              {currentTab === 'calculator' && (
                <InterestCalculatorPage account={selectedAccount} />
              )}

              {currentTab === 'quarterly' && (
                <QuarterlyPostingPage
                  account={selectedAccount}
                  onRefreshAccount={refreshAccounts}
                />
              )}

              {currentTab === 'passbook' && (
                <PassbookPage account={selectedAccount} refreshSignal={syncRevision} />
              )}

              {currentTab === 'csv-import' && (
                <CSVImportPage
                  account={selectedAccount}
                  onImportSuccess={() => {
                    refreshAccounts();
                    setCurrentTab('transactions');
                  }}
                />
              )}

              {currentTab === 'slabs' && <InterestSlabsPage />}

              {currentTab === 'settings' && (
                <SettingsPage
                  account={selectedAccount}
                  onRefreshAccounts={refreshAccounts}
                  onDataChanged={refreshAccounts}
                />
              )}
            </>
          ) : (
            <div className="p-12 text-center text-slate-400 space-y-4">
              <p>No account found. Please open a savings account to begin.</p>
                  {user?.role === 'ADMIN' && <button
                onClick={() => {
                  setIsCreateAccountModalOpen(true);
                  setCurrentTab('accounts');
                }}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shadow-glow transition-all"
              >
                Open New Savings Account
                  </button>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
