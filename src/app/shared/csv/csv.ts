/** Egy CSV-mező: pontosvesszős (magyar Excel) formátum, idézőjelezve ha kell; a képlettel kezdődő szöveg aposztrófot kap (CSV-injekció). */
function field(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? String(value).replace('.', ',') : value;
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A táblázat CSV-szövege (BOM nélkül), CRLF sorvégekkel. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(field).join(';')).join('\r\n');
}

/** A táblázat letöltése UTF-8 BOM-mal, hogy az Excel az ékezeteket helyesen nyissa meg. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]): void {
  const blob = new Blob(['﻿' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
