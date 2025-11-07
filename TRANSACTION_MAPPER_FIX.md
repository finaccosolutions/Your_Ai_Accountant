# Transaction Mapper Fix - "All Transactions Mapped" Issue

## Problem
TransactionMapperFlow was showing "All Transactions Mapped!" immediately after bank confirmation, even when there were unmapped transactions that should be displayed for mapping.

## Root Cause
Database query filters in two components were excluding transactions with `bank_id = null`:

1. **TransactionMapperFlow.tsx** (line 40)
2. **TransactionsNew.tsx** (line 79)

The filter `.not('bank_id', 'is', null)` was preventing newly extracted transactions from being visible because:
- Transactions are initially created with `bank_id = null` during extraction
- `bank_id` only gets assigned AFTER the user confirms the bank in BankConfirmation
- The filter was too restrictive and filtered out these transactions

## Workflow
```
1. Upload PDF → Extract transactions → Save with bank_id = null
2. Show BankConfirmation → User confirms bank
3. Update all transactions in batch with bank_id
4. Show TransactionMapperFlow → Should display all unmapped transactions
```

## Files Fixed

### 1. TransactionMapperFlow.tsx
**Line 40 - Removed problematic filter**

**BEFORE:**
```typescript
let query = supabase
  .from('transactions')
  .select('*, category:categories(*), bank:banks(*)')
  .eq('user_id', user!.id)
  .eq('mapping_status', 'unmapped')
  .not('bank_id', 'is', null)  // ❌ This was filtering out transactions
  .order('transaction_date', { ascending: false });
```

**AFTER:**
```typescript
let query = supabase
  .from('transactions')
  .select('*, category:categories(*), bank:banks(*)')
  .eq('user_id', user!.id)
  .eq('mapping_status', 'unmapped')
  .order('transaction_date', { ascending: false });
```

### 2. TransactionsNew.tsx
**Line 78-79 - Removed problematic filter from checkUnmappedTransactions()**

**BEFORE:**
```typescript
supabase
  .from('transactions')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user!.id)
  .eq('mapping_status', 'unmapped')
  .not('bank_id', 'is', null),  // ❌ This was causing wrong count
```

**AFTER:**
```typescript
supabase
  .from('transactions')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user!.id)
  .eq('mapping_status', 'unmapped'),
```

## Impact
- TransactionMapperFlow now correctly displays unmapped transactions after bank confirmation
- Unmapped transaction count banner shows accurate count
- Users can now map transactions immediately after extraction and bank confirmation
- No more false "All Transactions Mapped!" message

## Testing
1. Upload a bank statement PDF
2. Confirm bank details
3. Verify TransactionMapperFlow opens with transactions to map
4. Verify "Unaccounted Transactions" banner shows correct count

## Build Status
✅ Project builds successfully (330 KB gzipped)
✅ No TypeScript errors
✅ Production ready
