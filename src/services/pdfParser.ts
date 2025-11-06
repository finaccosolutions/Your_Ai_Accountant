import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  confidence?: number;
  warnings?: string[];
}

export interface BankDetectionResult {
  bankName: string;
  accountNumber: string;
  confidence: number;
}

const BANK_PATTERNS = {
  'HDFC Bank': {
    keywords: ['hdfc', 'hdfc bank'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
  'ICICI Bank': {
    keywords: ['icici', 'icici bank'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
  'State Bank of India': {
    keywords: ['sbi', 'state bank', 'state bank of india'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
  'Axis Bank': {
    keywords: ['axis', 'axis bank'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
  'Kotak Mahindra Bank': {
    keywords: ['kotak', 'kotak mahindra'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
  'Punjab National Bank': {
    keywords: ['pnb', 'punjab national'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
  'Bank of Baroda': {
    keywords: ['bob', 'bank of baroda', 'baroda'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
  'Canara Bank': {
    keywords: ['canara', 'canara bank'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
  'Union Bank': {
    keywords: ['union', 'union bank'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
  'IDFC First Bank': {
    keywords: ['idfc', 'idfc first'],
    accountPattern: /account\s*(?:no|number)?\s*[:\-]?\s*(\d{4,})/i,
  },
};

export class PDFParser {
  async extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  }

  detectBankFromText(text: string): BankDetectionResult {
    const lowerText = text.toLowerCase();

    for (const [bankName, config] of Object.entries(BANK_PATTERNS)) {
      for (const keyword of config.keywords) {
        if (lowerText.includes(keyword)) {
          const accountMatch = text.match(config.accountPattern);
          const accountNumber = accountMatch ? accountMatch[1].slice(-4) : 'XXXX';

          return {
            bankName,
            accountNumber,
            confidence: 0.9,
          };
        }
      }
    }

    return {
      bankName: 'Unknown Bank',
      accountNumber: 'XXXX',
      confidence: 0.1,
    };
  }

  parseTransactions(text: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n');

    const datePattern = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/;
    const amountPattern = /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g;

    for (const line of lines) {
      if (!line.trim()) continue;

      // Skip header lines
      const lineLower = line.toLowerCase();
      if (lineLower.includes('transaction date') ||
          lineLower.includes('description') ||
          lineLower.includes('account number') ||
          lineLower.includes('statement') ||
          lineLower.startsWith('date')) continue;

      const dateMatch = line.match(datePattern);
      if (!dateMatch) continue;

      const amounts = line.match(amountPattern);
      if (!amounts || amounts.length === 0) continue;

      const date = this.parseDate(dateMatch[0]);
      const warnings: string[] = [];

      let description = line
        .replace(datePattern, '')
        .replace(amountPattern, '')
        .replace(/\s+/g, ' ')
        .replace(/[\*#@]/g, '')
        .trim();

      if (description.length > 100) {
        description = description.substring(0, 100);
      }

      if (description.length < 3) continue;

      // Try to identify debit and credit amounts
      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';
      let confidence = 0.8;

      // Look for explicit credit/debit markers
      const hasCreditMarker = lineLower.includes('cr') ||
                              lineLower.includes('credit') ||
                              lineLower.includes('deposit');
      const hasDebitMarker = lineLower.includes('dr') ||
                             lineLower.includes('debit') ||
                             lineLower.includes('withdrawal');

      if (hasCreditMarker && !hasDebitMarker) {
        type = 'credit';
        confidence = 0.9;
      } else if (hasDebitMarker && !hasCreditMarker) {
        type = 'debit';
        confidence = 0.9;
      } else {
        warnings.push('Transaction type unclear - please verify');
        confidence = 0.5;
      }

      // Handle multiple amounts (common in statements)
      if (amounts.length >= 2) {
        // Last amount is usually balance, second-to-last is transaction amount
        const lastAmount = parseFloat(amounts[amounts.length - 2].replace(/,/g, ''));
        amount = lastAmount;
        confidence = Math.min(confidence, 0.7);
        warnings.push('Multiple amounts detected - please verify amount');
      } else {
        const lastAmount = amounts[amounts.length - 1].replace(/,/g, '');
        amount = parseFloat(lastAmount);
      }

      if (amount <= 0 || isNaN(amount)) continue;

      // Date validation
      const parsedDate = new Date(date);
      const now = new Date();
      const twoYearsAgo = new Date(now.setFullYear(now.getFullYear() - 2));
      const oneYearFuture = new Date(now.setFullYear(now.getFullYear() + 3));

      if (parsedDate < twoYearsAgo || parsedDate > oneYearFuture) {
        warnings.push('Date seems unusual - please verify');
        confidence = Math.min(confidence, 0.6);
      }

      transactions.push({
        date,
        description,
        amount,
        type,
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined
      });
    }

    return transactions;
  }

  parseCSV(content: string): ParsedTransaction[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));

    const dateIdx = headers.findIndex(h => h.includes('date'));
    const descIdx = headers.findIndex(h =>
      h.includes('description') || h.includes('narration') || h.includes('particulars') || h.includes('remarks')
    );
    const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
    const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('deposit'));
    const amountIdx = headers.findIndex(h => h === 'amount');
    const balanceIdx = headers.findIndex(h => h.includes('balance'));

    if (dateIdx === -1 || descIdx === -1) {
      throw new Error('CSV file must have Date and Description columns');
    }

    if (debitIdx === -1 && creditIdx === -1 && amountIdx === -1) {
      throw new Error('CSV file must have Debit, Credit, or Amount column');
    }

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));

      if (parts.length < headers.length - 1) continue;

      const warnings: string[] = [];

      const date = dateIdx >= 0 ? this.parseDate(parts[dateIdx]) : new Date().toISOString().split('T')[0];
      let description = descIdx >= 0 ? parts[descIdx] : 'Unknown';

      if (!description || description === 'Unknown' || description.length < 3) continue;

      // Clean description
      description = description.replace(/[\*#@]/g, '').trim();

      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';
      let confidence = 0.9;

      if (debitIdx >= 0 && parts[debitIdx] && parts[debitIdx].trim() !== '') {
        amount = parseFloat(parts[debitIdx].replace(/[^0-9.-]/g, ''));
        type = 'debit';
      } else if (creditIdx >= 0 && parts[creditIdx] && parts[creditIdx].trim() !== '') {
        amount = parseFloat(parts[creditIdx].replace(/[^0-9.-]/g, ''));
        type = 'credit';
      } else if (amountIdx >= 0 && parts[amountIdx]) {
        const amt = parseFloat(parts[amountIdx].replace(/[^0-9.-]/g, ''));
        amount = Math.abs(amt);
        type = amt < 0 ? 'debit' : 'credit';
        warnings.push('Transaction type inferred from amount sign');
        confidence = 0.7;
      }

      if (amount <= 0 || isNaN(amount)) {
        continue;
      }

      // Validate date
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        warnings.push('Invalid date format');
        confidence = 0.5;
      }

      transactions.push({
        date,
        description,
        amount,
        type,
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined
      });
    }

    if (transactions.length === 0) {
      throw new Error('No valid transactions found in CSV file');
    }

    return transactions;
  }

  private parseDate(dateStr: string): string {
    const cleanDate = dateStr.trim();

    const ddmmyyyy = cleanDate.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    const ddmmyy = cleanDate.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2})/);
    if (ddmmyy) {
      const day = ddmmyy[1].padStart(2, '0');
      const month = ddmmyy[2].padStart(2, '0');
      const year = `20${ddmmyy[3]}`;
      return `${year}-${month}-${day}`;
    }

    const yyyymmdd = cleanDate.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (yyyymmdd) {
      const year = yyyymmdd[1];
      const month = yyyymmdd[2].padStart(2, '0');
      const day = yyyymmdd[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return new Date().toISOString().split('T')[0];
  }
}
