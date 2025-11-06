import { useState, useEffect } from 'react';
import { Check, X, Edit2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Category } from '../lib/types';

interface TransactionApprovalProps {
  onComplete: () => void;
}

export default function TransactionApproval({ onComplete }: TransactionApprovalProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [editedCategory, setEditedCategory] = useState('');

  useEffect(() => {
    if (user) {
      loadPendingTransactions();
    }
  }, [user]);

  const loadPendingTransactions = async () => {
    try {
      const [transactionsResult, categoriesResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, category:categories(*)')
          .eq('user_id', user!.id)
          .eq('is_approved', false)
          .order('transaction_date', { ascending: false }),
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`),
      ]);

      if (transactionsResult.data) setTransactions(transactionsResult.data);
      if (categoriesResult.data) setCategories(categoriesResult.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentTransaction = transactions[currentIndex];

  useEffect(() => {
    if (currentTransaction) {
      setEditedDescription(
        currentTransaction.ai_description || currentTransaction.original_description || ''
      );
      setEditedCategory(
        currentTransaction.ai_category_suggestion || currentTransaction.category_id || ''
      );
    }
  }, [currentTransaction]);

  const handleApprove = async () => {
    if (!currentTransaction) return;

    try {
      await supabase
        .from('transactions')
        .update({
          final_description: editedDescription,
          category_id: editedCategory,
          is_approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', currentTransaction.id);

      const pattern = await supabase
        .from('ai_learning_patterns')
        .select('*')
        .eq('user_id', user!.id)
        .eq('original_description', currentTransaction.original_description)
        .maybeSingle();

      if (pattern.data) {
        await supabase
          .from('ai_learning_patterns')
          .update({
            usage_count: pattern.data.usage_count + 1,
            last_used_at: new Date().toISOString(),
            category_id: editedCategory,
          })
          .eq('id', pattern.data.id);
      } else {
        await supabase.from('ai_learning_patterns').insert({
          user_id: user!.id,
          original_description: currentTransaction.original_description || editedDescription,
          category_id: editedCategory,
          confidence_score: 0.8,
          usage_count: 1,
        });
      }

      if (currentIndex < transactions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onComplete();
      }

      setIsEditing(false);
    } catch (error) {
      console.error('Error approving transaction:', error);
    }
  };

  const handleReject = async () => {
    if (!currentTransaction) return;

    try {
      await supabase.from('transactions').delete().eq('id', currentTransaction.id);

      if (currentIndex < transactions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onComplete();
      }
    } catch (error) {
      console.error('Error rejecting transaction:', error);
    }
  };

  const handleBulkApprove = async () => {
    if (!currentTransaction) return;

    const similarTransactions = transactions.filter(
      (t) =>
        t.original_description === currentTransaction.original_description &&
        t.amount === currentTransaction.amount &&
        !t.is_approved
    );

    try {
      await Promise.all(
        similarTransactions.map((t) =>
          supabase
            .from('transactions')
            .update({
              final_description: editedDescription,
              category_id: editedCategory,
              is_approved: true,
              approved_at: new Date().toISOString(),
            })
            .eq('id', t.id)
        )
      );

      await supabase.from('ai_learning_patterns').insert({
        user_id: user!.id,
        original_description: currentTransaction.original_description || editedDescription,
        category_id: editedCategory,
        confidence_score: 0.9,
        usage_count: similarTransactions.length,
      });

      onComplete();
    } catch (error) {
      console.error('Error bulk approving:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-8 text-center shadow-lg">
        <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">All Caught Up!</h3>
        <p className="text-gray-600">No pending transactions to review</p>
      </div>
    );
  }

  const relevantCategories = categories.filter(
    (c) => c.type === (currentTransaction.type === 'debit' ? 'expense' : 'income')
  );

  const similarCount = transactions.filter(
    (t) =>
      t.original_description === currentTransaction.original_description &&
      t.amount === currentTransaction.amount &&
      !t.is_approved
  ).length;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Review Transactions</h2>
          <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
            {currentIndex + 1} of {transactions.length}
          </span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="bg-white h-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / transactions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <span
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              currentTransaction.type === 'credit'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {currentTransaction.type === 'credit' ? 'Income' : 'Expense'}
          </span>
          <span className="text-2xl font-bold text-gray-900">
            ₹{currentTransaction.amount.toLocaleString()}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
              {currentTransaction.ai_description && (
                <span className="ml-2 text-purple-600 text-xs flex items-center gap-1 inline-flex">
                  <Sparkles className="w-3 h-3" />
                  AI Enhanced
                </span>
              )}
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            ) : (
              <div className="flex items-center gap-2">
                <p className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                  {editedDescription}
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <Edit2 className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
              {currentTransaction.ai_category_suggestion && (
                <span className="ml-2 text-purple-600 text-xs flex items-center gap-1 inline-flex">
                  <Sparkles className="w-3 h-3" />
                  AI Suggested
                </span>
              )}
            </label>
            <select
              value={editedCategory}
              onChange={(e) => setEditedCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select category</option>
              {relevantCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Original from bank:</p>
            <p className="text-sm text-gray-700">{currentTransaction.original_description}</p>
          </div>

          <div className="text-xs text-gray-500">
            Date: {new Date(currentTransaction.transaction_date).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleReject}
          className="flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          <X className="w-5 h-5" />
          Reject
        </button>
        <button
          onClick={handleApprove}
          disabled={!editedCategory}
          className="flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-5 h-5" />
          Approve
        </button>
      </div>

      {similarCount > 1 && (
        <button
          onClick={handleBulkApprove}
          disabled={!editedCategory}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          Approve All {similarCount} Similar Transactions
        </button>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>
        <button
          onClick={() => setCurrentIndex(Math.min(transactions.length - 1, currentIndex + 1))}
          disabled={currentIndex === transactions.length - 1}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
