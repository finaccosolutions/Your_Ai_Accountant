import { useState, useEffect } from 'react';
import { Check, X, ChevronLeft, ChevronRight, Sparkles, Plus, ArrowDownUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, Category } from '../lib/types';

interface TransactionMapperProps {
  onClose: () => void;
}

export default function TransactionMapper({ onClose }: TransactionMapperProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editedDescription, setEditedDescription] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
  });
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadUnmappedTransactions();
    }
  }, [user]);

  const loadUnmappedTransactions = async () => {
    try {
      const [transactionsResult, categoriesResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, category:categories(*), bank:banks(*)')
          .eq('user_id', user!.id)
          .eq('mapping_status', 'unmapped')
          .order('transaction_date', { ascending: false }),
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`).order('name'),
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

  const handleSaveAndNext = async () => {
    if (!currentTransaction || !editedCategory) {
      alert('Please select a category');
      return;
    }

    try {
      await supabase
        .from('transactions')
        .update({
          final_description: editedDescription,
          category_id: editedCategory,
          mapping_status: 'mapped',
          is_approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', currentTransaction.id);

      await supabase.from('ai_learning_patterns').upsert({
        user_id: user!.id,
        original_description: currentTransaction.original_description || editedDescription,
        category_id: editedCategory,
        confidence_score: 0.9,
        usage_count: 1,
      });

      if (currentIndex < transactions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        alert('All transactions mapped!');
        onClose();
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction');
    }
  };

  const handleConfirmAllWithAI = async () => {
    if (!confirm(`This will approve all ${transactions.length} transactions with their AI-suggested values. Continue?`)) {
      return;
    }

    setIsBulkSaving(true);
    try {
      const updates = transactions.map(t => ({
        id: t.id,
        final_description: t.ai_description || t.original_description,
        category_id: t.ai_category_suggestion,
        mapping_status: 'mapped',
        is_approved: true,
        approved_at: new Date().toISOString(),
      }));

      const validUpdates = updates.filter(u => u.category_id);
      const invalidCount = updates.length - validUpdates.length;

      if (invalidCount > 0) {
        alert(`${invalidCount} transactions don't have AI category suggestions and will be skipped. You can map them manually later.`);
      }

      if (validUpdates.length === 0) {
        alert('No transactions have AI category suggestions. Please map them manually.');
        return;
      }

      for (const update of validUpdates) {
        await supabase
          .from('transactions')
          .update({
            final_description: update.final_description,
            category_id: update.category_id,
            mapping_status: update.mapping_status,
            is_approved: update.is_approved,
            approved_at: update.approved_at,
          })
          .eq('id', update.id);
      }

      alert(`Successfully approved ${validUpdates.length} transactions with AI suggestions!`);
      onClose();
    } catch (error) {
      console.error('Error bulk saving:', error);
      alert('Failed to save all transactions');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      alert('Please enter a category name');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: user!.id,
          name: newCategory.name,
          type: newCategory.type,
          icon: 'circle',
          color: newCategory.type === 'income' ? '#10B981' : '#EF4444',
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories([...categories, data]);
      setEditedCategory(data.id);
      setShowAddCategory(false);
      setNewCategory({ name: '', type: 'expense' });
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Failed to add category');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
          <h2 className="text-2xl font-bold">Transaction Mapper</h2>
        </div>
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-8 text-center shadow-lg">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">All Transactions Mapped!</h3>
          <p className="text-gray-600 mb-4">No unmapped transactions found</p>
          <button
            onClick={onClose}
            className="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600"
          >
            Back to Transactions
          </button>
        </div>
      </div>
    );
  }

  const relevantCategories = categories.filter(
    (c) => c.type === (currentTransaction.type === 'debit' ? 'expense' : 'income')
  );

  const transactionType = currentTransaction.type === 'credit' ? 'Deposit' : 'Withdrawal';

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Map Transactions</h2>
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
            <ArrowDownUp className="w-4 h-4 inline mr-1" />
            {transactionType}
          </span>
          <span className="text-2xl font-bold text-gray-900">
            ₹{currentTransaction.amount.toLocaleString()}
          </span>
        </div>

        {currentTransaction.bank && (
          <div className="mb-4 p-3 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-700 font-medium">Bank Account</p>
            <p className="text-sm text-blue-900 font-semibold">
              {currentTransaction.bank.bank_name} - {currentTransaction.bank.account_number}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Narration / Description
              {currentTransaction.ai_description && (
                <span className="ml-2 text-purple-600 text-xs inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Enhanced
                </span>
              )}
            </label>
            <input
              type="text"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter description"
            />
            {currentTransaction.original_description !== editedDescription && (
              <p className="text-xs text-gray-500 mt-1">
                Original: {currentTransaction.original_description}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Category *
                {currentTransaction.ai_category_suggestion && (
                  <span className="ml-2 text-purple-600 text-xs inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Suggested
                  </span>
                )}
              </label>
              <button
                onClick={() => setShowAddCategory(!showAddCategory)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                New Category
              </button>
            </div>

            {showAddCategory && (
              <div className="mb-3 p-3 bg-gray-50 rounded-xl space-y-2">
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Category name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewCategory({ ...newCategory, type: 'expense' })}
                    className={`flex-1 py-2 rounded-lg font-medium ${
                      newCategory.type === 'expense'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    onClick={() => setNewCategory({ ...newCategory, type: 'income' })}
                    className={`flex-1 py-2 rounded-lg font-medium ${
                      newCategory.type === 'income'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Income
                  </button>
                </div>
                <button
                  onClick={handleAddCategory}
                  className="w-full bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600"
                >
                  Add Category
                </button>
              </div>
            )}

            <select
              value={editedCategory}
              onChange={(e) => setEditedCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select category</option>
              {relevantCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} {cat.is_system ? '' : '(Custom)'}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
            <p>Date: {new Date(currentTransaction.transaction_date).toLocaleDateString()}</p>
            <p>Created: {new Date(currentTransaction.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleConfirmAllWithAI}
        disabled={isBulkSaving || !transactions.some(t => t.ai_category_suggestion)}
        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isBulkSaving ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Saving All Transactions...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Confirm All with AI Suggestions ({transactions.filter(t => t.ai_category_suggestion).length}/{transactions.length})
          </>
        )}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleSkip}
          className="flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
          Skip
        </button>
        <button
          onClick={handleSaveAndNext}
          disabled={!editedCategory}
          className="flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-5 h-5" />
          Save & Next
        </button>
      </div>

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
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
      >
        Close (Save Progress)
      </button>

      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
        <h4 className="font-semibold text-green-900 mb-2">Maximum Automation Options:</h4>
        <ul className="space-y-1 text-sm text-green-800">
          <li>• <strong>Confirm All:</strong> Approve all transactions with AI suggestions in one click</li>
          <li>• <strong>Save & Next:</strong> Review and confirm transactions one by one</li>
          <li>• <strong>Skip:</strong> Skip transactions without AI suggestions to map later</li>
          <li>• Your progress is automatically saved</li>
          <li>• AI learns from your choices and improves over time</li>
        </ul>
      </div>
    </div>
  );
}
