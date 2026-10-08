/**
 * Text folding for comparing and searching Vietnamese names: no accents, lower case, single spaces
 * ("Nhân viên  Kinh doanh" and "nhan vien kinh doanh" are the same name, 04 VH-ORG-02 bước 2; VH-NSU-07 bước 2).
 */
export function foldName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trims and collapses inner spaces before a name is stored. */
export function tidyName(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
