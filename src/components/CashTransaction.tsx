import { useState, useEffect } from 'react';
import { Wallet, Save, X, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Category } from '../lib/types';
import { AIService } from '../services/aiService';

interface CashTransactionProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CashTransaction({ onClose, onSuccess }: CashTransactionProps) {
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{description: string; amount: number; category_id: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    type: 'debit' as 'debit' | 'credit',
    description: '',
    category_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadCategories();
  }, [user]);

  useEffect(() => {
    if (formData.description.length >= 3) {
      searchSimilarTransactions(formData.description);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [formData.description]);

  const loadCategories = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user!.id},is_system.eq.true`);

      if (data) setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const searchSimilarTransactions = async (searchTerm: string) => {
    try {
      const { data } = await supabase
        .from('transactions')
        .select('final_description, ai_description, original_description, amount, category_id')
        .eq('user_id', user!.id)
        .eq('is_approved', true)
        .eq('type', formData.type)
        .ilike('final_description', `%${searchTerm}%`)
        .limit(5);

      if (data && data.length > 0) {
        const unique = data
          .map(t => ({
            description: t.final_description || t.ai_description || t.original_description || '',
            amount: t.amount,
            category_id: t.category_id || '',
          }))
          .filter((v, i, a) => a.findIndex(t => t.description === v.description) === i)
          .slice(0, 3);

        setSuggestions(unique);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching transactions:', error);
    }
  };

  const applySuggestion = (suggestion: {description: string; amount: number; category_id: string}) => {
    setFormData({
      ...formData,
      description: suggestion.description,
      amount: suggestion.amount.toString(),
      category_id: suggestion.category_id,
    });
    setShowSuggestions(false);
  };

  const handleAISuggest = async () => {
    if (!formData.description || !profile?.gemini_api_key) {
      alert('Please add a description and ensure you have a Gemini API key in your profile');
      return;
    }

    setAiProcessing(true);
    try {
      const aiService = new AIService(profile.gemini_api_key);
      const amount = parseFloat(formData.amount) || 0;

      const { data: learningPatterns } = await supabase
        .from('ai_learning_patterns')
        .select('*')
        .eq('user_id', user!.id);

      const result = await aiService.categorizeTransaction(
        formData.description,
        amount,
        formData.type,
        categories,
        learningPatterns || []
      );

      setFormData({
        ...formData,
        category_id: result.categoryId,
        description: result.description,
      });
    } catch (error) {
      console.error('AI suggestion failed:', error);
    } finally {
      setAiProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || !formData.description || !formData.category_id) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id: user!.id,
        bank_id: null,
        category_id: formData.category_id,
        transaction_date: formData.transaction_date,
        amount: parseFloat(formData.amount),
        type: formData.type,
        original_description: formData.description,
        final_description: formData.description,
        notes: formData.notes,
        is_approved: true,
        approved_at: new Date().toISOString(),
      });

      if (error) throw error;

      await supabase.from('ai_learning_patterns').insert({
        user_id: user!.id,
        original_description: formData.description,
        category_id: formData.category_id,
        confidence_score: 0.9,
        usage_count: 1,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const relevantCategories = categories.filter(
    c => c.type === (formData.type === 'debit' ? 'expense' : 'income')
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Cash Transaction</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'debit' })}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                formData.type === 'debit'
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'credit' })}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                formData.type === 'credit'
                  ? 'bg-green-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Income
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-semibold"
              placeholder="0.00"
              required
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="What was this for?"
                required
              />
              {profile?.gemini_api_key && (
                <button
                  type="button"
                  onClick={handleAISuggest}
                  disabled={aiProcessing || !formData.description}
                  className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiProcessing ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-medium text-gray-600">Similar past transactions:</p>
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => applySuggestion(suggestion)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                  >
                    <p className="text-sm font-medium text-gray-900">{suggestion.description}</p>
                    <p className="text-xs text-gray-600">₹{suggestion.amount.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="">Select category</option>
              {relevantCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <input
              type="date"
              value={formData.transaction_date}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              placeholder="Add any additional notes..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Transaction
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
