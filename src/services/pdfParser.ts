import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';

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
  'Federal Bank': {
    keywords: ['federal', 'federal bank', 'federalbank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'HDFC Bank': {
    keywords: ['hdfc', 'hdfc bank', 'hdfcbank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'ICICI Bank': {
    keywords: ['icici', 'icici bank', 'icicibank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'State Bank of India': {
    keywords: ['sbi', 'state bank', 'state bank of india'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'Axis Bank': {
    keywords: ['axis', 'axis bank', 'axisbank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'Kotak Mahindra Bank': {
    keywords: ['kotak', 'kotak mahindra', 'kotakbank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'Punjab National Bank': {
    keywords: ['pnb', 'punjab national', 'punjab national bank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'Bank of Baroda': {
    keywords: ['bob', 'bank of baroda', 'baroda'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'Canara Bank': {
    keywords: ['canara', 'canara bank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'Union Bank': {
    keywords: ['union', 'union bank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'IDFC First Bank': {
    keywords: ['idfc', 'idfc first', 'idfc bank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'Yes Bank': {
    keywords: ['yes bank', 'yesbank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
  'IndusInd Bank': {
    keywords: ['indusind', 'indusind bank'],
    accountPattern: /(?:account|a\/c|ac)[\s\w]*(?:no|number|num)?[\s:.\-]*(\d{4,})/i,
  },
};

export class PDFParser {
  async extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const textByPage: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const items = textContent.items as any[];
      const pageLines: Map<number, string[]> = new Map();

      items.forEach((item) => {
        if (item.str.trim()) {
          const y = Math.round(item.transform[5]);
          if (!pageLines.has(y)) {
            pageLines.set(y, []);
          }
          pageLines.get(y)!.push(item.str);
        }
      });

      const sortedLines = Array.from(pageLines.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([_, items]) => items.join(' ').trim())
        .filter(line => line.length > 0);

      const pageText = sortedLines.join('\n');
      textByPage.push(pageText);
      fullText += pageText + '\n';
    }

    return fullText;
  }

  async parseExcel(file: File): Promise<ParsedTransaction[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

    if (data.length === 0) {
      throw new Error('Excel file is empty');
    }

    const headers = data[0].map((h: any) => String(h || '').toLowerCase().trim());

    const dateIdx = headers.findIndex(h =>
      h.includes('date') || h.includes('txn date') || h.includes('transaction date')
    );
    const descIdx = headers.findIndex(h =>
      h.includes('description') || h.includes('narration') ||
      h.includes('particulars') || h.includes('remarks') || h.includes('details')
    );
    const debitIdx = headers.findIndex(h =>
      h.includes('debit') || h.includes('withdrawal') || h.includes('withdraw')
    );
    const creditIdx = headers.findIndex(h =>
      h.includes('credit') || h.includes('deposit')
    );
    const amountIdx = headers.findIndex(h => h === 'amount');

    if (dateIdx === -1) {
      throw new Error('Excel file must have a Date column');
    }

    if (descIdx === -1) {
      throw new Error('Excel file must have a Description/Narration column');
    }

    if (debitIdx === -1 && creditIdx === -1 && amountIdx === -1) {
      throw new Error('Excel file must have Debit, Credit, or Amount column');
    }

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const warnings: string[] = [];

      const dateValue = row[dateIdx];
      if (!dateValue) continue;

      const date = this.parseExcelDate(dateValue);

      let description = descIdx >= 0 ? String(row[descIdx] || '').trim() : 'Unknown';
      if (!description || description === 'Unknown' || description.length < 3) continue;

      description = description.replace(/[\*#@]/g, '').trim();

      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';
      let confidence = 0.9;

      if (debitIdx >= 0 && row[debitIdx] && String(row[debitIdx]).trim() !== '') {
        amount = this.parseAmount(row[debitIdx]);
        type = 'debit';
      } else if (creditIdx >= 0 && row[creditIdx] && String(row[creditIdx]).trim() !== '') {
        amount = this.parseAmount(row[creditIdx]);
        type = 'credit';
      } else if (amountIdx >= 0 && row[amountIdx]) {
        const amt = this.parseAmount(row[amountIdx]);
        amount = Math.abs(amt);
        type = amt < 0 ? 'debit' : 'credit';
        warnings.push('Transaction type inferred from amount sign');
        confidence = 0.7;
      }

      if (amount <= 0 || isNaN(amount)) continue;

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
      throw new Error('No valid transactions found in Excel file');
    }

    return transactions;
  }

  private parseExcelDate(value: any): string {
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    return this.parseDate(String(value));
  }

  private parseAmount(value: any): number {
    if (typeof value === 'number') {
      return value;
    }

    const str = String(value).replace(/[^0-9.-]/g, '');
    return parseFloat(str);
  }

  detectBankFromText(text: string): BankDetectionResult {
    const lowerText = text.toLowerCase().replace(/\s+/g, ' ');

    for (const [bankName, config] of Object.entries(BANK_PATTERNS)) {
      for (const keyword of config.keywords) {
        if (lowerText.includes(keyword)) {
          const accountMatch = text.match(config.accountPattern);
          let accountNumber = 'XXXX';

          if (accountMatch) {
            const fullAccount = accountMatch[1].replace(/\s/g, '');
            accountNumber = fullAccount.slice(-4);
          }

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
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return [];
    }

    let headerEndIndex = 0;
    let foundHeader = false;
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].toLowerCase();
      if (
        (line.includes('date') && (line.includes('debit') || line.includes('credit') || line.includes('amount') || line.includes('withdrawal') || line.includes('deposit'))) ||
        (line.includes('transaction') && line.includes('date')) ||
        (line.includes('particulars') && line.includes('amount')) ||
        (line.includes('narration') && line.includes('date')) ||
        (line.includes('txn') && line.includes('date'))
      ) {
        headerEndIndex = i + 1;
        foundHeader = true;
      }
    }

    const dataLines = lines.slice(foundHeader ? headerEndIndex : 0);

    const datePattern = /\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}|\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}|\d{2}[-/\s][A-Za-z]{3}[-/\s]\d{2,4})\b/;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (!line.trim() || line.trim().length < 8) continue;

      const lineLower = line.toLowerCase();

      if (
        lineLower.includes('opening balance') ||
        lineLower.includes('closing balance') ||
        lineLower.includes('total debit') ||
        lineLower.includes('total credit') ||
        lineLower.includes('balance b/f') ||
        lineLower.includes('balance c/f') ||
        lineLower.includes('grand total') ||
        lineLower.includes('statement period') ||
        lineLower.includes('page ') ||
        lineLower.includes('continued')
      ) {
        continue;
      }

      const dateMatch = line.match(datePattern);
      if (!dateMatch) continue;

      const amounts: number[] = [];
      let match;
      const tempAmountPattern = /(?:^|\s|\t)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+\.\d{1,2}|\d{4,})(?:\s|$|\t)/g;
      while ((match = tempAmountPattern.exec(line)) !== null) {
        const cleanAmount = match[1].replace(/,/g, '');
        const amt = parseFloat(cleanAmount);
        if (amt > 0.01 && amt < 100000000) {
          amounts.push(amt);
        }
      }

      if (amounts.length === 0) continue;

      const date = this.parseDate(dateMatch[0]);
      const warnings: string[] = [];

      let description = line
        .replace(datePattern, '')
        .replace(/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s\-\/]/g, '')
        .trim();

      const descLower = description.toLowerCase();
      if (descLower.includes('dr') || descLower.includes('cr')) {
        description = description.replace(/\b(dr|cr|DR|CR)\b/gi, '').trim();
      }

      if (description.length < 3) {
        for (let j = i + 1; j < Math.min(i + 3, dataLines.length); j++) {
          const nextLine = dataLines[j];
          if (!nextLine.match(datePattern) && nextLine.trim().length > 0) {
            const nextDesc = nextLine.replace(/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g, '').trim();
            if (nextDesc.length > 0) {
              description += ' ' + nextDesc;
              if (description.length >= 10) break;
            }
          } else {
            break;
          }
        }
      }

      if (description.length > 150) {
        description = description.substring(0, 150);
      }

      description = description.trim();
      if (description.length < 2) continue;

      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';
      let confidence = 0.8;

      const hasCreditMarker =
        /\bcr\b/i.test(line) ||
        lineLower.includes('credit') ||
        lineLower.includes('deposit') ||
        lineLower.includes('received') ||
        lineLower.includes('salary') ||
        lineLower.includes('refund');

      const hasDebitMarker =
        /\bdr\b/i.test(line) ||
        lineLower.includes('debit') ||
        lineLower.includes('withdrawal') ||
        lineLower.includes('withdraw') ||
        lineLower.includes('payment') ||
        lineLower.includes('purchase');

      if (hasCreditMarker && !hasDebitMarker) {
        type = 'credit';
        confidence = 0.9;
      } else if (hasDebitMarker && !hasCreditMarker) {
        type = 'debit';
        confidence = 0.9;
      } else {
        warnings.push('Transaction type unclear - please verify');
        confidence = 0.6;
      }

      if (amounts.length === 1) {
        amount = amounts[0];
      } else if (amounts.length === 2) {
        if (hasCreditMarker && !hasDebitMarker) {
          amount = amounts[0];
        } else if (hasDebitMarker && !hasCreditMarker) {
          amount = amounts[0];
        } else {
          amount = amounts[0];
        }
        confidence = Math.min(confidence, 0.85);
      } else if (amounts.length === 3) {
        if (hasCreditMarker && !hasDebitMarker) {
          amount = amounts[0];
        } else if (hasDebitMarker && !hasCreditMarker) {
          amount = amounts[0];
        } else {
          amount = amounts[0];
        }
        confidence = Math.min(confidence, 0.75);
      } else if (amounts.length >= 4) {
        const sortedAmounts = [...amounts].sort((a, b) => b - a);
        amount = sortedAmounts[1] || amounts[0];
        confidence = Math.min(confidence, 0.65);
        warnings.push('Multiple amounts detected - using most likely transaction amount');
      }

      if (amount <= 0 || isNaN(amount)) continue;

      const parsedDate = new Date(date);
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, 0, 1);
      const oneYearFuture = new Date(now.getFullYear() + 1, 11, 31);

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

    const dateIdx = headers.findIndex(h =>
      h.includes('date') || h.includes('txn date') || h.includes('transaction date')
    );
    const descIdx = headers.findIndex(h =>
      h.includes('description') || h.includes('narration') ||
      h.includes('particulars') || h.includes('remarks') || h.includes('details')
    );
    const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
    const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('deposit'));
    const amountIdx = headers.findIndex(h => h === 'amount' || h === 'amt');

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

    const ddmmyyyy = cleanDate.match(/(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    const ddmmyy = cleanDate.match(/(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2})/);
    if (ddmmyy) {
      const day = ddmmyy[1].padStart(2, '0');
      const month = ddmmyy[2].padStart(2, '0');
      const year = `20${ddmmyy[3]}`;
      return `${year}-${month}-${day}`;
    }

    const yyyymmdd = cleanDate.match(/(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})/);
    if (yyyymmdd) {
      const year = yyyymmdd[1];
      const month = yyyymmdd[2].padStart(2, '0');
      const day = yyyymmdd[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return new Date().toISOString().split('T')[0];
  }
}
