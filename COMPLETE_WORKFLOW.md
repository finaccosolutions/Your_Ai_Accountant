# Complete Transaction Workflow & Features

## Overview
This document outlines the complete transaction processing workflow with all new features implemented.

---

## Part 1: File Upload & Bank Confirmation

### Flow:
1. **Upload Bank Statement**
   - User selects PDF, CSV, Excel, or Text file
   - Click "Extract & Save to Database"
   - System automatically extracts all transactions

2. **Bank Details Confirmation**
   - After extraction, user sees bank details form
   - Fields: Bank Name, Account Number, Account Type, Opening Balance
   - User can:
     - ✅ **Edit**: Modify any bank details
     - ✅ **Confirm**: Accept and proceed to transaction mapping
     - ✅ **Cancel**: Discard extraction and try again

3. **Automatic Bank Creation**
   - If bank doesn't exist (checked by bank_name + account_number), creates new
   - If bank already exists, uses existing account
   - No duplicate banks created

---

## Part 2: Transaction Mapping (One-by-One)

### Starting Mapper:
- After bank confirmation, Transaction Mapper automatically opens
- Shows first unmapped transaction from that batch
- Progress bar shows: "1 of 50" (for example)

### For Each Transaction:

#### Fields Displayed:
1. **Transaction Type Badge** - Deposit (Credit) or Withdrawal (Debit)
2. **Amount** - Transaction amount in ₹
3. **Bank Account** - Which bank this transaction belongs to
4. **Narration / Description**
   - Pre-filled with AI-enhanced description
   - User can edit
   - Original description shown below for reference
   - "AI Enhanced" badge if AI-suggested

5. **Category Selection**
   - Pre-filled with AI-suggested category
   - Only shows relevant categories (Expense for debits, Income for credits)
   - "AI Suggested" badge if AI-suggested
   - Option to add new category on-the-fly

6. **Transaction Date & Creation Info**
   - Shows when transaction occurred
   - Shows when it was extracted

### Action Options:

**Option 1: Confirm All with AI (Bulk Action)**
- Shows: "Confirm All with AI Suggestions (45/50)" - X transactions have AI suggestions
- One click approves all transactions with AI category suggestions
- Skips transactions without AI suggestions (can be mapped manually later)
- Progress updated immediately

**Option 2: Save & Next (Individual)**
- Saves current transaction and moves to next
- Records description, category, and timestamp
- Transaction marked as "mapped" in database

**Option 3: Skip**
- Leaves transaction unmapped
- Moves to next transaction
- User can come back to map it later

**Option 4: Delete**
- Removes transaction from database permanently
- Cannot be undone
- Asks for confirmation

### Navigation:
- **Previous/Next Buttons**: Jump between transactions
- **Progress Bar**: Visual indicator of completion
- **Close Button**: Saves progress and returns to main screen

### AI Integration:
- If Gemini API key configured:
  - Auto-suggests category based on description, amount, and past patterns
  - Auto-enhances description with clearer text
  - Learns from user choices for future improvements

---

## Part 3: Upload History & Management

### Upload History Section:
Located at bottom of Transactions page, shows:
- **File Name** - Original file uploaded
- **Transaction Count** - How many transactions extracted
- **Detected Bank** - Which bank auto-detected
- **Upload Date & Time** - When it was uploaded

### Delete Batch Action:
- Click trash icon on any batch
- Confirmation: "Delete this batch and all its 50 transactions?"
- Deletes entire batch and all related transactions from database
- Useful for removing duplicates or incorrect uploads

### Status:
- Shows if batch is pending, processing, or completed

---

## Part 4: Transaction Deletion

Users can delete transactions in two ways:

### During Mapping:
1. Open transaction mapper
2. Navigate to transaction to delete
3. Click "Delete" button
4. Confirm deletion
5. Transaction removed, move to next

### From Upload History:
1. Find batch in "Upload History & Management" section
2. Click trash icon
3. Confirm to delete all transactions in batch
4. All transactions removed from database

**Note**: Deleted transactions cannot be recovered, so user must confirm before deletion.

---

## Part 5: Reports & Ledger View

### Two View Modes:

#### 1. Summary View (Default)
Shows overview:
- Total Deposits & Withdrawals
- Net Balance
- Payables & Receivables tracking
- Category-wise breakdown with transaction counts
- Click category to see transactions in that category

#### 2. Ledger View
Shows detailed category-wise reports:

**Features:**
- Select date range (Last 30 Days, Last 90 Days, Last Year, All Time)
- Custom date range picker
- For each category:
  - Category name & icon
  - Number of transactions
  - **Total** - Sum of all transactions in that category
  - **Average** - Average transaction amount
  - **Transaction List** - All transactions sorted by date (newest first)
    - Description
    - Transaction date
    - Amount (color-coded: Green for income, Red for expense)
    - Notes (if any)

**Scrollable Transaction Details:**
- Max height with scroll for large category lists
- Hover effect on each transaction
- Sortable by date (newest first)

### Filter Options:
- **Date Range Buttons**: Quick select
- **Custom Dates**: Pick exact start and end dates
- **Category Filter**: View specific categories only

### Use Cases:
- View all expenses for a specific category in a date range
- Track payments to a specific party/payee
- Analyze spending patterns by category
- Verify transactions for reconciliation
- Export data for accounting/tax purposes

---

## Part 6: Data Flow & State Management

### Transaction States:
1. **unmapped** - Extracted but not categorized
2. **mapped** - Categorized but not approved
3. **approved** - Categorized and user confirmed

### Database Updates:
When transaction is confirmed:
- `final_description` - User-approved description
- `category_id` - Selected category
- `mapping_status` - Changed to 'mapped'
- `is_approved` - Set to true
- `approved_at` - Timestamp of approval

### AI Learning:
- Each confirmation saves to `ai_learning_patterns` table
- Original description + selected category + confidence score
- Used to improve future AI suggestions
- Tracks usage count and last used date

### Batch Tracking:
- Each batch has `batch_id` linking all transactions
- Tracks total transactions, mapped count, unmapped count
- Can delete entire batch with one action

---

## Part 7: User Experience Features

### Auto-Filling:
- AI automatically fills descriptions from bank statement
- AI automatically suggests categories based on:
  - Transaction amount
  - Description keywords
  - User's historical patterns
- User can always override AI suggestions

### No Data Loss:
- All extracted data saved immediately to database
- Can close mapper anytime and come back later
- Progress automatically saved
- Deleted transactions are tracked

### Flexible Workflow:
Users can:
- Map all transactions at once using "Confirm All"
- Map one by one using "Save & Next"
- Skip some and come back later
- Bulk delete unwanted batches
- Delete individual transactions
- Edit bank details before confirming
- Add new categories on-the-fly

### Visual Feedback:
- Progress bar showing completion
- AI badge indicators
- Color-coded amounts (green/red)
- Status messages for all actions
- Loading states during processing

---

## Summary of Key Improvements

✅ **Before**: After extracting, showed "Map Unmapped Transactions" at top, then "All Transactions Mapped" error
✅ **Now**: After extracting, shows bank confirmation screen, then automatically opens transaction mapper

✅ **Before**: No way to manage extracted transactions
✅ **Now**: Can delete entire batches or individual transactions

✅ **Before**: Reports only showed summary and category breakdown
✅ **Now**: Ledger view shows date-wise, category-wise transaction details with averages

✅ **Before**: No bank confirmation before mapping
✅ **Now**: Users confirm and can edit bank details before processing transactions

✅ **Before**: Must map all transactions immediately
✅ **Now**: Map incrementally, can close and come back anytime

✅ **Before**: No bulk approval
✅ **Now**: "Confirm All with AI Suggestions" approves 50+ transactions in one click

---

## Technical Implementation

### New Components:
1. **BankConfirmation.tsx** - Bank details confirmation form
2. **TransactionMapperFlow.tsx** - Enhanced transaction mapper with delete capability

### Updated Components:
1. **TransactionsNew.tsx** - Integrated bank confirmation and new mapper flow
2. **Reports.tsx** - Added ledger view with category-wise details

### Database Operations:
- Batch management (create, read, delete)
- Transaction deletion support
- Mapping status tracking
- AI learning pattern storage
- RLS policies ensure data security

### State Management:
- Proper state flow for bank confirmation
- Transaction batch tracking
- UI state for view modes
- Progress indicators

---

## Testing Checklist

- [ ] Upload PDF/CSV/Excel → Bank confirmation appears
- [ ] Edit bank details and confirm
- [ ] Transaction mapper opens automatically
- [ ] Transaction mapper shows one transaction
- [ ] AI suggestions populate description and category
- [ ] "Confirm All with AI Suggestions" bulk approves
- [ ] "Save & Next" maps one transaction
- [ ] "Skip" moves to next without saving
- [ ] "Delete" removes transaction
- [ ] Previous/Next navigation works
- [ ] Custom category creation works
- [ ] Close button saves progress
- [ ] Upload History shows all batches
- [ ] Delete batch removes all transactions
- [ ] Reports Summary view shows totals
- [ ] Reports Ledger view shows date-wise details
- [ ] Custom date range filters work
- [ ] Category filtering works in ledger view

---
