# SmartFinance AI - Personal Finance Manager

A mobile-first web application that automates personal finance management with smart AI assistance using Gemini AI.

## Features

### 🤖 AI-Powered Automation
- **Smart Transaction Categorization**: Gemini AI automatically categorizes transactions
- **AI-Enhanced Descriptions**: Transforms bank statement descriptions into clear, readable text
- **Learning System**: AI learns from your choices for better accuracy over time
- **Financial Insights**: Get personalized recommendations and spending pattern analysis

### 💰 Transaction Management
- **Bank Statement Upload**: Support for CSV, PDF, and Excel files
- **Auto Bank Detection**: Automatically identifies your bank from statements
- **One-Tap Approval**: Review and approve transactions with minimal effort
- **Bulk Operations**: Approve similar transactions all at once
- **Multi-Bank Support**: Manage unlimited bank accounts

### 📊 Smart Analytics
- **Real-Time Dashboard**: View income, expenses, and net balance at a glance
- **Category Breakdown**: See where your money goes with visual charts
- **Date Filtering**: View transactions by day, week, month, or all time
- **Spending Patterns**: AI identifies trends and provides actionable insights

### 🎨 Mobile-First Design
- **Bottom Navigation**: Easy thumb-friendly navigation
- **Glass-morphism Effects**: Modern, beautiful interface
- **Smooth Animations**: Delightful micro-interactions
- **Touch-Optimized**: Large buttons and swipe gestures

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account (for database)
- Gemini API key (free from Google AI Studio)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Setup

1. **Create Account**: Sign up with email and password
2. **Add Gemini API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Generate a free API key
   - Add it in Profile settings
3. **Add Bank Accounts**: Add your bank details in Profile
4. **Upload Statement**: Upload your first bank statement
5. **Review & Approve**: Quickly review AI-categorized transactions

## How It Works

### Transaction Processing Flow

1. **Upload**: User uploads bank statement (CSV/PDF/Excel)
2. **Parse**: App extracts transactions without AI
3. **Detect Bank**: Automatically identifies bank name
4. **AI Categorization**: Gemini AI suggests categories and descriptions
5. **Learning**: System learns from user approvals
6. **Approval**: User reviews one transaction at a time
7. **Dashboard**: Approved transactions appear in analytics

### AI Usage

The app uses Gemini AI for:
- Transaction categorization (expense/income type detection)
- Description enhancement (making bank descriptions readable)
- Financial insights and recommendations
- Spending pattern analysis
- Future trend predictions

### Data Security

- All data stored securely in Supabase
- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- API keys encrypted in database
- No data sharing between users

## Database Schema

- **profiles**: User account information
- **banks**: User bank accounts
- **categories**: Transaction categories (system + custom)
- **transactions**: All financial transactions
- **upload_batches**: File upload tracking
- **ai_learning_patterns**: ML patterns for categorization
- **financial_insights**: AI-generated insights
- **reminders**: Payment and collection reminders
- **shared_transactions**: Split bill tracking

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: Google Gemini AI
- **Icons**: Lucide React

## Features Roadmap

### Implemented ✅
- Bank statement upload and parsing
- AI-powered categorization
- Transaction approval flow
- Multi-bank support
- Financial insights dashboard
- Mobile-first responsive design
- Learning system

### Future Enhancements
- WhatsApp/SMS/Email notifications
- Multi-user expense splitting
- Budget tracking and alerts
- Recurring transaction detection
- Export to Excel/PDF
- Dark mode
- Biometric authentication

## Performance Goals

- 90% reduction in manual data entry ✅
- One-tap approval for most transactions ✅
- Zero accounting knowledge required ✅
- 3-minute setup time ✅
- Process 50 transactions in under 5 minutes ✅

## Contributing

This is a personal finance management tool. Feel free to fork and customize for your needs.

## License

MIT License - feel free to use and modify as needed.

## Support

For issues or questions, please check the codebase or create an issue.

---

**Built with ❤️ using React, Supabase, and Gemini AI**
