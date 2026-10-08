import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { MAX_IMPORT_ROWS } from '@vclinks/shared';

export const BAD_FILE_MESSAGE = 'File không đúng mẫu. Tải file mẫu và thử lại.';

export interface TabularRow {
  /** 1-based line in the file; the header is line 1. */
  line: number;
  cells: Record<string, string>;
}

/** Parses CSV text (comma or semicolon, quotes, BOM) into string matrices. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const cellText = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const d = String(v.getUTCDate()).padStart(2, '0');
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${v.getUTCFullYear()}`;
  }
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text; // hyperlink
    if ('result' in v && v.result !== undefined) return cellText(v.result as ExcelJS.CellValue);
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    return '';
  }
  return String(v);
};

async function readXlsx(bytes: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new BadRequestException(BAD_FILE_MESSAGE);
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const cells: string[] = [];
    const width = Math.max(row.cellCount, ws.columnCount);
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value));
    out[n - 1] = cells;
  });
  return Array.from(out, (r) => r ?? []);
}

/**
 * Reads a base64 CSV/xlsx file into rows keyed by header name (lowercased, trimmed).
 * Throws 400 with the spec message when the type, header or size is wrong.
 */
export async function readTable(
  fileName: string,
  contentBase64: string,
  requiredHeaders: readonly string[],
): Promise<TabularRow[]> {
  const bytes = Buffer.from(contentBase64, 'base64');
  const lower = fileName.toLowerCase();
  let matrix: string[][];
  try {
    if (lower.endsWith('.xlsx')) matrix = await readXlsx(bytes);
    else if (lower.endsWith('.csv')) matrix = parseCsv(bytes.toString('utf8'));
    else throw new BadRequestException(BAD_FILE_MESSAGE);
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException(BAD_FILE_MESSAGE);
  }
  const header = (matrix[0] ?? []).map((h) => h.trim().toLowerCase());
  if (!requiredHeaders.every((h) => header.includes(h))) throw new BadRequestException(BAD_FILE_MESSAGE);
  const rows: TabularRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    if (r.every((c) => !String(c ?? '').trim())) continue;
    const cells: Record<string, string> = {};
    header.forEach((h, k) => {
      if (h) cells[h] = String(r[k] ?? '').trim();
    });
    rows.push({ line: i + 1, cells });
  }
  if (!rows.length) throw new BadRequestException('File không có dòng nào. Kiểm tra lại dòng tiêu đề và dữ liệu.');
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new BadRequestException(`File quá ${MAX_IMPORT_ROWS} dòng. Tách thành nhiều file.`);
  }
  return rows;
}

const csvCell = (s: string) => (/[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV with BOM so Excel opens the Vietnamese text correctly. */
export const toCsv = (header: readonly string[], rows: string[][]): Buffer =>
  Buffer.from('﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n', 'utf8');

export async function toXlsx(
  header: readonly string[],
  rows: string[][],
  guide?: { title: string; lines: string[][] },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Dữ liệu');
  ws.addRow([...header]);
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  header.forEach((_, i) => (ws.getColumn(i + 1).width = 22));
  if (guide) {
    const g = wb.addWorksheet('Hướng dẫn');
    g.addRow([guide.title]).font = { bold: true };
    for (const l of guide.lines) g.addRow(l);
    g.getColumn(1).width = 28;
    g.getColumn(2).width = 60;
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** dd/MM/yyyy to a Date at 00:00 Asia/Ho_Chi_Minh, or null when malformed. */
export function parseVnDate(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d, -7, 0, 0));
  const back = new Date(date.getTime() + 7 * 3600_000);
  return back.getUTCDate() === d && back.getUTCMonth() === mo - 1 ? date : null;
}
