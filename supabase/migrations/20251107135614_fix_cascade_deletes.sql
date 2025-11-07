/*
  # Fix Cascade Deletes for Upload Batches

  1. Changes
    - Add ON DELETE CASCADE to transactions.batch_id foreign key
    - This ensures when an upload batch is deleted, all related transactions are automatically deleted
    - Improves data consistency and prevents orphaned records

  2. Security
    - No changes to RLS policies needed
    - Existing security measures remain in place
*/

-- Drop existing foreign key constraint
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_batch_id_fkey;

-- Re-add foreign key with CASCADE delete
ALTER TABLE transactions
ADD CONSTRAINT transactions_batch_id_fkey
FOREIGN KEY (batch_id)
REFERENCES upload_batches(id)
ON DELETE CASCADE;
