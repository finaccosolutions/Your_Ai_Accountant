import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Building, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Bank } from '../lib/types';

export default function DailySummary() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [expandedBank, setExpandedBank] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [transactionsResult, banksResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, bank:banks(*), category:categories(*)')
          .eq('user_id', user!.id)
          .eq('is_approved', true)
          .eq('transaction_date', selectedDate)
          .order('created_at', { ascending: false }),
        supabase.from('banks').select('*').eq('user_id', user!.id).eq('is_active', true),
      ]);

      if (transactionsResult.data) setTransactions(transactionsResult.data);
      if (banksResult.data) setBanks(banksResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupByBank = () => {
    const grouped: Record<string, Transaction[]> = {};

    transactions.forEach((t) => {
      const bankKey = t.bank_id || 'cash';
      if (!grouped[bankKey]) {
        grouped[bankKey] = [];
      }
      grouped[bankKey].push(t);
    });

    return grouped;
  };

  const calculateBankStats = (bankTransactions: Transaction[]) => {
    const income = bankTransactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = bankTransactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expenses, net: income - expenses };
  };

  const groupedTransactions = groupByBank();

  const totalIncome = transactions
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalNet = totalIncome - totalExpenses;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Daily Summary</h2>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-gray-900 font-medium"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Income</span>
          </div>
          <p className="text-lg font-bold text-gray-900">₹{totalIncome.toLocaleString()}</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-medium">Expenses</span>
          </div>
          <p className="text-lg font-bold text-gray-900">₹{totalExpenses.toLocaleString()}</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Building className="w-4 h-4" />
            <span className="text-xs font-medium">Net</span>
          </div>
          <p className={`text-lg font-bold ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{totalNet.toLocaleString()}
          </p>
        </div>
      </div>

      {Object.keys(groupedTransactions).length === 0 ? (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-8 text-center shadow-lg">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Transactions</h3>
          <p className="text-gray-600">No transactions found for this date</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTransactions).map(([bankKey, bankTransactions]) => {
            const bank = banks.find((b) => b.id === bankKey);
            const stats = calculateBankStats(bankTransactions);
            const isExpanded = expandedBank === bankKey;

            return (
              <div key={bankKey} className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden">
                <button
                  onClick={() => setExpandedBank(isExpanded ? null : bankKey)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                      <Building className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-gray-900">
                        {bank ? `${bank.bank_name} (${bank.account_number})` : 'Cash Transactions'}
                      </h3>
                      <p className="text-sm text-gray-600">{bankTransactions.length} transactions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`font-bold ${stats.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{stats.net.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Net</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200">
                    <div className="p-4 bg-gray-50 grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Income</p>
                        <p className="font-bold text-green-600">₹{stats.income.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Expenses</p>
                        <p className="font-bold text-red-600">₹{stats.expenses.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Net</p>
                        <p className={`font-bold ${stats.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{stats.net.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      {bankTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-3 bg-white rounded-xl"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {transaction.final_description ||
                                transaction.ai_description ||
                                transaction.original_description}
                            </p>
                            {transaction.category && (
                              <p className="text-xs text-gray-500">{transaction.category.name}</p>
                            )}
                          </div>
                          <div
                            className={`font-bold ml-3 ${
                              transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.type === 'credit' ? '+' : '-'}₹
                            {transaction.amount.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
