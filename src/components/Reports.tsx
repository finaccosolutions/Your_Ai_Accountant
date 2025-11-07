import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, FileText, DollarSign, Calendar, ChevronRight, BarChart3, Grid } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Category } from '../lib/types';

export default function Reports() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [viewMode, setViewMode] = useState<'summary' | 'ledger'>('summary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [categoriesResult] = await Promise.all([
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`),
      ]);

      if (categoriesResult.data) setCategories(categoriesResult.data);

      let query = supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .eq('user_id', user!.id)
        .eq('is_approved', true)
        .order('transaction_date', { ascending: false });

      const now = new Date();
      if (dateRange === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('transaction_date', monthAgo.toISOString().split('T')[0]);
      } else if (dateRange === 'quarter') {
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        query = query.gte('transaction_date', quarterAgo.toISOString().split('T')[0]);
      } else if (dateRange === 'year') {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        query = query.gte('transaction_date', yearAgo.toISOString().split('T')[0]);
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

  const deposits = transactions.filter(t => t.type === 'credit');
  const withdrawals = transactions.filter(t => t.type === 'debit');

  const totalDeposits = deposits.reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = withdrawals.reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalDeposits - totalWithdrawals;

  const categoryBreakdown = categories.map(cat => {
    const categoryTransactions = transactions.filter(t => t.category_id === cat.id);
    const total = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
    return {
      category: cat,
      transactions: categoryTransactions,
      total,
      count: categoryTransactions.length,
    };
  }).filter(item => item.count > 0)
    .sort((a, b) => b.total - a.total);

  const payables = withdrawals.filter(t =>
    t.category?.name?.toLowerCase().includes('payable') ||
    t.final_description?.toLowerCase().includes('payable') ||
    t.notes?.toLowerCase().includes('payable')
  );

  const receivables = deposits.filter(t =>
    t.category?.name?.toLowerCase().includes('receivable') ||
    t.final_description?.toLowerCase().includes('receivable') ||
    t.notes?.toLowerCase().includes('receivable')
  );

  const totalPayables = payables.reduce((sum, t) => sum + t.amount, 0);
  const totalReceivables = receivables.reduce((sum, t) => sum + t.amount, 0);

  const selectedCategoryData = selectedCategory
    ? categoryBreakdown.find(item => item.category.id === selectedCategory)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleDateRangeChange = (range: 'month' | 'quarter' | 'year' | 'all') => {
    setDateRange(range);
    const now = new Date();
    let start = new Date();

    if (range === 'month') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === 'quarter') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (range === 'year') {
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    } else {
      start = new Date('2000-01-01');
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Financial Reports</h2>
              <p className="text-sm opacity-90">Comprehensive view of your finances</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('summary')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'summary'
                  ? 'bg-white/30 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('ledger')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'ledger'
                  ? 'bg-white/30 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['month', 'quarter', 'year', 'all'].map((range) => (
          <button
            key={range}
            onClick={() => handleDateRangeChange(range as any)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              dateRange === range
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            {range === 'month' ? 'Last 30 Days' : range === 'quarter' ? 'Last 90 Days' : range === 'year' ? 'Last Year' : 'All Time'}
          </button>
        ))}
      </div>

      {viewMode === 'ledger' && (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Custom Date Range</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Deposits</span>
          </div>
          <p className="text-lg font-bold text-gray-900">₹{totalDeposits.toLocaleString()}</p>
          <p className="text-xs text-gray-600">{deposits.length} txns</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-medium">Withdrawals</span>
          </div>
          <p className="text-lg font-bold text-gray-900">₹{totalWithdrawals.toLocaleString()}</p>
          <p className="text-xs text-gray-600">{withdrawals.length} txns</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Net</span>
          </div>
          <p className={`text-lg font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{netBalance.toLocaleString()}
          </p>
          <p className="text-xs text-gray-600">Balance</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Payables</span>
          </div>
          <p className="text-xl font-bold text-gray-900">₹{totalPayables.toLocaleString()}</p>
          <p className="text-xs text-gray-600">{payables.length} pending</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Receivables</span>
          </div>
          <p className="text-xl font-bold text-gray-900">₹{totalReceivables.toLocaleString()}</p>
          <p className="text-xs text-gray-600">{receivables.length} pending</p>
        </div>
      </div>

      {viewMode === 'summary' && (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
          <h3 className="font-semibold text-gray-900 mb-4">Category-wise Breakdown</h3>
        {categoryBreakdown.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No transactions in this period</p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map((item) => (
              <div
                key={item.category.id}
                onClick={() => setSelectedCategory(selectedCategory === item.category.id ? null : item.category.id)}
                className="cursor-pointer hover:bg-gray-50 rounded-xl p-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: item.category.color + '20' }}
                    >
                      <span className="text-xl">{item.category.icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.category.name}</p>
                      <p className="text-xs text-gray-600">{item.count} transactions</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className={`font-bold ${item.category.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{item.total.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {((item.total / (item.category.type === 'income' ? totalDeposits : totalWithdrawals)) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                      selectedCategory === item.category.id ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {selectedCategory === item.category.id && selectedCategoryData && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    {selectedCategoryData.transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-2 bg-white rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {transaction.final_description || transaction.ai_description || transaction.original_description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(transaction.transaction_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className={`font-bold text-sm ml-3 ${
                          transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      )}

      {viewMode === 'ledger' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Ledger View - Category Wise Details</h3>

          <div className="grid gap-4">
            {categories.filter(cat => {
              const categoryTxns = transactions.filter(t => t.category_id === cat.id);
              return categoryTxns.length > 0;
            }).map((cat) => {
              const categoryTxns = transactions
                .filter(t => t.category_id === cat.id)
                .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

              const subtotal = categoryTxns.reduce((sum, t) => sum + t.amount, 0);

              return (
                <div key={cat.id} className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: cat.color + '20' }}
                    >
                      <span className="text-xl">{cat.icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{cat.name}</p>
                      <p className="text-sm text-gray-600">{categoryTxns.length} transactions</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${cat.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {cat.type === 'income' ? '+' : '-'}₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-600">
                        Avg: ₹{(subtotal / categoryTxns.length).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {categoryTxns.map((transaction, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {transaction.final_description || transaction.ai_description || transaction.original_description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(transaction.transaction_date).toLocaleDateString()}</span>
                          </div>
                          {transaction.notes && (
                            <p className="text-xs text-gray-600 mt-1">{transaction.notes}</p>
                          )}
                        </div>
                        <div className={`font-bold text-sm ml-3 whitespace-nowrap ${
                          transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {categories.filter(cat => {
              const categoryTxns = transactions.filter(t => t.category_id === cat.id);
              return categoryTxns.length > 0;
            }).length === 0 && (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-8 text-center shadow-lg">
                <p className="text-gray-500">No transactions found in selected date range</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Report Features:</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• Total deposits and withdrawals summary</li>
          <li>• Payables and receivables tracking</li>
          <li>• Category-wise spending breakdown</li>
          <li>• Transaction-wise ledger for each category</li>
          <li>• Percentage contribution of each category</li>
          <li>• Flexible date range filters</li>
        </ul>
      </div>
    </div>
  );
}
