import { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Sparkles, Building, Trash2, Plus, Edit2, ChevronDown, ChevronUp, Save, X, Wallet, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bank, Category, UploadBatch } from '../lib/types';
import { PDFParser } from '../services/pdfParser';
import { AIService } from '../services/aiService';
import CashTransaction from './CashTransaction';
import TransactionMapperFlow from './TransactionMapperFlow';
import BankConfirmation from './BankConfirmation';
import MappedTransactionsViewer from './MappedTransactionsViewer';

export default function TransactionsNew() {
  const { user, profile } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [showCashTransaction, setShowCashTransaction] = useState(false);
  const [editingBank, setEditingBank] = useState<string | null>(null);
  const [bankListExpanded, setBankListExpanded] = useState(true);
  const [showMapper, setShowMapper] = useState(false);
  const [showMappedTransactions, setShowMappedTransactions] = useState(false);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [mappedCount, setMappedCount] = useState(0);

  const [newBank, setNewBank] = useState({
    bank_name: '',
    account_number: '',
    account_type: 'savings',
    balance: 0,
  });

  const [editBankData, setEditBankData] = useState({
    bank_name: '',
    account_number: '',
    account_type: 'savings',
    balance: 0,
  });
  const [showBankConfirmation, setShowBankConfirmation] = useState(false);
  const [detectedBankName, setDetectedBankName] = useState('');
  const [detectedAccountNumber, setDetectedAccountNumber] = useState('');
  const [transactionCountToConfirm, setTransactionCountToConfirm] = useState(0);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [uploadBatches, setUploadBatches] = useState<UploadBatch[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
      checkUnmappedTransactions();
      loadUploadBatches();
    }
  }, [user]);

  const loadUploadBatches = async () => {
    try {
      const { data } = await supabase
        .from('upload_batches')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (data) setUploadBatches(data);
    } catch (error) {
      console.error('Error loading upload batches:', error);
    }
  };

  const checkUnmappedTransactions = async () => {
    try {
      const [unmappedResult, mappedResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .eq('mapping_status', 'unmapped')
          .not('bank_id', 'is', null),
        supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .eq('mapping_status', 'mapped')
          .eq('is_approved', true)
      ]);

      setUnmappedCount(unmappedResult.count || 0);
      setMappedCount(mappedResult.count || 0);
    } catch (error) {
      console.error('Error checking transactions:', error);
    }
  };

  const loadData = async () => {
    try {
      const [banksResult, categoriesResult] = await Promise.all([
        supabase.from('banks').select('*').eq('user_id', user!.id).eq('is_active', true),
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`).order('name'),
      ]);

      if (banksResult.data) setBanks(banksResult.data);
      if (categoriesResult.data) setCategories(categoriesResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'pdf', 'xlsx', 'xls', 'txt'].includes(fileType || '')) {
        setStatus({ type: 'error', message: 'Please upload a CSV, PDF, Excel or Text file' });
        return;
      }
      setFile(selectedFile);
      setStatus(null);
    }
  };

  const handleAnalyzeAndSave = async () => {
    if (!file) {
      setStatus({ type: 'error', message: 'Please select a file first' });
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const parser = new PDFParser();
      let transactions;
      let bankInfo;
      let text = '';

      if (file.name.endsWith('.csv')) {
        text = await file.text();
        transactions = parser.parseCSV(text);
        bankInfo = parser.detectBankFromText(text);
      } else if (file.name.endsWith('.pdf')) {
        text = await parser.extractTextFromPDF(file);
        bankInfo = parser.detectBankFromText(text);
        transactions = parser.parseTransactions(text);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        transactions = await parser.parseExcel(file);
        const arrayBuffer = await file.arrayBuffer();
        const textDecoder = new TextDecoder();
        text = textDecoder.decode(arrayBuffer).substring(0, 5000);
        bankInfo = parser.detectBankFromText(text);
      } else if (file.name.endsWith('.txt')) {
        text = await file.text();
        transactions = parser.parseTransactions(text);
        bankInfo = parser.detectBankFromText(text);
      } else {
        throw new Error('Unsupported file format');
      }

      if (transactions.length === 0) {
        throw new Error('No transactions found in the file');
      }

      const { data: batch, error: batchError } = await supabase
        .from('upload_batches')
        .insert({
          user_id: user!.id,
          bank_id: null,
          file_name: file.name,
          file_type: file.name.split('.').pop() || 'unknown',
          detected_bank: bankInfo.bankName,
          total_transactions: transactions.length,
          status: 'processing',
          unmapped_count: transactions.length,
          mapped_count: 0,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const aiService = profile?.gemini_api_key ? new AIService(profile.gemini_api_key) : null;
      const { data: learningPatterns } = profile?.gemini_api_key ? await supabase
        .from('ai_learning_patterns')
        .select('*')
        .eq('user_id', user!.id) : { data: [] };

      const transactionsToInsert = [];

      for (const t of transactions) {
        let aiResult = null;

        if (aiService) {
          try {
            aiResult = await aiService.categorizeTransaction(
              t.description,
              t.amount,
              t.type,
              categories,
              learningPatterns || []
            );
          } catch (error) {
            console.log('AI categorization skipped for transaction');
          }
        }

        transactionsToInsert.push({
          user_id: user!.id,
          bank_id: null,
          batch_id: batch.id,
          transaction_date: t.date,
          amount: t.amount,
          type: t.type,
          original_description: t.description,
          ai_description: aiResult?.description || null,
          ai_category_suggestion: aiResult?.categoryId || null,
          category_id: null,
          mapping_status: 'unmapped',
          is_approved: false,
        });
      }

      const { error: transactionsError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert);

      if (transactionsError) throw transactionsError;

      await supabase
        .from('upload_batches')
        .update({ status: 'completed' })
        .eq('id', batch.id);

      setStatus({
        type: 'success',
        message: `Successfully extracted ${transactions.length} transactions! Confirming bank details...`,
      });

      setFile(null);
      await loadUploadBatches();

      setDetectedBankName(bankInfo.bankName);
      setDetectedAccountNumber(bankInfo.accountNumber);
      setTransactionCountToConfirm(transactions.length);
      setCurrentBatchId(batch.id);
      setShowBankConfirmation(true);
    } catch (error) {
      console.error('Upload error:', error);
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAddBank = async () => {
    if (!newBank.bank_name || !newBank.account_number) {
      alert('Please fill in bank name and account number');
      return;
    }

    try {
      await supabase.from('banks').insert({
        user_id: user!.id,
        ...newBank,
      });

      await loadData();
      setShowBankForm(false);
      setNewBank({ bank_name: '', account_number: '', account_type: 'savings', balance: 0 });
    } catch (error) {
      console.error('Error adding bank:', error);
      alert('Failed to add bank');
    }
  };

  const handleUpdateBank = async (bankId: string) => {
    try {
      await supabase
        .from('banks')
        .update({
          bank_name: editBankData.bank_name,
          account_number: editBankData.account_number,
          account_type: editBankData.account_type,
          balance: editBankData.balance,
        })
        .eq('id', bankId);

      await loadData();
      setEditingBank(null);
    } catch (error) {
      console.error('Error updating bank:', error);
      alert('Failed to update bank');
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!confirm('Delete this bank? Associated transactions will remain.')) return;

    try {
      await supabase.from('banks').delete().eq('id', bankId);
      await loadData();
    } catch (error) {
      console.error('Error deleting bank:', error);
    }
  };

  const startEditingBank = (bank: Bank) => {
    setEditingBank(bank.id);
    setEditBankData({
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      account_type: bank.account_type,
      balance: bank.balance,
    });
  };

  if (showBankConfirmation) {
    return (
      <BankConfirmation
        detectedBankName={detectedBankName}
        detectedAccountNumber={detectedAccountNumber}
        transactionCount={transactionCountToConfirm}
        batchId={currentBatchId || ''}
        onConfirm={async (bankId) => {
          setShowBankConfirmation(false);

          // Wait a moment for database to propagate the bank_id updates
          await new Promise(resolve => setTimeout(resolve, 500));

          // Reload data to ensure we have the latest
          await loadData();
          await checkUnmappedTransactions();

          // Verify transactions have bank_id before showing mapper
          const { count } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('batch_id', currentBatchId || '')
            .not('bank_id', 'is', null);

          if (count && count > 0) {
            setShowMapper(true);
          } else {
            // If still no transactions with bank_id, wait a bit more and try again
            await new Promise(resolve => setTimeout(resolve, 1000));
            await checkUnmappedTransactions();
            setShowMapper(true);
          }
        }}
        onCancel={() => {
          setShowBankConfirmation(false);
          setStatus(null);
          loadData();
          loadUploadBatches();
          checkUnmappedTransactions();
        }}
      />
    );
  }

  if (showMappedTransactions) {
    return (
      <MappedTransactionsViewer
        onClose={() => {
          setShowMappedTransactions(false);
          checkUnmappedTransactions();
        }}
      />
    );
  }

  if (showMapper) {
    return (
      <TransactionMapperFlow
        batchId={currentBatchId || undefined}
        onClose={() => {
          setShowMapper(false);
          setCurrentBatchId(null);
          checkUnmappedTransactions();
          loadUploadBatches();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-2">Transactions</h2>
        <p className="text-sm opacity-90">Upload statements or add cash transactions</p>
      </div>

      {mappedCount > 0 && (
        <div
          onClick={() => setShowMappedTransactions(true)}
          className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-6 text-white shadow-xl cursor-pointer transform hover:scale-[1.02] transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">Pending Items</h3>
              <p className="text-sm opacity-90">
                {mappedCount} transaction{mappedCount !== 1 ? 's' : ''} ready to review
              </p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <List className="w-8 h-8" />
            </div>
          </div>
        </div>
      )}

      {unmappedCount > 0 && (
        <div
          onClick={() => setShowMapper(true)}
          className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-xl cursor-pointer transform hover:scale-[1.02] transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-1">Unaccounted Transactions</h3>
              <p className="text-sm opacity-90">
                {unmappedCount} transaction{unmappedCount !== 1 ? 's' : ''} need{unmappedCount === 1 ? 's' : ''} categorization
              </p>
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <List className="w-8 h-8" />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowCashTransaction(true)}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-2xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
      >
        <Wallet className="w-5 h-5" />
        Add Cash Transaction
      </button>

      {showCashTransaction && (
        <CashTransaction
          onClose={() => setShowCashTransaction(false)}
          onSuccess={() => {
            setShowCashTransaction(false);
            checkUnmappedTransactions();
          }}
        />
      )}

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Your Banks</h3>
          </div>
          <div className="flex items-center gap-2">
            {banks.length > 3 && (
              <button
                onClick={() => setBankListExpanded(!bankListExpanded)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                {bankListExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </button>
            )}
            <button
              onClick={() => setShowBankForm(!showBankForm)}
              className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showBankForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
            <input
              type="text"
              placeholder="Bank Name (e.g., HDFC Bank)"
              value={newBank.bank_name}
              onChange={(e) => setNewBank({ ...newBank, bank_name: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Account Number (last 4 digits or full)"
              value={newBank.account_number}
              onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newBank.account_type}
              onChange={(e) => setNewBank({ ...newBank, account_type: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
            >
              <option value="savings">Savings Account</option>
              <option value="current">Current Account</option>
              <option value="credit_card">Credit Card</option>
            </select>
            <input
              type="number"
              placeholder="Opening Balance"
              value={newBank.balance}
              onChange={(e) => setNewBank({ ...newBank, balance: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddBank}
              className="w-full bg-blue-500 text-white py-2 rounded-xl font-medium hover:bg-blue-600"
            >
              Add Bank
            </button>
          </div>
        )}

        {banks.length === 0 ? (
          <p className="text-gray-500 text-center py-2">Banks will be auto-created from statements</p>
        ) : (
          <div className="space-y-2">
            {(bankListExpanded ? banks : banks.slice(0, 3)).map((bank) => (
              <div key={bank.id} className="p-3 bg-gray-50 rounded-xl">
                {editingBank === bank.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editBankData.bank_name}
                      onChange={(e) => setEditBankData({ ...editBankData, bank_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={editBankData.account_number}
                      onChange={(e) => setEditBankData({ ...editBankData, account_number: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={editBankData.account_type}
                      onChange={(e) => setEditBankData({ ...editBankData, account_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="savings">Savings</option>
                      <option value="current">Current</option>
                      <option value="credit_card">Credit Card</option>
                    </select>
                    <input
                      type="number"
                      value={editBankData.balance}
                      onChange={(e) => setEditBankData({ ...editBankData, balance: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateBank(bank.id)}
                        className="flex-1 bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 flex items-center justify-center gap-1"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingBank(null)}
                        className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-400 flex items-center justify-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{bank.bank_name}</p>
                      <p className="text-sm text-gray-600">{bank.account_type} - {bank.account_number}</p>
                      <p className="text-sm font-semibold text-blue-600 mt-1">
                        Balance: ₹{bank.balance.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditingBank(bank)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBank(bank.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!bankListExpanded && banks.length > 3 && (
              <p className="text-sm text-gray-500 text-center">
                +{banks.length - 3} more banks (click arrow to expand)
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Bank Statement
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
          <input
            type="file"
            accept=".csv,.pdf,.xlsx,.xls,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
            {file ? (
              <>
                <FileText className="w-12 h-12 text-blue-600 mb-3" />
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </>
            ) : (
              <>
                <UploadIcon className="w-12 h-12 text-gray-400 mb-3" />
                <p className="font-medium text-gray-900">Click to upload</p>
                <p className="text-sm text-gray-500 mt-1">PDF, CSV, Excel, or Text</p>
              </>
            )}
          </label>
        </div>
      </div>

      {file && (
        <button
          onClick={handleAnalyzeAndSave}
          disabled={uploading}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Extracting & Saving...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Extract & Save to Database
            </>
          )}
        </button>
      )}

      {status && (
        <div
          className={`rounded-2xl p-4 ${
            status.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {status.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <p className="font-medium">{status.message}</p>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
        <h3 className="font-semibold text-gray-900 mb-4">Upload History & Management</h3>
        {uploadBatches.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No files uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {uploadBatches.map((batch) => (
              <div key={batch.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{batch.file_name}</p>
                  <p className="text-sm text-gray-600">
                    {batch.total_transactions} transactions • {batch.detected_bank}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(batch.created_at).toLocaleDateString()} {new Date(batch.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete this batch and all its ${batch.total_transactions} transactions? This cannot be undone.`)) return;
                    try {
                      await supabase
                        .from('transactions')
                        .delete()
                        .eq('batch_id', batch.id);

                      await supabase
                        .from('upload_batches')
                        .delete()
                        .eq('id', batch.id);

                      await loadUploadBatches();
                      await checkUnmappedTransactions();
                    } catch (error) {
                      console.error('Error deleting batch:', error);
                      alert('Failed to delete batch');
                    }
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Maximum Automation Workflow:</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• Upload bank statement → System extracts & saves all transactions to database</li>
          <li>• AI auto-suggests categories and narrations (if API key provided)</li>
          <li>• Click "Map Transactions" → Review and categorize incrementally</li>
          <li>• Map some now, map rest later → Save and come back anytime</li>
          <li>• Add new categories during mapping if needed</li>
          <li>• All extracted data preserved → No data loss</li>
        </ul>
      </div>
    </div>
  );
}
