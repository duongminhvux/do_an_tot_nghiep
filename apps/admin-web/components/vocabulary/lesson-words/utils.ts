import * as XLSX from 'xlsx';
import { ParseWordsResult } from './types';

/** Clean a token and check if it's a valid word string */
export function cleanWordToken(raw: string): string | null {
  if (!raw) return null;
  let word = raw.trim();
  // Strip leading numbering or bullet points like "1. ", "1) ", "1 - ", "- ", "* ", "• "
  word = word.replace(/^(\d+[\.\)\-:\s/]+|[\-\*\•\–\—\>]\s*)/, '').trim();
  // Strip quotes and punctuation at boundary
  word = word
    .replace(/^["'“”‘’\(\)\[\]{}.,:;!?]+|["'“”‘’\(\)\[\]{}.,:;!?]+$/g, '')
    .trim()
    .toLowerCase();

  // If empty or purely numeric or purely punctuation/special characters
  if (!word || word.length === 0 || /^\d+$/.test(word) || /^[^a-zA-Z0-9]+$/.test(word)) {
    return null;
  }
  return word;
}

/** Parse plain text containing words separated by comma, semicolon, newline, or tabs */
export function parseTextToWordsDetailed(text: string): ParseWordsResult {
  if (!text || !text.trim()) {
    return { words: [], duplicates: [], skipped: [], rawCount: 0 };
  }
  // Split by line or delimiter
  const rawTokens = text
    .split(/[\n\r]+/)
    .flatMap((line) => line.split(/[,;\t]+/))
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const seen = new Set<string>();
  const duplicatesSet = new Set<string>();
  const words: string[] = [];
  const skipped: string[] = [];

  for (const raw of rawTokens) {
    const cleaned = cleanWordToken(raw);
    if (!cleaned) {
      if (raw.length > 0 && !/^\d+$/.test(raw)) {
        skipped.push(raw);
      }
      continue;
    }
    if (seen.has(cleaned)) {
      duplicatesSet.add(cleaned);
    } else {
      seen.add(cleaned);
      words.push(cleaned);
    }
  }

  return {
    words,
    duplicates: Array.from(duplicatesSet),
    skipped: Array.from(new Set(skipped)),
    rawCount: rawTokens.length,
  };
}

/** Parse an Excel (.xlsx) or CSV (.csv) file and extract words with detailed metadata */
export async function parseFileToWordsDetailed(file: File): Promise<ParseWordsResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve({ words: [], duplicates: [], skipped: [], rawCount: 0 });
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          resolve({ words: [], duplicates: [], skipped: [], rawCount: 0 });
          return;
        }
        const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (!json || json.length === 0) {
          resolve({ words: [], duplicates: [], skipped: [], rawCount: 0 });
          return;
        }

        // Try to identify header row and word column index
        let wordColIdx = 0;
        let startRowIdx = 0;
        const firstRow = json[0] || [];
        const headerKeywords = ['word', 'words', 'vocabulary', 'vocab', 'từ', 'từ vựng', 'tiếng anh', 'english'];

        for (let colIdx = 0; colIdx < firstRow.length; colIdx++) {
          const colHeader = String(firstRow[colIdx] || '').trim().toLowerCase();
          if (headerKeywords.includes(colHeader)) {
            wordColIdx = colIdx;
            startRowIdx = 1;
            break;
          }
        }

        // If first column is purely numeric STT/ID and 2nd column exists, use 2nd column
        if (wordColIdx === 0 && startRowIdx === 0 && json.length > 1) {
          const firstCell = String(json[0]?.[0] || '').trim().toLowerCase();
          if (['stt', 'no', 'no.', 'id', '#'].includes(firstCell) || /^\d+$/.test(firstCell)) {
            wordColIdx = 1;
            if (['stt', 'no', 'no.', 'id', '#'].includes(firstCell)) {
              startRowIdx = 1;
            }
          }
        }

        const words: string[] = [];
        const duplicatesSet = new Set<string>();
        const skipped: string[] = [];
        const seen = new Set<string>();
        let rawCount = 0;

        for (let r = startRowIdx; r < json.length; r++) {
          const row = json[r];
          if (!row || row.length === 0) continue;
          let cell = row[wordColIdx];
          // Fallback: if cell is empty or numeric, try finding first non-numeric cell in the row
          if (cell == null || String(cell).trim() === '' || /^\d+$/.test(String(cell).trim())) {
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || '').trim();
              if (val && !/^\d+$/.test(val)) {
                cell = val;
                break;
              }
            }
          }
          if (cell == null) continue;
          const rawCellStr = String(cell).trim();
          if (!rawCellStr) continue;

          // In case a cell contains multiple words separated by comma or semicolon
          const cellParts = rawCellStr.split(/[,;\n\r\t]+/).filter((p) => p.trim().length > 0);
          for (const part of cellParts) {
            rawCount++;
            const word = cleanWordToken(part);
            if (!word) {
              if (part.length > 0 && !/^\d+$/.test(part)) {
                skipped.push(part);
              }
              continue;
            }
            if (seen.has(word)) {
              duplicatesSet.add(word);
            } else {
              seen.add(word);
              words.push(word);
            }
          }
        }

        resolve({
          words,
          duplicates: Array.from(duplicatesSet),
          skipped: Array.from(new Set(skipped)),
          rawCount,
        });
      } catch {
        reject(new Error('Parse error'));
      }
    };
    reader.onerror = () => reject(new Error('Read error'));
    reader.readAsArrayBuffer(file);
  });
}
