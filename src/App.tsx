import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Insights from './components/Insights';
import Profile from './components/Profile';
import Reminders from './components/Reminders';
import SharedExpenses from './components/SharedExpenses';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'transactions' | 'shared' | 'insights' | 'reminders' | 'profile'>('home');

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

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <Dashboard />}
      {activeTab === 'transactions' && <Transactions />}
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
