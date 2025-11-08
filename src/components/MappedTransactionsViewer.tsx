import { useState, useEffect } from 'react';
import { X, Calendar, ArrowDownUp, Building, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction } from '../lib/types';

interface MappedTransactionsViewerProps {
  onClose: () => void;
}

export default function MappedTransactionsViewer({ onClose }: MappedTransactionsViewerProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadMappedTransactions();
    }
  }, [user]);

  const loadMappedTransactions = async () => {
    try {
      const [transactionsResult, categoriesResult, banksResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user!.id)
          .eq('mapping_status', 'mapped')
          .eq('is_approved', true)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`),
        supabase.from('banks').select('*').eq('user_id', user!.id),
      ]);

      if (transactionsResult.error) throw transactionsResult.error;

      if (transactionsResult.data) {
        const enrichedTransactions = transactionsResult.data.map((t: any) => {
          const bank = banksResult.data?.find((b: any) => b.id === t.bank_id);
          const category = categoriesResult.data?.find((c: any) => c.id === t.category_id);
          return {
            ...t,
            bank: bank || null,
            category: category || null,
          };
        });
        setTransactions(enrichedTransactions);
      }
    } catch (error) {
      console.error('Error loading mapped transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">Pending Items</h2>
            <p className="text-sm opacity-90">
              {transactions.length} mapped transaction{transactions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-8 text-center shadow-lg">
          <p className="text-gray-600">No mapped transactions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        transaction.type === 'credit'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      <ArrowDownUp className="w-3 h-3 inline mr-1" />
                      {transaction.type === 'credit' ? 'Deposit' : 'Withdrawal'}
                    </span>
                    {transaction.category && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {transaction.category.name}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-lg mb-1">
                    {transaction.final_description ||
                      transaction.ai_description ||
                      transaction.original_description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(transaction.transaction_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    {transaction.bank && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {transaction.bank.bank_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p
                    className={`text-2xl font-bold ${
                      transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {transaction.type === 'credit' ? '+' : '-'}₹
                    {transaction.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-4 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-lg"
      >
        Close
      </button>
    </div>
  );
}
