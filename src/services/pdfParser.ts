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

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
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

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const items = textContent.items as any[];
      const pageLines: Map<number, TextItem[]> = new Map();

      items.forEach((item) => {
        if (item.str.trim()) {
          const y = Math.round(item.transform[5]);
          const x = Math.round(item.transform[4]);

          if (!pageLines.has(y)) {
            pageLines.set(y, []);
          }

          pageLines.get(y)!.push({
            str: item.str,
            x: x,
            y: y,
            width: item.width || 0
          });
        }
      });

      const sortedLines = Array.from(pageLines.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([_, items]) => {
          const sortedItems = items.sort((a, b) => a.x - b.x);
          return sortedItems.map(item => item.str).join(' ').trim();
        })
        .filter(line => line.length > 0);

      const pageText = sortedLines.join('\n');
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
    let debitColKeywords: string[] = [];
    let creditColKeywords: string[] = [];

    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i].toLowerCase();

      if (line.includes('date') &&
          (line.includes('debit') || line.includes('credit') ||
           line.includes('withdrawal') || line.includes('deposit') ||
           line.includes('amount') || line.includes('particulars') ||
           line.includes('narration'))) {

        headerEndIndex = i + 1;
        foundHeader = true;

        if (line.includes('withdrawal') || line.match(/\bdr\b/) || line.includes('debit')) {
          debitColKeywords.push('withdrawal', 'dr', 'debit');
        }
        if (line.includes('deposit') || line.match(/\bcr\b/) || line.includes('credit')) {
          creditColKeywords.push('deposit', 'cr', 'credit');
        }

        break;
      }
    }

    const dataLines = lines.slice(foundHeader ? headerEndIndex : 0);

    const datePattern = /\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}|\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}|\d{2}[-/\s][A-Za-z]{3}[-/\s]\d{2,4})\b/;

    let i = 0;
    while (i < dataLines.length) {
      const line = dataLines[i];
      if (!line.trim() || line.trim().length < 8) {
        i++;
        continue;
      }

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
        lineLower.includes('statement summary') ||
        lineLower.match(/^page\s+\d+/) ||
        lineLower.includes('continued on next page') ||
        lineLower.includes('continued from previous')
      ) {
        i++;
        continue;
      }

      const dateMatch = line.match(datePattern);
      if (!dateMatch) {
        i++;
        continue;
      }

      const date = this.parseDate(dateMatch[0]);
      const warnings: string[] = [];

      let description = '';
      let descriptionLines: string[] = [];

      let currentLine = line;
      descriptionLines.push(currentLine);

      for (let j = i + 1; j < Math.min(i + 5, dataLines.length); j++) {
        const nextLine = dataLines[j];
        const nextLineLower = nextLine.toLowerCase();

        if (nextLine.match(datePattern)) {
          break;
        }

        if (nextLineLower.includes('opening balance') ||
            nextLineLower.includes('closing balance') ||
            nextLineLower.includes('total debit') ||
            nextLineLower.includes('total credit')) {
          break;
        }

        const hasAmount = /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/.test(nextLine);
        if (!hasAmount && nextLine.trim().length > 0 && nextLine.trim().length < 100) {
          descriptionLines.push(nextLine);
        } else {
          break;
        }
      }

      const fullText = descriptionLines.join(' ');

      const amounts: number[] = [];
      let match;
      const amountPattern = /(?:^|\s)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+\.\d{1,2}|\d{4,})(?:\s|$)/g;

      while ((match = amountPattern.exec(fullText)) !== null) {
        const cleanAmount = match[1].replace(/,/g, '');
        const amt = parseFloat(cleanAmount);
        if (amt > 0.01 && amt < 100000000) {
          amounts.push(amt);
        }
      }

      if (amounts.length === 0) {
        i++;
        continue;
      }

      description = fullText
        .replace(datePattern, '')
        .replace(/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      description = description
        .replace(/\b(dr|cr|DR|CR)\b/gi, '')
        .replace(/[^\w\s\-\/.,()]/g, '')
        .trim();

      if (description.length > 200) {
        description = description.substring(0, 200).trim();
      }

      if (description.length < 3) {
        i++;
        continue;
      }

      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';
      let confidence = 0.7;

      const hasCreditMarker =
        /\bCR\b/i.test(fullText) ||
        lineLower.includes('credit') ||
        lineLower.includes('deposit') ||
        lineLower.includes('received') ||
        lineLower.includes('salary') ||
        lineLower.includes('refund') ||
        lineLower.includes('interest credited');

      const hasDebitMarker =
        /\bDR\b/i.test(fullText) ||
        lineLower.includes('debit') ||
        lineLower.includes('withdrawal') ||
        lineLower.includes('withdraw') ||
        lineLower.includes('payment') ||
        lineLower.includes('purchase') ||
        lineLower.includes('transfer to') ||
        lineLower.includes('paid to');

      if (amounts.length === 1) {
        amount = amounts[0];

        if (hasCreditMarker && !hasDebitMarker) {
          type = 'credit';
          confidence = 0.95;
        } else if (hasDebitMarker && !hasCreditMarker) {
          type = 'debit';
          confidence = 0.95;
        } else {
          type = 'debit';
          confidence = 0.6;
          warnings.push('Transaction type unclear - defaulted to debit');
        }

      } else if (amounts.length === 2) {
        if (hasCreditMarker && !hasDebitMarker) {
          type = 'credit';
          amount = amounts[0];
          confidence = 0.85;
        } else if (hasDebitMarker && !hasCreditMarker) {
          type = 'debit';
          amount = amounts[0];
          confidence = 0.85;
        } else {
          const debitColIndex = fullText.toLowerCase().indexOf('debit');
          const creditColIndex = fullText.toLowerCase().indexOf('credit');
          const withdrawalIndex = fullText.toLowerCase().indexOf('withdrawal');
          const depositIndex = fullText.toLowerCase().indexOf('deposit');

          if ((debitColIndex !== -1 || withdrawalIndex !== -1) &&
              (creditColIndex === -1 && depositIndex === -1)) {
            type = 'debit';
            amount = amounts[0];
            confidence = 0.75;
          } else if ((creditColIndex !== -1 || depositIndex !== -1) &&
                     (debitColIndex === -1 && withdrawalIndex === -1)) {
            type = 'credit';
            amount = amounts[0];
            confidence = 0.75;
          } else {
            amount = amounts[0];
            type = 'debit';
            confidence = 0.6;
            warnings.push('Multiple amounts - using first as transaction amount');
          }
        }

      } else if (amounts.length >= 3) {
        if (hasCreditMarker && !hasDebitMarker) {
          type = 'credit';
          amount = amounts[0];
          confidence = 0.75;
        } else if (hasDebitMarker && !hasCreditMarker) {
          type = 'debit';
          amount = amounts[0];
          confidence = 0.75;
        } else {
          const sortedAmounts = [...amounts].sort((a, b) => b - a);
          amount = amounts[0];
          type = 'debit';
          confidence = 0.5;
          warnings.push('Multiple amounts detected - verify transaction amount and type');
        }
      }

      if (amount <= 0 || isNaN(amount)) {
        i++;
        continue;
      }

      const parsedDate = new Date(date);
      const now = new Date();
      const threeYearsAgo = new Date(now.getFullYear() - 3, 0, 1);
      const oneYearFuture = new Date(now.getFullYear() + 1, 11, 31);

      if (parsedDate < threeYearsAgo || parsedDate > oneYearFuture) {
        warnings.push('Date seems unusual - please verify');
        confidence = Math.min(confidence, 0.5);
      }

      transactions.push({
        date,
        description,
        amount,
        type,
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined
      });

      i++;
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
