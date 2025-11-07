import { useState, useEffect } from 'react';
import { Check, X, Edit2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bank } from '../lib/types';

interface BankConfirmationProps {
  detectedBankName: string;
  detectedAccountNumber: string;
  transactionCount: number;
  batchId: string;
  onConfirm: (bankId: string) => void;
  onCancel: () => void;
}

export default function BankConfirmation({
  detectedBankName,
  detectedAccountNumber,
  transactionCount,
  batchId,
  onConfirm,
  onCancel,
}: BankConfirmationProps) {
  const { user } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('new');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    bank_name: detectedBankName,
    account_number: detectedAccountNumber,
    account_type: 'savings',
    balance: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(true);

  useEffect(() => {
    loadBanks();
  }, [user]);

  const loadBanks = async () => {
    try {
      const { data } = await supabase
        .from('banks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data) {
        setBanks(data);

        const existingMatch = data.find(
          b => b.bank_name.toLowerCase() === detectedBankName.toLowerCase() &&
               b.account_number.includes(detectedAccountNumber)
        );

        if (existingMatch) {
          setSelectedBankId(existingMatch.id);
        }
      }
    } catch (error) {
      console.error('Error loading banks:', error);
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      let bankId: string;

      if (selectedBankId === 'new') {
        const { data: newBank, error } = await supabase
          .from('banks')
          .insert({
            user_id: user!.id,
            bank_name: editData.bank_name,
            account_number: editData.account_number,
            account_type: editData.account_type,
            balance: editData.balance,
          })
          .select()
          .single();

        if (error) throw error;
        bankId = newBank.id;

        await supabase
          .from('upload_batches')
          .update({ bank_id: bankId })
          .eq('id', batchId);

        await supabase
          .from('transactions')
          .update({ bank_id: bankId })
          .eq('batch_id', batchId);
      } else {
        bankId = selectedBankId;

        await supabase
          .from('upload_batches')
          .update({ bank_id: bankId })
          .eq('id', batchId);

        await supabase
          .from('transactions')
          .update({ bank_id: bankId })
          .eq('batch_id', batchId);
      }

      onConfirm(bankId);
    } catch (error) {
      console.error('Error confirming bank:', error);
      alert('Failed to confirm bank details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    try {
      await supabase
        .from('transactions')
        .delete()
        .eq('batch_id', batchId);

      await supabase
        .from('upload_batches')
        .delete()
        .eq('id', batchId);

      onCancel();
    } catch (error) {
      console.error('Error canceling:', error);
      onCancel();
    }
  };

  const selectedBank = selectedBankId !== 'new' ? banks.find(b => b.id === selectedBankId) : null;

  if (loadingBanks) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-2">Confirm Bank Details</h2>
        <p className="text-sm opacity-90">
          Select existing bank or create new one for {transactionCount} transactions
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Bank Account
          </label>
          <select
            value={selectedBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="new">Create New Bank Account</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.bank_name} - {bank.account_number} ({bank.account_type})
              </option>
            ))}
          </select>
        </div>

        {selectedBankId === 'new' ? (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900">New Bank Details</h3>
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
          </div>
        ) : selectedBank ? (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-900 font-medium mb-2">Existing Bank Selected</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-green-700">Bank Name</p>
                  <p className="font-semibold text-green-900">{selectedBank.bank_name}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700">Account Number</p>
                  <p className="font-semibold text-green-900">{selectedBank.account_number}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700">Account Type</p>
                  <p className="font-semibold text-green-900 capitalize">{selectedBank.account_type}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700">Balance</p>
                  <p className="font-semibold text-green-900">₹{selectedBank.balance.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
          <p className="text-sm text-blue-900">
            <span className="font-bold">{transactionCount}</span> transactions will be imported to this bank account
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving || (selectedBankId === 'new' && (!editData.bank_name || !editData.account_number))}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirm & Continue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
