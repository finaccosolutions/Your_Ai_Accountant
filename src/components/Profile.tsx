import { useState, useEffect } from 'react';
import { User, Key, Plus, Trash2, Building, LogOut, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bank } from '../lib/types';

export default function Profile() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [geminiKey, setGeminiKey] = useState('');
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBank, setNewBank] = useState({
    bank_name: '',
    account_number: '',
    account_type: 'savings',
    balance: 0,
  });

  useEffect(() => {
    if (user) {
      loadBanks();
      if (profile?.gemini_api_key) {
        setGeminiKey(profile.gemini_api_key);
      }
    }
  }, [user, profile]);

  const loadBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setBanks(data);
    } catch (error) {
      console.error('Error loading banks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeminiKey = async () => {
    try {
      await updateProfile({ gemini_api_key: geminiKey });
      alert('Gemini API key saved successfully!');
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Failed to save API key');
    }
  };

  const handleAddBank = async () => {
    if (!newBank.bank_name || !newBank.account_number) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase.from('banks').insert({
        user_id: user!.id,
        ...newBank,
      });

      if (error) throw error;

      await loadBanks();
      setShowAddBank(false);
      setNewBank({
        bank_name: '',
        account_number: '',
        account_type: 'savings',
        balance: 0,
      });
    } catch (error) {
      console.error('Error adding bank:', error);
      alert('Failed to add bank account');
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;

    try {
      const { error } = await supabase.from('banks').delete().eq('id', bankId);

      if (error) throw error;
      await loadBanks();
    } catch (error) {
      console.error('Error deleting bank:', error);
      alert('Failed to delete bank account');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{profile?.full_name}</h2>
            <p className="text-sm opacity-90">{profile?.email}</p>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-gray-900">Gemini API Key</h3>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Add your Gemini API key to enable AI-powered features
        </p>
        <div className="space-y-3">
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={handleSaveGeminiKey}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Save API Key
          </button>
        </div>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-3 text-sm text-purple-600 hover:text-purple-700 underline"
        >
          Get your free Gemini API key →
        </a>
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-gray-900">Bank Accounts</h3>
          </div>
          <button
            onClick={() => setShowAddBank(!showAddBank)}
            className="p-2 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {showAddBank && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
            <input
              type="text"
              placeholder="Bank Name (e.g., HDFC Bank)"
              value={newBank.bank_name}
              onChange={(e) => setNewBank({ ...newBank, bank_name: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Account Number (last 4 digits)"
              value={newBank.account_number}
              onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <select
              value={newBank.account_type}
              onChange={(e) => setNewBank({ ...newBank, account_type: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="savings">Savings Account</option>
              <option value="current">Current Account</option>
              <option value="credit_card">Credit Card</option>
            </select>
            <input
              type="number"
              placeholder="Current Balance"
              value={newBank.balance}
              onChange={(e) => setNewBank({ ...newBank, balance: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={handleAddBank}
              className="w-full bg-green-500 text-white py-2 rounded-xl font-medium hover:bg-green-600 transition-colors"
            >
              Add Bank Account
            </button>
          </div>
        )}

        {banks.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No bank accounts added yet</p>
        ) : (
          <div className="space-y-3">
            {banks.map((bank) => (
              <div
                key={bank.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-semibold text-gray-900">{bank.bank_name}</p>
                  <p className="text-sm text-gray-600">
                    {bank.account_type} - {bank.account_number}
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    Balance: ₹{bank.balance.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteBank(bank.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSignOut}
        className="w-full bg-red-500 text-white py-4 rounded-xl font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  );
}
