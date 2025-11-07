# PDF Extraction & Transaction Flow Improvements

## Changes Made

### 1. Enhanced PDF Parser for Better Transaction Extraction

**File**: `src/services/pdfParser.ts`

#### Improvements:

**Better Header Detection**:
- Expanded header detection patterns to include more variations
- Now detects: "txn date", "withdrawal/deposit", and other common column names
- Looks at up to 20 lines instead of 15 for header detection
- Falls back gracefully if no clear header is found

**Enhanced Date Pattern Recognition**:
- Added support for date formats like: "DD-MMM-YYYY" (e.g., "20-Jan-2024")
- Better handling of various date separators (-, /, ., spaces)
- More robust date parsing across different bank statement formats

**Improved Transaction Filtering**:
- Filters out more statement metadata: "grand total", "statement period", "page", "continued"
- Better handling of opening/closing balance lines
- Minimum line length reduced to 8 characters to catch short descriptions

**Better Amount Extraction**:
- Enhanced amount pattern to catch amounts with 1-2 decimal places (not just 2)
- Supports larger amounts (up to 100M instead of 10M)
- Better handling of comma-separated amounts
- More accurate amount selection when multiple amounts are present on a line

**Smart Description Extraction**:
- Preserves slashes in descriptions (important for reference numbers)
- Removes "DR" and "CR" markers from descriptions automatically
- Multi-line description support - looks ahead up to 3 lines for continuation
- Maximum description length increased to 150 characters
- Minimum description length reduced to 2 characters

**Better Transaction Type Detection**:
- Uses word boundary regex for more accurate CR/DR detection
- Added more keywords: "received", "salary", "refund" for credits
- Added "payment", "purchase" for debits
- Better confidence scoring based on marker clarity

**Improved Amount Selection Logic**:
- Single amount: Uses it directly (highest confidence)
- Two amounts: Uses first (likely the transaction amount)
- Three amounts: Uses middle amount (often transaction amount in debit/credit/balance format)
- Four+ amounts: Uses second largest (smart selection)
- Adds warning when multiple amounts detected

### 2. UI Improvements for Transaction Management

**File**: `src/components/TransactionsNew.tsx`

#### Changes:

**Dual Transaction Tracking**:
- Now tracks both unmapped AND mapped transactions
- Separate counters for each state
- Better state management

**Two Banners**:
1. **"Pending Items" (Green)** - Shows mapped transactions (ones already categorized and approved)
   - These are ready to review
   - Clicking opens the new MappedTransactionsViewer

2. **"Unaccounted Transactions" (Orange)** - Shows unmapped transactions
   - These need categorization
   - Clicking opens the TransactionMapperFlow

**Better Terminology**:
- "Pending Items" - Mapped/approved transactions
- "Unaccounted Transactions" - Need categorization

### 3. New Component: Mapped Transactions Viewer

**File**: `src/components/MappedTransactionsViewer.tsx`

A clean, read-only view of all mapped transactions showing:
- Transaction type (Deposit/Withdrawal)
- Category badges
- Full descriptions (AI-enhanced or original)
- Transaction date in readable format (DD-MMM-YYYY)
- Bank name
- Amount with color coding
- Sorted by date (newest first)

**Features**:
- Beautiful card-based layout
- Hover effects
- Easy to scan visual hierarchy
- Close button to return to main view

## How It Works Now

### Upload Flow:
1. User uploads PDF/CSV/Excel/Text file
2. **Enhanced parser** extracts transactions with better accuracy
3. All transactions saved to database as "unmapped"
4. Bank confirmation screen appears
5. User confirms/edits bank details
6. AI categorizes transactions (if API key provided)

### After Upload:
- **Green Banner** appears if there are mapped (approved) transactions
  - Click to view all mapped transactions in a clean list
  
- **Orange Banner** appears if there are unmapped transactions
  - Click to start categorizing them one-by-one

### Benefits:

1. **Better Extraction**: Works with more bank statement formats
2. **Clearer UI**: Separate pending items from unaccounted items
3. **Easy Review**: View all mapped transactions in one place
4. **No Confusion**: Clear distinction between what needs action vs what's done

## Testing Recommendations

Test with various bank statements:
- PDF statements with tables
- CSV with different column names
- Excel files
- Text-based statements
- Different date formats
- Statements with multiple amount columns
- Multi-line descriptions
- Various transaction markers (CR, DR, Credit, Debit)

## Technical Details

### Transaction States:
1. **unmapped** - Extracted but not categorized
2. **mapped** - Categorized and approved (is_approved = true)

### Database Queries:
- Unmapped: `mapping_status = 'unmapped'`
- Mapped/Pending: `mapping_status = 'mapped' AND is_approved = true`

### Performance:
- Parallel queries for unmapped and mapped counts
- Efficient filtering with indexes
- Sorted results for better UX
