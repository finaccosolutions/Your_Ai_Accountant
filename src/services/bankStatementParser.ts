interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
}

interface BankDetectionResult {
  bankName: string;
  confidence: number;
}

const BANK_PATTERNS = {
  'HDFC Bank': ['hdfc', 'hdfc bank'],
  'ICICI Bank': ['icici', 'icici bank'],
  'State Bank of India': ['sbi', 'state bank', 'state bank of india'],
  'Axis Bank': ['axis', 'axis bank'],
  'Kotak Mahindra Bank': ['kotak', 'kotak mahindra'],
  'Punjab National Bank': ['pnb', 'punjab national'],
  'Bank of Baroda': ['bob', 'bank of baroda', 'baroda'],
  'Canara Bank': ['canara', 'canara bank'],
  'Union Bank': ['union', 'union bank'],
  'IDFC First Bank': ['idfc', 'idfc first'],
};

export class BankStatementParser {
  detectBankFromText(text: string): BankDetectionResult {
    const lowerText = text.toLowerCase();

    for (const [bankName, patterns] of Object.entries(BANK_PATTERNS)) {
      for (const pattern of patterns) {
        if (lowerText.includes(pattern)) {
          return {
            bankName,
            confidence: 0.9,
          };
        }
      }
    }

    return {
      bankName: 'Unknown Bank',
      confidence: 0.1,
    };
  }

  parseCSV(content: string): ParsedTransaction[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

    const dateIdx = headers.findIndex(h => h.includes('date'));
    const descIdx = headers.findIndex(h =>
      h.includes('description') || h.includes('narration') || h.includes('particulars')
    );
    const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
    const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('deposit'));
    const amountIdx = headers.findIndex(h => h === 'amount');

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));

      if (parts.length < headers.length) continue;

      const date = dateIdx >= 0 ? this.parseDate(parts[dateIdx]) : new Date().toISOString().split('T')[0];
      const description = descIdx >= 0 ? parts[descIdx] : 'Unknown';

      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';

      if (debitIdx >= 0 && parts[debitIdx]) {
        amount = parseFloat(parts[debitIdx].replace(/[^0-9.-]/g, ''));
        type = 'debit';
      } else if (creditIdx >= 0 && parts[creditIdx]) {
        amount = parseFloat(parts[creditIdx].replace(/[^0-9.-]/g, ''));
        type = 'credit';
      } else if (amountIdx >= 0 && parts[amountIdx]) {
        const amt = parseFloat(parts[amountIdx].replace(/[^0-9.-]/g, ''));
        amount = Math.abs(amt);
        type = amt < 0 ? 'debit' : 'credit';
      }

      if (amount > 0 && description && description !== 'Unknown') {
        transactions.push({ date, description, amount, type });
      }
    }

    return transactions;
  }

  async parsePDF(file: File): Promise<{ transactions: ParsedTransaction[]; detectedBank: string }> {
    const text = await this.extractTextFromPDF(file);
    const bankResult = this.detectBankFromText(text);

    const transactions = this.parseTransactionsFromText(text);

    return {
      transactions,
      detectedBank: bankResult.bankName,
    };
  }

  private async extractTextFromPDF(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        resolve(text);
      };
      reader.readAsText(file);
    });
  }

  private parseTransactionsFromText(text: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n');

    const datePattern = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/;
    const amountPattern = /\b\d{1,3}(,\d{3})*(\.\d{2})?\b/;

    for (const line of lines) {
      const dateMatch = line.match(datePattern);
      if (!dateMatch) continue;

      const amounts = line.match(new RegExp(amountPattern, 'g'));
      if (!amounts || amounts.length === 0) continue;

      const date = this.parseDate(dateMatch[0]);

      let description = line
        .replace(datePattern, '')
        .replace(amountPattern, '')
        .trim();

      description = description.substring(0, 100);

      const lastAmount = amounts[amounts.length - 1].replace(/,/g, '');
      const amount = parseFloat(lastAmount);

      if (amount > 0 && description) {
        const type: 'debit' | 'credit' = line.toLowerCase().includes('cr') ||
                                          line.toLowerCase().includes('credit') ||
                                          line.toLowerCase().includes('deposit')
                                          ? 'credit'
                                          : 'debit';

        transactions.push({ date, description, amount, type });
      }
    }

    return transactions;
  }

  private parseDate(dateStr: string): string {
    const formats = [
      /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/,
      /(\d{1,2})[-/](\d{1,2})[-/](\d{2})/,
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (match[0].startsWith('20') || match[0].startsWith('19')) {
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          const year = match[3].length === 2 ? `20${match[3]}` : match[3];
          return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
      }
    }

    return new Date().toISOString().split('T')[0];
  }
}
