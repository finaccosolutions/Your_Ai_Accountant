/*
  # Personal Finance Management App Database Schema

  ## Overview
  Creates a comprehensive database structure for a mobile-first personal finance app
  with AI-powered transaction processing, multi-user support, and automated insights.

  ## New Tables

  ### 1. profiles
  - `id` (uuid, primary key) - Links to auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `phone` (text) - Phone number for notifications
  - `gemini_api_key` (text) - User's personal Gemini API key
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update

  ### 2. banks
  - `id` (uuid, primary key) - Unique bank identifier
  - `user_id` (uuid, foreign key) - Owner of the bank account
  - `bank_name` (text) - Name of the bank
  - `account_number` (text) - Account number (last 4 digits)
  - `account_type` (text) - Savings/Current/Credit Card
  - `balance` (numeric) - Current balance
  - `currency` (text) - Currency code (default: INR)
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Creation timestamp

  ### 3. categories
  - `id` (uuid, primary key) - Category identifier
  - `user_id` (uuid, foreign key) - Owner (null for system categories)
  - `name` (text) - Category name
  - `type` (text) - income/expense
  - `icon` (text) - Icon name from lucide-react
  - `color` (text) - Color code
  - `is_system` (boolean) - System vs user-created
  - `created_at` (timestamptz) - Creation timestamp

  ### 4. transactions
  - `id` (uuid, primary key) - Transaction identifier
  - `user_id` (uuid, foreign key) - Transaction owner
  - `bank_id` (uuid, foreign key) - Associated bank (null for cash)
  - `category_id` (uuid, foreign key) - Transaction category
  - `transaction_date` (date) - Date of transaction
  - `amount` (numeric) - Transaction amount
  - `type` (text) - debit/credit
  - `original_description` (text) - Original from bank statement
  - `ai_description` (text) - AI-enhanced description
  - `final_description` (text) - User-approved description
  - `ai_category_suggestion` (uuid) - AI suggested category
  - `is_approved` (boolean) - User approval status
  - `is_recurring` (boolean) - Recurring transaction flag
  - `tags` (text[]) - Transaction tags
  - `notes` (text) - User notes
  - `created_at` (timestamptz) - Creation timestamp
  - `approved_at` (timestamptz) - Approval timestamp

  ### 5. upload_batches
  - `id` (uuid, primary key) - Batch identifier
  - `user_id` (uuid, foreign key) - Uploader
  - `bank_id` (uuid, foreign key) - Associated bank
  - `file_name` (text) - Original file name
  - `file_type` (text) - PDF/CSV/Excel
  - `detected_bank` (text) - Auto-detected bank name
  - `total_transactions` (integer) - Transaction count
  - `approved_count` (integer) - Approved count
  - `status` (text) - pending/processing/completed
  - `created_at` (timestamptz) - Upload timestamp

  ### 6. shared_transactions
  - `id` (uuid, primary key) - Shared transaction identifier
  - `transaction_id` (uuid, foreign key) - Original transaction
  - `creator_id` (uuid, foreign key) - Creator user
  - `participant_id` (uuid, foreign key) - Other participant
  - `total_amount` (numeric) - Total amount
  - `split_amount` (numeric) - Participant's share
  - `is_settled` (boolean) - Settlement status
  - `settled_at` (timestamptz) - Settlement timestamp
  - `created_at` (timestamptz) - Creation timestamp

  ### 7. reminders
  - `id` (uuid, primary key) - Reminder identifier
  - `user_id` (uuid, foreign key) - Reminder owner
  - `type` (text) - payment_due/collection/budget_alert
  - `title` (text) - Reminder title
  - `description` (text) - Reminder details
  - `amount` (numeric) - Associated amount
  - `due_date` (date) - Due date
  - `is_sent` (boolean) - Sent status
  - `send_via` (text[]) - whatsapp/sms/email
  - `is_recurring` (boolean) - Recurring reminder
  - `recurrence_pattern` (text) - daily/weekly/monthly
  - `created_at` (timestamptz) - Creation timestamp

  ### 8. ai_learning_patterns
  - `id` (uuid, primary key) - Pattern identifier
  - `user_id` (uuid, foreign key) - Pattern owner
  - `original_description` (text) - Transaction description pattern
  - `category_id` (uuid, foreign key) - Learned category
  - `confidence_score` (numeric) - Pattern confidence (0-1)
  - `usage_count` (integer) - Times pattern was used
  - `last_used_at` (timestamptz) - Last usage timestamp
  - `created_at` (timestamptz) - Creation timestamp

  ### 9. financial_insights
  - `id` (uuid, primary key) - Insight identifier
  - `user_id` (uuid, foreign key) - Insight owner
  - `insight_type` (text) - spending_pattern/budget_alert/prediction
  - `title` (text) - Insight title
  - `description` (text) - Detailed insight
  - `severity` (text) - info/warning/critical
  - `data` (jsonb) - Additional insight data
  - `is_read` (boolean) - Read status
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only access their own data
  - Shared transactions visible to both participants
  - System categories visible to all users

  ## Important Notes
  - All monetary amounts stored as numeric for precision
  - Timestamps use timezone-aware types
  - AI suggestions stored separately from user decisions
  - Learning patterns improve categorization accuracy over time
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  gemini_api_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create banks table
CREATE TABLE IF NOT EXISTS banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL DEFAULT 'savings',
  balance numeric(15,2) DEFAULT 0,
  currency text DEFAULT 'INR',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own banks"
  ON banks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own banks"
  ON banks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own banks"
  ON banks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own banks"
  ON banks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  icon text DEFAULT 'circle',
  color text DEFAULT '#6B7280',
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system categories"
  ON categories FOR SELECT
  TO authenticated
  USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_system = false);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_id uuid REFERENCES banks(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  amount numeric(15,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('debit', 'credit')),
  original_description text,
  ai_description text,
  final_description text,
  ai_category_suggestion uuid REFERENCES categories(id),
  is_approved boolean DEFAULT false,
  is_recurring boolean DEFAULT false,
  tags text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create upload_batches table
CREATE TABLE IF NOT EXISTS upload_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_id uuid REFERENCES banks(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  detected_bank text,
  total_transactions integer DEFAULT 0,
  approved_count integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own upload batches"
  ON upload_batches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own upload batches"
  ON upload_batches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own upload batches"
  ON upload_batches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create shared_transactions table
CREATE TABLE IF NOT EXISTS shared_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount numeric(15,2) NOT NULL,
  split_amount numeric(15,2) NOT NULL,
  is_settled boolean DEFAULT false,
  settled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shared_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared transactions they're part of"
  ON shared_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id OR auth.uid() = participant_id);

CREATE POLICY "Users can create shared transactions"
  ON shared_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update shared transactions they're part of"
  ON shared_transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id OR auth.uid() = participant_id)
  WITH CHECK (auth.uid() = creator_id OR auth.uid() = participant_id);

-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payment_due', 'collection', 'budget_alert')),
  title text NOT NULL,
  description text,
  amount numeric(15,2),
  due_date date,
  is_sent boolean DEFAULT false,
  send_via text[] DEFAULT '{}',
  is_recurring boolean DEFAULT false,
  recurrence_pattern text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
  ON reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON reminders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON reminders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
  ON reminders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create ai_learning_patterns table
CREATE TABLE IF NOT EXISTS ai_learning_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  original_description text NOT NULL,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence_score numeric(3,2) DEFAULT 0.5,
  usage_count integer DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_learning_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning patterns"
  ON ai_learning_patterns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning patterns"
  ON ai_learning_patterns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning patterns"
  ON ai_learning_patterns FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create financial_insights table
CREATE TABLE IF NOT EXISTS financial_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type text NOT NULL CHECK (insight_type IN ('spending_pattern', 'budget_alert', 'prediction', 'recommendation')),
  title text NOT NULL,
  description text NOT NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE financial_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON financial_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON financial_insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON financial_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank_id);
CREATE INDEX IF NOT EXISTS idx_transactions_approved ON transactions(user_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_upload_batches_status ON upload_batches(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shared_transactions_participants ON shared_transactions(creator_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_description ON ai_learning_patterns(user_id, original_description);

-- Insert default system categories
INSERT INTO categories (name, type, icon, color, is_system) VALUES
  ('Salary', 'income', 'banknote', '#10B981', true),
  ('Business Income', 'income', 'briefcase', '#059669', true),
  ('Investment Returns', 'income', 'trending-up', '#34D399', true),
  ('Other Income', 'income', 'plus-circle', '#6EE7B7', true),
  ('Food & Dining', 'expense', 'utensils', '#EF4444', true),
  ('Transportation', 'expense', 'car', '#F59E0B', true),
  ('Shopping', 'expense', 'shopping-bag', '#EC4899', true),
  ('Bills & Utilities', 'expense', 'file-text', '#8B5CF6', true),
  ('Healthcare', 'expense', 'heart', '#06B6D4', true),
  ('Entertainment', 'expense', 'film', '#F97316', true),
  ('Education', 'expense', 'book-open', '#3B82F6', true),
  ('Travel', 'expense', 'plane', '#14B8A6', true),
  ('Groceries', 'expense', 'shopping-cart', '#84CC16', true),
  ('Rent', 'expense', 'home', '#6366F1', true),
  ('Insurance', 'expense', 'shield', '#8B5CF6', true),
  ('Investments', 'expense', 'trending-up', '#10B981', true),
  ('Other Expenses', 'expense', 'minus-circle', '#6B7280', true)
ON CONFLICT DO NOTHING;