/*
  # Add Batch Tracking and Incremental Mapping

  1. Changes
    - Add `batch_id` to transactions table to track which upload batch they belong to
    - Add `mapping_status` field to track if transaction is mapped (has category assigned)
    - Add index for unmapped transactions query performance
    - Update upload_batches to track mapped vs unmapped count

  2. Purpose
    - Enable incremental transaction mapping
    - Save extracted transactions immediately to database
    - Allow users to map transactions over time (not all at once)
    - Track which transactions are from which upload batch
*/

-- Add batch_id to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN batch_id uuid REFERENCES upload_batches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add mapping_status to transactions (unmapped, mapped, approved)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'mapping_status'
  ) THEN
    ALTER TABLE transactions ADD COLUMN mapping_status text DEFAULT 'unmapped' CHECK (mapping_status IN ('unmapped', 'mapped', 'approved'));
  END IF;
END $$;

-- Add unmapped_count to upload_batches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_batches' AND column_name = 'unmapped_count'
  ) THEN
    ALTER TABLE upload_batches ADD COLUMN unmapped_count integer DEFAULT 0;
  END IF;
END $$;

-- Add mapped_count to upload_batches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'upload_batches' AND column_name = 'mapped_count'
  ) THEN
    ALTER TABLE upload_batches ADD COLUMN mapped_count integer DEFAULT 0;
  END IF;
END $$;

-- Create index for unmapped transactions query
CREATE INDEX IF NOT EXISTS idx_transactions_batch_mapping ON transactions(batch_id, mapping_status);
CREATE INDEX IF NOT EXISTS idx_transactions_unmapped ON transactions(user_id, mapping_status) WHERE mapping_status = 'unmapped';

-- Update existing transactions to set mapping_status based on is_approved
UPDATE transactions 
SET mapping_status = CASE 
  WHEN is_approved = true THEN 'approved'
  WHEN category_id IS NOT NULL THEN 'mapped'
  ELSE 'unmapped'
END
WHERE mapping_status = 'unmapped';

-- Update existing upload_batches counts
UPDATE upload_batches ub
SET 
  unmapped_count = (
    SELECT COUNT(*) FROM transactions t 
    WHERE t.batch_id = ub.id AND t.mapping_status = 'unmapped'
  ),
  mapped_count = (
    SELECT COUNT(*) FROM transactions t 
    WHERE t.batch_id = ub.id AND t.mapping_status IN ('mapped', 'approved')
  );
