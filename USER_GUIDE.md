# SmartFinance AI - User Guide

## Quick Start Guide

### 1. First Time Setup

1. **Create Account**
   - Sign up with your email and password
   - Add your full name

2. **Add Gemini API Key** (Optional but Recommended)
   - Go to Profile tab
   - Click "Get your free Gemini API key"
   - Paste the key and save
   - This enables AI-powered categorization

3. **Add Bank Accounts** (Optional)
   - Go to Transactions tab
   - Click the + button under "Your Banks"
   - Enter bank name, account number, type, and opening balance
   - Banks are also auto-created from uploaded statements

### 2. Upload Bank Statement

1. Go to **Transactions** tab
2. Click "Upload Bank Statement"
3. Select your CSV, PDF, Excel, or text file
4. Click **"Extract & Save to Database"**
5. System will:
   - Extract all transactions
   - Detect bank name automatically
   - Save everything to database
   - Show success message

**That's it!** All transactions are now safely stored.

### 3. Map Transactions (At Your Own Pace)

1. You'll see an **orange banner** showing unmapped transactions count
2. Click the banner to open **Transaction Mapper**
3. For each transaction:
   - Review the description (AI-enhanced if you have API key)
   - Select or add a category
   - Click **"Save & Next"** or **"Skip"**
4. Your progress is **automatically saved**
5. Close anytime and return later
6. The mapper picks up where you left off

**You don't need to map everything at once!**

### 4. Add New Categories

**While mapping transactions:**
1. Click **"New Category"** button
2. Enter category name
3. Select type (Expense or Income)
4. Click "Add Category"
5. Use it immediately for the current transaction

### 5. Add Cash Transactions

1. Go to Transactions tab
2. Click **"Add Cash Transaction"** (green button)
3. Select **Withdrawal** or **Deposit**
4. Enter amount, description, date
5. Select category
6. Add notes (optional)
7. Click **"Save Transaction"**

**Auto-Complete Feature**: As you type description, system shows similar past transactions. Click to auto-fill!

### 6. View Reports

1. Go to **Reports** tab
2. Select date range:
   - Last 30 Days
   - Last 90 Days
   - Last Year
   - All Time
3. View summaries:
   - Total Deposits
   - Total Withdrawals
   - Net Balance
   - **Payables** (amounts you need to pay)
   - **Receivables** (amounts owed to you)
4. **Category Breakdown**:
   - Click any category to see all transactions
   - View percentage contribution
   - See transaction count

### 7. Split Expenses

1. Go to **Split** tab
2. Click the **+** button
3. Enter expense details:
   - Description
   - Total amount
   - Friend's email (they must have an account)
4. Choose split method:
   - Equal (50-50)
   - Custom amounts
5. Select category and date
6. Click "Create Split Expense"

**Track who owes you and who you owe!**

### 8. Set Reminders

1. Go to **Alerts** tab
2. Click the **+** button
3. Create reminder:
   - Type: Payment Due, Collection, or Budget Alert
   - Title and description
   - Amount (optional)
   - Due date
   - Recurring (optional)
4. Click "Create Reminder"

### 9. Get AI Insights

1. Go to **Insights** tab
2. Click **"Generate New Insights"**
3. AI analyzes your transactions and provides:
   - Spending patterns
   - Budget alerts
   - Predictions
   - Personalized recommendations

## Terminology Guide

### Deposits vs Withdrawals
- **Deposit** = Money coming IN (previously called Income)
- **Withdrawal** = Money going OUT (previously called Expense)

This matches standard banking terminology!

### Transaction States
- **Unmapped** = Extracted but no category assigned yet
- **Mapped** = Category assigned but not yet approved
- **Approved** = Fully processed and included in reports

## Tips for Maximum Automation

### 1. Upload Regularly
- Upload statements as soon as you receive them
- System saves everything immediately
- Map transactions when convenient

### 2. Use AI Suggestions
- Add your Gemini API key
- AI learns from your choices
- Gets better over time
- Saves tons of manual work

### 3. Create Custom Categories
- Add categories that match your spending
- System remembers and suggests them
- Better insights with personalized categories

### 4. Map in Batches
- Don't feel pressured to map everything at once
- Map 5-10 transactions when you have time
- Come back later for more
- Progress is always saved

### 5. Use Auto-Complete
- When adding cash transactions
- Start typing description
- Click suggestion to auto-fill
- Saves time on recurring transactions

### 6. Check Reports Weekly
- Review your Deposits vs Withdrawals
- Track Payables and Receivables
- Monitor category-wise spending
- Make informed decisions

### 7. Tag for Easy Tracking
- Add notes like "payable" or "receivable"
- Shows up in reports
- Easy to track pending amounts

## Common Workflows

### Monthly Statement Review
```
1. Upload bank statement → All transactions saved
2. Map new transactions (5-10 minutes)
3. Check Reports tab
4. Review payables/receivables
5. Set reminders for due payments
```

### Daily Cash Tracking
```
1. Make a cash purchase
2. Open app → Transactions → Add Cash Transaction
3. Enter details (auto-complete helps!)
4. Save → Done in 30 seconds
```

### Split Bill with Friend
```
1. Pay the bill
2. App → Split tab → Create split expense
3. Enter friend's email
4. Choose split method
5. They see it in their account
6. Mark as settled when paid
```

### Financial Planning
```
1. Go to Reports tab
2. Select "Last 90 Days"
3. Review category breakdown
4. Identify high spending categories
5. Set reminders for upcoming payments
6. Generate AI insights for recommendations
```

## Troubleshooting

### Transaction Not Detected from Statement
- Check file format (CSV, PDF, Excel)
- Ensure clear column headers
- Try different file format
- Manually add if needed

### AI Not Suggesting Categories
- Check if Gemini API key is added
- Verify API key is valid
- Try manual categorization
- System learns and improves

### Can't Find Unmapped Transactions
- Check Transactions tab for orange banner
- Verify transactions were uploaded
- Look at Home tab for recent activity

### Progress Not Saving
- Check internet connection
- Ensure you clicked "Save & Next"
- Don't close browser tab immediately
- Wait for confirmation

## Support

For any issues or questions:
1. Check this guide first
2. Review the IMPLEMENTATION_COMPLETE.md file
3. Check database migrations in supabase/migrations/

## Data Safety

Your data is:
- ✅ Securely stored in Supabase
- ✅ Protected by Row Level Security
- ✅ Never shared with others
- ✅ Backed up automatically
- ✅ Only accessible by you

## Maximum Automation Features

1. **Auto-Extract**: Upload once, all data extracted
2. **Auto-Suggest**: AI recommends categories
3. **Auto-Learn**: System learns your preferences
4. **Auto-Save**: Progress saved automatically
5. **Auto-Complete**: Suggests similar transactions
6. **Auto-Detect**: Identifies bank from statement
7. **Auto-Create**: Creates banks and categories as needed

## Privacy & Security

- Your Gemini API key is encrypted
- Transactions are private to your account
- No data sharing between users
- Secure authentication
- Row-level security on all data

---

**Enjoy your automated finance management experience!**
