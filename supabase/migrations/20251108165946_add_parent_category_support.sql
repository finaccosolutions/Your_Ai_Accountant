/*
  # Add Parent Category Support for Payables/Receivables

  1. Changes
    - Add parent_category_id column to categories table
    - Add is_payable_receivable flag to identify special categories
    - Create default Payables and Receivables parent categories
    - Add self-referencing foreign key for parent-child relationships

  2. Security
    - Maintain existing RLS policies
    - Parent categories are user-specific
*/

-- Add parent_category_id column to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_category_id uuid REFERENCES categories(id) ON DELETE CASCADE;

-- Add flag to identify payable/receivable categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_payable_receivable boolean DEFAULT false;

-- Create index for faster parent-child queries
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_category_id);

-- Insert system-level Payables and Receivables parent categories
-- These will be parent categories that users can add sub-categories under
INSERT INTO categories (id, name, type, icon, color, is_system, is_payable_receivable, parent_category_id)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Payables', 'expense', '💸', '#F59E0B', true, true, null),
  ('00000000-0000-0000-0000-000000000002', 'Receivables', 'income', '💰', '#10B981', true, true, null)
ON CONFLICT (id) DO NOTHING;