import { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Sparkles, Building, Trash2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bank, Category } from '../lib/types';
import { PDFParser } from '../services/pdfParser';
import { AIService } from '../services/aiService';

export default function Upload() {
  const { user, profile } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [detectedBank, setDetectedBank] = useState<{ name: string; accountNumber: string } | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [newBank, setNewBank] = useState({
    bank_name: '',
    account_number: '',
    account_type: 'savings',
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [banksResult, categoriesResult] = await Promise.all([
        supabase.from('banks').select('*').eq('user_id', user!.id).eq('is_active', true),
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`),
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
      if (!['csv', 'pdf', 'xlsx', 'xls'].includes(fileType || '')) {
        setStatus({ type: 'error', message: 'Please upload a CSV, PDF, or Excel file' });
        return;
      }
      setFile(selectedFile);
      setStatus(null);
      setShowConfirmation(false);
      setDetectedBank(null);
    }
  };

  const handleAnalyzeFile = async () => {
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
      } else {
        throw new Error('Unsupported file format');
      }

      if (transactions.length === 0) {
        throw new Error('No transactions found in the file');
      }

      setDetectedBank({
        name: bankInfo.bankName,
        accountNumber: bankInfo.accountNumber,
      });

      setParsedData({ transactions, bankInfo });
      setShowConfirmation(true);
      setStatus({
        type: 'success',
        message: `Found ${transactions.length} transactions from ${bankInfo.bankName}`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to analyze file',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmAndUpload = async () => {
    if (!parsedData || !detectedBank) return;

    setUploading(true);

    try {
      let bankId = banks.find(
        b => b.bank_name === detectedBank.name && b.account_number.includes(detectedBank.accountNumber)
      )?.id;

      if (!bankId) {
        const { data: newBankData, error: bankError } = await supabase
          .from('banks')
          .insert({
            user_id: user!.id,
            bank_name: detectedBank.name,
            account_number: detectedBank.accountNumber,
            account_type: 'savings',
            balance: 0,
          })
          .select()
          .single();

        if (bankError) throw bankError;
        bankId = newBankData.id;
        await loadData();
      }

      const { data: batch, error: batchError } = await supabase
        .from('upload_batches')
        .insert({
          user_id: user!.id,
          bank_id: bankId,
          file_name: file!.name,
          file_type: file!.name.split('.').pop() || 'unknown',
          detected_bank: detectedBank.name,
          total_transactions: parsedData.transactions.length,
          status: 'processing',
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const transactionsToInsert = [];

      for (const t of parsedData.transactions) {
        let aiResult = null;

        if (profile?.gemini_api_key) {
          try {
            const aiService = new AIService(profile.gemini_api_key);
            const { data: learningPatterns } = await supabase
              .from('ai_learning_patterns')
              .select('*')
              .eq('user_id', user!.id);

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
          bank_id: bankId,
          transaction_date: t.date,
          amount: t.amount,
          type: t.type,
          original_description: t.description,
          ai_description: aiResult?.description || null,
          ai_category_suggestion: aiResult?.categoryId || null,
          category_id: aiResult && aiResult.confidence > 0.7 ? aiResult.categoryId : null,
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
        message: `Successfully uploaded ${parsedData.transactions.length} transactions! Go to Home to review them.`,
      });

      setFile(null);
      setShowConfirmation(false);
      setDetectedBank(null);
      setParsedData(null);
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
        balance: 0,
      });

      await loadData();
      setShowBankForm(false);
      setNewBank({ bank_name: '', account_number: '', account_type: 'savings' });
    } catch (error) {
      console.error('Error adding bank:', error);
      alert('Failed to add bank');
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

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-emerald-600 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-2">Upload Bank Statement</h2>
        <p className="text-sm opacity-90">Auto-detect bank and extract transactions</p>
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Your Banks</h3>
          </div>
          <button
            onClick={() => setShowBankForm(!showBankForm)}
            className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {showBankForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
            <input
              type="text"
              placeholder="Bank Name"
              value={newBank.bank_name}
              onChange={(e) => setNewBank({ ...newBank, bank_name: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Account Number (last 4 digits)"
              value={newBank.account_number}
              onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })}
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
            {banks.map((bank) => (
              <div
                key={bank.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div>
                  <p className="font-medium text-gray-900">{bank.bank_name}</p>
                  <p className="text-sm text-gray-600">{bank.account_number}</p>
                </div>
                <button
                  onClick={() => handleDeleteBank(bank.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Statement File
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
          <input
            type="file"
            accept=".csv,.pdf,.xlsx,.xls"
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
                <p className="text-sm text-gray-500 mt-1">CSV or PDF</p>
              </>
            )}
          </label>
        </div>
      </div>

      {file && !showConfirmation && (
        <button
          onClick={handleAnalyzeFile}
          disabled={uploading}
          className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Analyze Statement
            </>
          )}
        </button>
      )}

      {showConfirmation && detectedBank && (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-gray-900 mb-4">Detected Bank Information</h3>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
              <span className="text-gray-700">Bank Name:</span>
              <span className="font-semibold text-gray-900">{detectedBank.name}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
              <span className="text-gray-700">Account:</span>
              <span className="font-semibold text-gray-900">XXXX{detectedBank.accountNumber}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
              <span className="text-gray-700">Transactions:</span>
              <span className="font-semibold text-gray-900">{parsedData?.transactions.length}</span>
            </div>
          </div>
          <button
            onClick={handleConfirmAndUpload}
            disabled={uploading}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Confirm & Upload
              </>
            )}
          </button>
        </div>
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

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Smart Workflow:</h4>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• Upload your bank statement (CSV or PDF)</li>
          <li>• System auto-detects bank name and account number</li>
          <li>• Review detected information before confirming</li>
          <li>• Bank is auto-created if it doesn't exist</li>
          <li>• AI categorizes transactions (if API key provided)</li>
          <li>• Review and approve transactions on Home screen</li>
        </ul>
      </div>
    </div>
  );
}
