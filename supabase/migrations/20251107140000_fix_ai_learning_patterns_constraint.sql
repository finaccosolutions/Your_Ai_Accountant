/*
  # Fix AI Learning Patterns Unique Constraint

  1. Changes
    - Add unique constraint on (user_id, original_description) combination
    - This allows proper upsert operations with conflict resolution
    - Enables incrementing usage_count when the same pattern is used again

  2. Security
    - No changes to RLS policies (already properly configured)
*/

-- Drop existing constraint if it exists
ALTER TABLE ai_learning_patterns
DROP CONSTRAINT IF EXISTS ai_learning_patterns_user_description_unique;

-- Add unique constraint for proper upsert with conflict resolution
ALTER TABLE ai_learning_patterns
ADD CONSTRAINT ai_learning_patterns_user_description_unique
UNIQUE (user_id, original_description);
