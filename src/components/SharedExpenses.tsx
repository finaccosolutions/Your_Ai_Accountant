import { useState, useEffect } from 'react';
import { Users, Plus, CheckCircle, UserPlus, DollarSign, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SharedTransaction, Transaction, Category } from '../lib/types';

interface SharedExpenseWithDetails extends SharedTransaction {
  transaction?: Transaction;
  participant_email?: string;
  creator_email?: string;
}

export default function SharedExpenses() {
  const { user } = useAuth();
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [formData, setFormData] = useState({
    description: '',
    total_amount: '',
    category_id: '',
    participant_email: '',
    split_method: 'equal' as 'equal' | 'custom',
    my_share: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [categoriesResult, sharedResult] = await Promise.all([
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`),
        supabase
          .from('shared_transactions')
          .select('*, transaction:transactions(*)')
          .or(`creator_id.eq.${user!.id},participant_id.eq.${user!.id}`)
          .order('created_at', { ascending: false }),
      ]);

      if (categoriesResult.data) setCategories(categoriesResult.data);

      if (sharedResult.data) {
        const enriched = await Promise.all(
          sharedResult.data.map(async (st) => {
            const [creatorProfile, participantProfile] = await Promise.all([
              supabase.from('profiles').select('email').eq('id', st.creator_id).maybeSingle(),
              supabase.from('profiles').select('email').eq('id', st.participant_id).maybeSingle(),
            ]);

            return {
              ...st,
              creator_email: creatorProfile.data?.email,
              participant_email: participantProfile.data?.email,
            };
          })
        );

        setSharedExpenses(enriched);
      }
    } catch (error) {
      console.error('Error loading shared expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSharedExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.participant_email || !formData.total_amount || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { data: participantProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.participant_email.toLowerCase().trim())
        .maybeSingle();

      if (!participantProfile) {
        alert('User not found with this email. They need to create an account first.');
        return;
      }

      if (participantProfile.id === user!.id) {
        alert('You cannot split an expense with yourself');
        return;
      }

      const totalAmount = parseFloat(formData.total_amount);
      const myShare =
        formData.split_method === 'equal'
          ? totalAmount / 2
          : parseFloat(formData.my_share);

      const theirShare = totalAmount - myShare;

      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          category_id: formData.category_id || null,
          transaction_date: formData.transaction_date,
          amount: myShare,
          type: 'debit',
          original_description: formData.description,
          final_description: `${formData.description} (Split with ${formData.participant_email})`,
          notes: formData.notes,
          is_approved: true,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      const { error: sharedError } = await supabase.from('shared_transactions').insert({
        transaction_id: transaction.id,
        creator_id: user!.id,
        participant_id: participantProfile.id,
        total_amount: totalAmount,
        split_amount: theirShare,
        is_settled: false,
      });

      if (sharedError) throw sharedError;

      await loadData();
      setShowCreateForm(false);
      setFormData({
        description: '',
        total_amount: '',
        category_id: '',
        participant_email: '',
        split_method: 'equal',
        my_share: '',
        transaction_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } catch (error) {
      console.error('Error creating shared expense:', error);
      alert('Failed to create shared expense');
    }
  };

  const handleSettleExpense = async (sharedExpenseId: string) => {
    try {
      const { error } = await supabase
        .from('shared_transactions')
        .update({
          is_settled: true,
          settled_at: new Date().toISOString(),
        })
        .eq('id', sharedExpenseId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error settling expense:', error);
    }
  };

  const myOwed = sharedExpenses
    .filter((se) => se.creator_id === user!.id && !se.is_settled)
    .reduce((sum, se) => sum + se.split_amount, 0);

  const iOwe = sharedExpenses
    .filter((se) => se.participant_id === user!.id && !se.is_settled)
    .reduce((sum, se) => sum + se.split_amount, 0);

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Split Expenses</h2>
            </div>
            <p className="text-sm opacity-90">Share bills with friends and family</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <UserPlus className="w-5 h-5" />
            <span className="text-sm font-medium">You're Owed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">₹{myOwed.toLocaleString()}</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">You Owe</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">₹{iOwe.toLocaleString()}</p>
        </div>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Split an Expense</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleCreateSharedExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What did you pay for?
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Dinner, Movie tickets, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Split with (Email)
                </label>
                <input
                  type="email"
                  value={formData.participant_email}
                  onChange={(e) => setFormData({ ...formData, participant_email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="friend@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Split Method
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, split_method: 'equal' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      formData.split_method === 'equal'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Split Equally
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, split_method: 'custom' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      formData.split_method === 'custom'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Custom Split
                  </button>
                </div>
              </div>

              {formData.split_method === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Share (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.my_share}
                    onChange={(e) => setFormData({ ...formData, my_share: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                    required={formData.split_method === 'custom'}
                  />
                  {formData.my_share && formData.total_amount && (
                    <p className="text-sm text-gray-600 mt-2">
                      They pay: ₹
                      {(parseFloat(formData.total_amount) - parseFloat(formData.my_share)).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select category</option>
                  {categories
                    .filter((c) => c.type === 'expense')
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Additional details..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all"
              >
                Create Split Expense
              </button>
            </form>
          </div>
        </div>
      )}

      {sharedExpenses.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-8 text-center shadow-lg">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Shared Expenses</h3>
          <p className="text-gray-600">Split your first bill with a friend</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sharedExpenses.map((expense) => {
            const isCreator = expense.creator_id === user!.id;
            const otherEmail = isCreator ? expense.participant_email : expense.creator_email;

            return (
              <div
                key={expense.id}
                className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">
                      {expense.transaction?.final_description ||
                        expense.transaction?.original_description ||
                        'Shared Expense'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {isCreator ? `Split with ${otherEmail}` : `Paid by ${otherEmail}`}
                    </p>
                  </div>
                  {expense.is_settled ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      Settled
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                      Pending
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                    <p className="font-bold text-gray-900">₹{expense.total_amount.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">
                      {isCreator ? 'They Owe You' : 'You Owe'}
                    </p>
                    <p
                      className={`font-bold ${isCreator ? 'text-green-600' : 'text-red-600'}`}
                    >
                      ₹{expense.split_amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {!expense.is_settled && (
                  <button
                    onClick={() => handleSettleExpense(expense.id)}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Mark as Settled
                  </button>
                )}

                <p className="text-xs text-gray-500 mt-3">
                  {new Date(expense.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• Create a split expense and enter friend's email</li>
          <li>• They must have an account on SmartFinance AI</li>
          <li>• Choose equal split or custom amounts</li>
          <li>• Your share is added to your transactions</li>
          <li>• Mark as settled when they pay you back</li>
        </ul>
      </div>
    </div>
  );
}
