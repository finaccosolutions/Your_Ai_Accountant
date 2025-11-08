export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  gemini_api_key?: string;
  created_at: string;
  updated_at: string;
}

export interface Bank {
  id: string;
  user_id: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id?: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  is_system: boolean;
  parent_category_id?: string;
  is_payable_receivable?: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  bank_id?: string;
  category_id?: string;
  transaction_date: string;
  amount: number;
  type: 'debit' | 'credit';
  original_description?: string;
  ai_description?: string;
  final_description?: string;
  ai_category_suggestion?: string;
  is_approved: boolean;
  is_recurring: boolean;
  tags: string[];
  notes?: string;
  created_at: string;
  approved_at?: string;
  bank?: Bank;
  category?: Category;
}

export interface UploadBatch {
  id: string;
  user_id: string;
  bank_id?: string;
  file_name: string;
  file_type: string;
  detected_bank?: string;
  total_transactions: number;
  approved_count: number;
  status: 'pending' | 'processing' | 'completed';
  created_at: string;
}

export interface SharedTransaction {
  id: string;
  transaction_id: string;
  creator_id: string;
  participant_id: string;
  total_amount: number;
  split_amount: number;
  is_settled: boolean;
  settled_at?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  type: 'payment_due' | 'collection' | 'budget_alert';
  title: string;
  description?: string;
  amount?: number;
  due_date?: string;
  is_sent: boolean;
  send_via: string[];
  is_recurring: boolean;
  recurrence_pattern?: string;
  created_at: string;
}

export interface FinancialInsight {
  id: string;
  user_id: string;
  insight_type: 'spending_pattern' | 'budget_alert' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}
