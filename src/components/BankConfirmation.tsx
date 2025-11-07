import { useState } from 'react';
import { Check, X, Edit2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bank } from '../lib/types';

interface BankConfirmationProps {
  bank: Bank;
  transactionCount: number;
  batchId: string;
  onConfirm: (bankId: string) => void;
  onCancel: () => void;
}

export default function BankConfirmation({
  bank,
  transactionCount,
  batchId,
  onConfirm,
  onCancel,
}: BankConfirmationProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    bank_name: bank.bank_name,
    account_number: bank.account_number,
    account_type: bank.account_type,
    balance: bank.balance,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: updatedBank, error } = await supabase
        .from('banks')
        .update({
          bank_name: editData.bank_name,
          account_number: editData.account_number,
          account_type: editData.account_type,
          balance: editData.balance,
        })
        .eq('id', bank.id)
        .select()
        .single();

      if (error) throw error;

      setIsEditing(false);
      onConfirm(bank.id);
    } catch (error) {
      console.error('Error updating bank:', error);
      alert('Failed to update bank details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-2">Confirm Bank Details</h2>
        <p className="text-sm opacity-90">Review and confirm the bank account details before processing {transactionCount} transactions</p>
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name *</label>
              <input
                type="text"
                value={editData.bank_name}
                onChange={(e) => setEditData({ ...editData, bank_name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Number *</label>
              <input
                type="text"
                value={editData.account_number}
                onChange={(e) => setEditData({ ...editData, account_number: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
              <select
                value={editData.account_type}
                onChange={(e) => setEditData({ ...editData, account_type: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="savings">Savings Account</option>
                <option value="current">Current Account</option>
                <option value="credit_card">Credit Card</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                value={editData.balance}
                onChange={(e) => setEditData({ ...editData, balance: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving || !editData.bank_name || !editData.account_number}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    bank_name: bank.bank_name,
                    account_number: bank.account_number,
                    account_type: bank.account_type,
                    balance: bank.balance,
                  });
                }}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 font-medium">Bank Name</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{bank.bank_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Account Number</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{bank.account_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Account Type</p>
                <p className="text-lg font-bold text-gray-900 mt-1 capitalize">{bank.account_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Opening Balance</p>
                <p className="text-lg font-bold text-gray-900 mt-1">₹{bank.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
              <p className="text-sm text-blue-900">
                <span className="font-bold">{transactionCount}</span> transactions will be imported from this bank account
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={onCancel}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={() => onConfirm(bank.id)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg transform hover:scale-[1.02] transition-all"
              >
                <Check className="w-4 h-4" />
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
