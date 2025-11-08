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

interface ColumnDefinition {
  name: string;
  xStart: number;
  xEnd: number;
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
        .map(([y, items]) => {
          const sortedItems = items.sort((a, b) => a.x - b.x);
          return { y, items: sortedItems };
        });

      for (const { items } of sortedLines) {
        const lineText = items.map(item => item.str).join(' ').trim();
        fullText += lineText + '\n';
      }
    }

    return fullText;
  }

  async parseExcel(file: File): Promise<ParsedTransaction[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    console.log('Excel Parser: Sheet names:', workbook.SheetNames);

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

    console.log(`Excel Parser: Found ${data.length} rows`);

    if (data.length === 0) {
      throw new Error('Excel file is empty');
    }

    console.log('Excel Parser: Headers:', data[0]);

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
    const amountIdx = headers.findIndex(h => h === 'amount' || h.includes('amount'));

    console.log('Excel Parser: Column indices:', { dateIdx, descIdx, debitIdx, creditIdx, amountIdx });

    if (dateIdx === -1) {
      throw new Error('Excel file must have a Date column. Found headers: ' + headers.join(', '));
    }

    if (descIdx === -1) {
      throw new Error('Excel file must have a Description/Narration column. Found headers: ' + headers.join(', '));
    }

    if (debitIdx === -1 && creditIdx === -1 && amountIdx === -1) {
      throw new Error('Excel file must have Debit, Credit, or Amount column. Found headers: ' + headers.join(', '));
    }

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const warnings: string[] = [];

      const dateValue = row[dateIdx];
      if (!dateValue) continue;

      const date = this.parseExcelDate(dateValue);

      let description = descIdx >= 0 ? String(row[descIdx] || '').trim() : '';
      if (!description || description.length < 2) continue;

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

      if (amount <= 0 || isNaN(amount)) {
        console.warn(`PDF Parser: Skipping line with invalid amount: ${amount}`);
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

    console.log(`Excel Parser: Extracted ${transactions.length} transactions`);

    if (transactions.length === 0) {
      console.warn('Excel Parser: No valid transactions found. Sample rows:');
      data.slice(0, 5).forEach((row, idx) => {
        console.log(`Row ${idx}:`, row);
      });
      throw new Error('No valid transactions found in Excel file. Check console for details.');
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
      console.warn('PDF Parser: No lines found in text');
      return [];
    }

    console.log(`PDF Parser: Processing ${lines.length} lines`);
    console.log('PDF Parser: First 10 lines:', lines.slice(0, 10));

    let headerLine = -1;
    let columns: ColumnDefinition[] = [];

    // Try to find header line with various patterns
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i].toLowerCase();

      // More flexible header detection
      const hasDate = line.includes('date') || line.includes('txn') || line.includes('transaction');
      const hasDescription = line.includes('particulars') || line.includes('description') ||
                            line.includes('narration') || line.includes('details') ||
                            line.includes('remarks');
      const hasAmount = line.includes('debit') || line.includes('credit') ||
                       line.includes('withdrawal') || line.includes('deposit') ||
                       line.includes('amount') || line.includes('dr') || line.includes('cr');

      if (hasDate && (hasDescription || hasAmount)) {
        headerLine = i;
        console.log(`PDF Parser: Found header at line ${i}: ${lines[i]}`);
        break;
      }
    }

    if (headerLine === -1) {
      console.warn('PDF Parser: No header found, will try to parse all lines');
      headerLine = 0; // Start from beginning if no clear header
    }

    const datePattern = /\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}|\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}|\d{2}[-/\s][A-Za-z]{3}[-/\s]\d{2,4})\b/;

    console.log(`PDF Parser: Starting transaction parsing from line ${headerLine + 1}`);

    let linesProcessed = 0;
    let linesWithDates = 0;
    let linesWithValidAmounts = 0;

    for (let i = headerLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || line.trim().length < 10) continue;

      linesProcessed++;

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
        lineLower.match(/^page\s+\d+/)
      ) {
        continue;
      }

      const dateMatch = line.match(datePattern);
      if (!dateMatch) {
        // Try to extract transaction without strict date requirement
        // This helps with statements that have dates in different formats
        if (linesProcessed <= 5) {
          console.log(`PDF Parser: Line ${i} has no date:`, line);
        }
        continue;
      }

      linesWithDates++;

      const warnings: string[] = [];
      const date = this.parseDate(dateMatch[0]);

      const parts = line.split(/\s{2,}/);

      if (parts.length < 3) {
        continue;
      }

      let description = '';
      let debitAmount = 0;
      let creditAmount = 0;
      let balance = 0;

      const amountPattern = /^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^\d+\.\d{1,2}$/;

      const amounts: number[] = [];
      const nonAmountParts: string[] = [];

      for (const part of parts) {
        const cleanPart = part.trim();
        if (!cleanPart) continue;

        if (datePattern.test(cleanPart)) {
          continue;
        }

        const cleanAmount = cleanPart.replace(/,/g, '');
        if (amountPattern.test(cleanAmount)) {
          const amt = parseFloat(cleanAmount);
          if (amt > 0 && amt < 100000000) {
            amounts.push(amt);
          }
        } else {
          const withoutMarkers = cleanPart.replace(/\b(DR|CR|Dr|Cr)\b/g, '').trim();
          if (withoutMarkers.length > 0) {
            nonAmountParts.push(withoutMarkers);
          }
        }
      }

      description = nonAmountParts.join(' ').trim();

      if (description.length < 2) {
        continue;
      }

      if (description.length > 200) {
        description = description.substring(0, 200).trim();
      }

      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';
      let confidence = 0.7;

      const hasCreditMarker =
        /\bCR\b/.test(line) ||
        lineLower.includes('credit') ||
        lineLower.includes('deposit') ||
        lineLower.includes('credited') ||
        lineLower.includes('received');

      const hasDebitMarker =
        /\bDR\b/.test(line) ||
        lineLower.includes('debit') ||
        lineLower.includes('withdrawal') ||
        lineLower.includes('debited') ||
        lineLower.includes('paid');

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
          warnings.push('Transaction type unclear');
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
          amount = amounts[0];
          type = 'debit';
          confidence = 0.7;
          warnings.push('Multiple amounts - using first');
        }
      } else if (amounts.length >= 3) {
        if (hasCreditMarker && !hasDebitMarker) {
          type = 'credit';
          amount = amounts[1];
          confidence = 0.75;
        } else if (hasDebitMarker && !hasCreditMarker) {
          type = 'debit';
          amount = amounts[0];
          confidence = 0.75;
        } else {
          amount = amounts[0];
          type = 'debit';
          confidence = 0.65;
          warnings.push('Multiple amounts detected');
        }
      }

      if (amount <= 0 || isNaN(amount)) {
        if (linesWithDates <= 5) {
          console.log(`PDF Parser: Line ${i} has invalid amount:`, amount, 'from amounts:', amounts);
        }
        continue;
      }

      linesWithValidAmounts++;

      const parsedDate = new Date(date);
      const now = new Date();
      const threeYearsAgo = new Date(now.getFullYear() - 3, 0, 1);
      const oneYearFuture = new Date(now.getFullYear() + 1, 11, 31);

      if (parsedDate < threeYearsAgo || parsedDate > oneYearFuture) {
        warnings.push('Date seems unusual');
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
    }

    console.log(`PDF Parser: Extracted ${transactions.length} transactions`);
    console.log(`PDF Parser: Stats - Lines processed: ${linesProcessed}, Lines with dates: ${linesWithDates}, Lines with valid amounts: ${linesWithValidAmounts}`);

    if (transactions.length === 0) {
      console.warn('PDF Parser: No transactions extracted.');
      console.warn('PDF Parser: Showing first 20 lines after header:');
      lines.slice(headerLine + 1, headerLine + 21).forEach((line, idx) => {
        console.log(`Line ${headerLine + 1 + idx}: ${line}`);
      });
    }

    return transactions;
  }

  parseCSV(content: string): ParsedTransaction[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      console.warn('CSV Parser: No lines found');
      return [];
    }

    console.log(`CSV Parser: Processing ${lines.length} lines`);

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('CSV Parser: Headers found:', headers);

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
    const amountIdx = headers.findIndex(h =>
      h === 'amount' || h === 'amt' || h.includes('amount')
    );

    console.log('CSV Parser: Column indices:', { dateIdx, descIdx, debitIdx, creditIdx, amountIdx });

    if (dateIdx === -1) {
      console.warn('CSV Parser: No date column found. Looking for any date-like patterns...');
      // Try to proceed anyway and look for dates in the data
    }

    if (descIdx === -1) {
      console.warn('CSV Parser: No description column found. Will use first text column...');
    }

    if (debitIdx === -1 && creditIdx === -1 && amountIdx === -1) {
      console.error('CSV Parser: No amount columns found');
      throw new Error('CSV file must have Debit, Credit, or Amount column. Found headers: ' + headers.join(', '));
    }

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));

      if (parts.length < headers.length - 1) continue;

      const warnings: string[] = [];

      const date = dateIdx >= 0 ? this.parseDate(parts[dateIdx]) : new Date().toISOString().split('T')[0];
      let description = descIdx >= 0 ? parts[descIdx] : '';

      if (!description || description.length < 2) continue;

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

    console.log(`CSV Parser: Extracted ${transactions.length} transactions`);

    if (transactions.length === 0) {
      console.warn('CSV Parser: No valid transactions found. Sample rows:');
      lines.slice(0, 5).forEach((line, idx) => {
        console.log(`Row ${idx}: ${line}`);
      });
      throw new Error('No valid transactions found in CSV file. Check console for details.');
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
