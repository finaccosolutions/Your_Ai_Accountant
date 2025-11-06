import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Bank, Category } from '../lib/types';
import { TrendingUp, TrendingDown, Wallet, Calendar, Filter, Plus } from 'lucide-react';

interface DashboardProps {
  onAddCashTransaction: () => void;
}

export default function Dashboard({ onAddCashTransaction }: DashboardProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedBank, dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [banksResult, categoriesResult] = await Promise.all([
        supabase.from('banks').select('*').eq('user_id', user!.id).eq('is_active', true),
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`),
      ]);

      if (banksResult.data) setBanks(banksResult.data);
      if (categoriesResult.data) setCategories(categoriesResult.data);

      let query = supabase
        .from('transactions')
        .select('*, bank:banks(*), category:categories(*)')
        .eq('user_id', user!.id)
        .eq('is_approved', true)
        .order('transaction_date', { ascending: false });

      if (selectedBank !== 'all') {
        query = query.eq('bank_id', selectedBank);
      }

      const now = new Date();
      if (dateRange === 'today') {
        const today = now.toISOString().split('T')[0];
        query = query.gte('transaction_date', today);
      } else if (dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('transaction_date', weekAgo.toISOString().split('T')[0]);
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('transaction_date', monthAgo.toISOString().split('T')[0]);
      }

      const transactionsResult = await query;

      if (transactionsResult.data) {
        setTransactions(transactionsResult.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const categoryExpenses = transactions
    .filter(t => t.type === 'debit' && t.category)
    .reduce((acc, t) => {
      const catName = t.category!.name;
      acc[catName] = (acc[catName] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryExpenses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onAddCashTransaction}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-2xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Cash Transaction
      </button>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Income</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">₹{totalIncome.toLocaleString()}</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <TrendingDown className="w-5 h-5" />
            <span className="text-sm font-medium">Expenses</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">₹{totalExpense.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-6 h-6" />
          <span className="text-sm font-medium opacity-90">Net Balance</span>
        </div>
        <p className="text-4xl font-bold mb-1">₹{balance.toLocaleString()}</p>
        <p className="text-sm opacity-75">
          {dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'This Week' : dateRange === 'month' ? 'This Month' : 'All Time'}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setDateRange('today')}
          className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
            dateRange === 'today'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-white/80 text-gray-700 hover:bg-white'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setDateRange('week')}
          className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
            dateRange === 'week'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-white/80 text-gray-700 hover:bg-white'
          }`}
        >
          Week
        </button>
        <button
          onClick={() => setDateRange('month')}
          className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
            dateRange === 'month'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-white/80 text-gray-700 hover:bg-white'
          }`}
        >
          Month
        </button>
        <button
          onClick={() => setDateRange('all')}
          className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
            dateRange === 'all'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-white/80 text-gray-700 hover:bg-white'
          }`}
        >
          All
        </button>
      </div>

      {banks.length > 0 && (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Filter by Bank</span>
          </div>
          <select
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Banks</option>
            {banks.map(bank => (
              <option key={bank.id} value={bank.id}>
                {bank.bank_name} - {bank.account_number}
              </option>
            ))}
          </select>
        </div>
      )}

      {topCategories.length > 0 && (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
          <h3 className="font-semibold text-gray-900 mb-4">Spending by Category</h3>

          <div className="flex items-center justify-center mb-6">
            <svg viewBox="0 0 200 200" className="w-48 h-48">
              {topCategories.map(([category, amount], index) => {
                const total = topCategories.reduce((sum, [, amt]) => sum + amt, 0);
                const percentage = (amount / total) * 100;
                const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
                const color = colors[index % colors.length];

                let cumulativePercentage = 0;
                for (let i = 0; i < index; i++) {
                  cumulativePercentage += (topCategories[i][1] / total) * 100;
                }

                const startAngle = (cumulativePercentage / 100) * 360;
                const endAngle = ((cumulativePercentage + percentage) / 100) * 360;

                const startRad = (startAngle - 90) * (Math.PI / 180);
                const endRad = (endAngle - 90) * (Math.PI / 180);

                const x1 = 100 + 80 * Math.cos(startRad);
                const y1 = 100 + 80 * Math.sin(startRad);
                const x2 = 100 + 80 * Math.cos(endRad);
                const y2 = 100 + 80 * Math.sin(endRad);

                const largeArc = percentage > 50 ? 1 : 0;

                const pathData = [
                  `M 100 100`,
                  `L ${x1} ${y1}`,
                  `A 80 80 0 ${largeArc} 1 ${x2} ${y2}`,
                  `Z`
                ].join(' ');

                return (
                  <path
                    key={category}
                    d={pathData}
                    fill={color}
                    opacity="0.9"
                  />
                );
              })}
              <circle cx="100" cy="100" r="50" fill="white" />
              <text x="100" y="95" textAnchor="middle" className="text-xs font-bold fill-gray-700">
                Total
              </text>
              <text x="100" y="110" textAnchor="middle" className="text-xs font-semibold fill-gray-900">
                ₹{totalExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </text>
            </svg>
          </div>

          <div className="space-y-2">
            {topCategories.map(([category, amount], index) => {
              const percentage = (amount / totalExpense) * 100;
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500'];
              const color = colors[index % colors.length];

              return (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-3 h-3 rounded-full ${color}`} />
                    <span className="text-sm font-medium text-gray-700">{category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{percentage.toFixed(1)}%</span>
                    <span className="text-sm font-semibold text-gray-900">₹{amount.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 10).map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    transaction.type === 'credit'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {transaction.type === 'credit' ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : (
                      <TrendingDown className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {transaction.final_description || transaction.ai_description || transaction.original_description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(transaction.transaction_date).toLocaleDateString()}</span>
                      {transaction.category && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full">
                          {transaction.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`font-bold ${
                  transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
