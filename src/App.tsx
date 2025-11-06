import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Upload from './components/Upload';
import Insights from './components/Insights';
import Profile from './components/Profile';
import TransactionApproval from './components/TransactionApproval';
import CashTransaction from './components/CashTransaction';
import Reminders from './components/Reminders';
import DailySummary from './components/DailySummary';
import SharedExpenses from './components/SharedExpenses';
import { supabase } from './lib/supabase';
import { CheckCircle2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'daily' | 'upload' | 'shared' | 'insights' | 'reminders' | 'profile'>('home');
  const [showApproval, setShowApproval] = useState(false);
  const [showCashTransaction, setShowCashTransaction] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user) {
      checkPendingTransactions();
    }
  }, [user]);

  const checkPendingTransactions = async () => {
    try {
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_approved', false);

      setPendingCount(count || 0);
    } catch (error) {
      console.error('Error checking pending transactions:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (showApproval) {
    return (
      <Layout activeTab="home" onTabChange={setActiveTab}>
        <TransactionApproval
          onComplete={() => {
            setShowApproval(false);
            checkPendingTransactions();
          }}
        />
      </Layout>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {pendingCount > 0 && activeTab === 'home' && (
        <div className="mb-6">
          <div
            onClick={() => setShowApproval(true)}
            className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-xl cursor-pointer transform hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-1">Review Pending Transactions</h3>
                <p className="text-sm opacity-90">
                  {pendingCount} transaction{pendingCount !== 1 ? 's' : ''} waiting for approval
                </p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'home' && (
        <>
          <Dashboard onAddCashTransaction={() => setShowCashTransaction(true)} />
          {showCashTransaction && (
            <CashTransaction
              onClose={() => setShowCashTransaction(false)}
              onSuccess={() => {
                setShowCashTransaction(false);
                window.location.reload();
              }}
            />
          )}
        </>
      )}
      {activeTab === 'daily' && <DailySummary />}
      {activeTab === 'upload' && <Upload />}
      {activeTab === 'shared' && <SharedExpenses />}
      {activeTab === 'insights' && <Insights />}
      {activeTab === 'reminders' && <Reminders />}
      {activeTab === 'profile' && <Profile />}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
