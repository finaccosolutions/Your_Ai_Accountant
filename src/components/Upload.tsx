import { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bank, Category } from '../lib/types';
import { BankStatementParser } from '../services/bankStatementParser';
import { AIService } from '../services/aiService';

export default function Upload() {
  const { user, profile } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

      if (banksResult.data) {
        setBanks(banksResult.data);
        if (banksResult.data.length > 0) {
          setSelectedBank(banksResult.data[0].id);
        }
      }
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
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedBank) {
      setStatus({ type: 'error', message: 'Please select a bank and file' });
      return;
    }

    if (!profile?.gemini_api_key) {
      setStatus({ type: 'error', message: 'Please add your Gemini API key in Profile settings first' });
      return;
    }

    setUploading(true);
    setStatus(null);

    try {
      const parser = new BankStatementParser();
      let transactions;
      let detectedBank = '';

      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        transactions = parser.parseCSV(text);
        const bankResult = parser.detectBankFromText(text);
        detectedBank = bankResult.bankName;
      } else if (file.name.endsWith('.pdf')) {
        const result = await parser.parsePDF(file);
        transactions = result.transactions;
        detectedBank = result.detectedBank;
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
          bank_id: selectedBank,
          file_name: file.name,
          file_type: file.name.split('.').pop() || 'unknown',
          detected_bank: detectedBank,
          total_transactions: transactions.length,
          status: 'processing',
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const aiService = new AIService(profile.gemini_api_key);

      const { data: learningPatterns } = await supabase
        .from('ai_learning_patterns')
        .select('*')
        .eq('user_id', user!.id);

      const transactionsToInsert = await Promise.all(
        transactions.map(async (t) => {
          try {
            const aiResult = await aiService.categorizeTransaction(
              t.description,
              t.amount,
              t.type,
              categories,
              learningPatterns || []
            );

            return {
              user_id: user!.id,
              bank_id: selectedBank,
              transaction_date: t.date,
              amount: t.amount,
              type: t.type,
              original_description: t.description,
              ai_description: aiResult.description,
              ai_category_suggestion: aiResult.categoryId,
              category_id: aiResult.confidence > 0.7 ? aiResult.categoryId : null,
              is_approved: false,
            };
          } catch (error) {
            console.error('AI categorization failed for transaction:', error);
            return {
              user_id: user!.id,
              bank_id: selectedBank,
              transaction_date: t.date,
              amount: t.amount,
              type: t.type,
              original_description: t.description,
              is_approved: false,
            };
          }
        })
      );

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
        message: `Successfully uploaded ${transactions.length} transactions! Go to Home to review and approve them.`,
      });

      setFile(null);
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

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-2">Upload Bank Statement</h2>
        <p className="text-sm opacity-90">AI will automatically categorize and organize your transactions</p>
      </div>

      {banks.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">No Bank Accounts</h3>
          <p className="text-gray-600 mb-4">Please add a bank account in your Profile first</p>
        </div>
      ) : (
        <>
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Bank Account
            </label>
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>
                  {bank.bank_name} - {bank.account_number}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Statement File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors">
              <input
                type="file"
                accept=".csv,.pdf,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                {file ? (
                  <>
                    <FileText className="w-12 h-12 text-purple-600 mb-3" />
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-12 h-12 text-gray-400 mb-3" />
                    <p className="font-medium text-gray-900">Click to upload</p>
                    <p className="text-sm text-gray-500 mt-1">
                      CSV, PDF, or Excel (max 10MB)
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

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

          <button
            onClick={handleUpload}
            disabled={!file || !selectedBank || uploading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Upload & Process with AI
              </>
            )}
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Upload your bank statement (CSV, PDF, or Excel)</li>
              <li>• AI automatically detects your bank</li>
              <li>• Transactions are extracted and categorized</li>
              <li>• Review and approve on the Home screen</li>
              <li>• AI learns from your choices for better accuracy</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
