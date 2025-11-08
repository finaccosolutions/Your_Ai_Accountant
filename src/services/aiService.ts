import { Category, Transaction } from '../lib/types';

interface AICategorizationResult {
  categoryId: string;
  description: string;
  confidence: number;
}

interface AIInsight {
  type: 'spending_pattern' | 'budget_alert' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  data?: Record<string, unknown>;
}

export class AIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async enhanceDescription(
    originalDescription: string,
    amount: number,
    type: 'debit' | 'credit'
  ): Promise<string> {
    try {
      const prompt = `You are a financial transaction description expert. Your job is to convert technical bank statement descriptions into clear, human-readable descriptions that users can easily understand.

Original Bank Description: "${originalDescription}"
Amount: ₹${amount}
Type: ${type === 'debit' ? 'Payment/Expense' : 'Deposit/Income'}

Analyze the original description and create a clear, concise, realistic description that:
1. Identifies the merchant/payee/source
2. Describes what the transaction is for
3. Removes technical codes, reference numbers, and jargon
4. Keeps it under 50 characters
5. Makes it immediately understandable

Examples:
- "NEFT-SBIN0001234-JOHN DOE-RENT-123456" → "Rent Payment to John Doe"
- "UPI-ZOMATO-ORDER123456-FOOD" → "Zomato Food Order"
- "IMPS-HDFCBank-Salary-Acme Corp-987654" → "Salary from Acme Corp"
- "ATM WDL-AXIS BANK-MG ROAD-456789" → "ATM Withdrawal at MG Road"
- "SWIGGY-ORDER-DEL-REF123456" → "Swiggy Food Delivery"

Respond with ONLY the enhanced description text, nothing else.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!response.ok) {
        return originalDescription;
      }

      const data = await response.json();
      const enhancedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const cleaned = enhancedText.trim().replace(/^["']|["']$/g, '');

      if (cleaned.length > 0 && cleaned.length < 150) {
        return cleaned;
      }

      return originalDescription;
    } catch (error) {
      console.error('Description enhancement error:', error);
      return originalDescription;
    }
  }

  async categorizeTransaction(
    description: string,
    amount: number,
    type: 'debit' | 'credit',
    categories: Category[],
    learningPatterns?: Array<{ description: string; categoryId: string; confidence: number }>
  ): Promise<AICategorizationResult> {
    try {
      const relevantCategories = categories.filter(c => c.type === (type === 'debit' ? 'expense' : 'income'));

      const enhancedDescription = await this.enhanceDescription(description, amount, type);

      const prompt = `You are a financial categorization expert. Analyze this transaction and suggest the most appropriate category.

Transaction Details:
- Original Description: ${description}
- Enhanced Description: ${enhancedDescription}
- Amount: ${amount}
- Type: ${type === 'debit' ? 'Expense' : 'Income'}

Available Categories:
${relevantCategories.map(c => `- ${c.name} (ID: ${c.id})`).join('\n')}

${learningPatterns && learningPatterns.length > 0 ? `User's Past Patterns:
${learningPatterns.map(p => `- "${p.description}" → Category ID: ${p.categoryId} (Confidence: ${p.confidence})`).join('\n')}
` : ''}

Respond in JSON format with ONLY the category ID and confidence:
{
  "categoryId": "category_id_from_list",
  "confidence": 0.85
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!response.ok) {
        throw new Error('AI categorization failed');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format');
      }

      const result = JSON.parse(jsonMatch[0]);

      const validCategory = relevantCategories.find(c => c.id === result.categoryId);
      if (!validCategory) {
        return {
          categoryId: relevantCategories[0].id,
          description: enhancedDescription,
          confidence: 0.3,
        };
      }

      return {
        categoryId: result.categoryId,
        description: enhancedDescription,
        confidence: result.confidence || 0.7,
      };
    } catch (error) {
      console.error('AI categorization error:', error);

      const defaultCategories = categories.filter(c => c.type === (type === 'debit' ? 'expense' : 'income'));
      return {
        categoryId: defaultCategories[0]?.id || categories[0].id,
        description: description,
        confidence: 0.1,
      };
    }
  }

  async generateInsights(
    transactions: Transaction[],
    categories: Category[]
  ): Promise<AIInsight[]> {
    try {
      const expenses = transactions.filter(t => t.type === 'debit' && t.is_approved);
      const income = transactions.filter(t => t.type === 'credit' && t.is_approved);

      const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
      const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

      const categorySpending = expenses.reduce((acc, t) => {
        if (t.category_id) {
          acc[t.category_id] = (acc[t.category_id] || 0) + t.amount;
        }
        return acc;
      }, {} as Record<string, number>);

      const prompt = `You are a personal finance advisor. Analyze this user's financial data and provide 3-5 actionable insights.

Financial Summary:
- Total Income: ${totalIncome}
- Total Expenses: ${totalExpenses}
- Net: ${totalIncome - totalExpenses}
- Number of Transactions: ${transactions.length}

Spending by Category:
${Object.entries(categorySpending)
  .map(([catId, amount]) => {
    const cat = categories.find(c => c.id === catId);
    return `- ${cat?.name || 'Unknown'}: ${amount}`;
  })
  .join('\n')}

Provide insights in JSON array format:
[
  {
    "type": "spending_pattern",
    "title": "Brief insight title",
    "description": "Detailed explanation with actionable advice",
    "severity": "info"
  }
]

Types: spending_pattern, budget_alert, prediction, recommendation
Severity: info, warning, critical`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!response.ok) {
        return this.getFallbackInsights(totalIncome, totalExpenses, categorySpending, categories);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.getFallbackInsights(totalIncome, totalExpenses, categorySpending, categories);
      }

      const insights = JSON.parse(jsonMatch[0]);
      return insights.slice(0, 5);
    } catch (error) {
      console.error('AI insights error:', error);
      return [];
    }
  }

  private getFallbackInsights(
    totalIncome: number,
    totalExpenses: number,
    categorySpending: Record<string, number>,
    categories: Category[]
  ): AIInsight[] {
    const insights: AIInsight[] = [];

    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    if (savingsRate < 20) {
      insights.push({
        type: 'recommendation',
        title: 'Low Savings Rate',
        description: `You're saving ${savingsRate.toFixed(1)}% of your income. Financial experts recommend saving at least 20% for a healthy financial future.`,
        severity: 'warning',
      });
    } else {
      insights.push({
        type: 'spending_pattern',
        title: 'Great Savings Rate',
        description: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep up the excellent work!`,
        severity: 'info',
      });
    }

    const topCategory = Object.entries(categorySpending).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      const cat = categories.find(c => c.id === topCategory[0]);
      const percentage = (topCategory[1] / totalExpenses) * 100;

      insights.push({
        type: 'spending_pattern',
        title: 'Top Spending Category',
        description: `${cat?.name || 'A category'} accounts for ${percentage.toFixed(1)}% of your total expenses. Consider if this aligns with your financial goals.`,
        severity: percentage > 40 ? 'warning' : 'info',
      });
    }

    return insights;
  }
}
