/** "Xuất Excel" of a catalog tab (kế hoạch GĐ B mục 5.2 `GET …/{type}.xlsx`): every entry, Vietnamese headers. */
import { CATALOG_INFO, CATALOG_STATUS_LABEL, PROVINCES, TITLE_LEVELS, WORK_LOCATION_KINDS, type CatalogType } from '@vc/contracts';
import ExcelJS from 'exceljs';
import type { CatalogView } from './catalog.service';
import type { InUse } from './usage';

type Row = CatalogView & { usage: InUse };
type Col = { header: string; width: number; value: (r: Row & Record<string, unknown>) => string | number };

const status = (r: Row) => CATALOG_STATUS_LABEL[r.status];
const COLUMNS: Record<CatalogType, Col[]> = {
  'job-titles': [
    { header: 'Mã', width: 16, value: (r) => r.code },
    { header: 'Tên', width: 32, value: (r) => r.name },
    { header: 'Cấp bậc', width: 24, value: (r) => `${r.level} · ${TITLE_LEVELS[r.level as number] ?? ''}` },
    { header: 'Chức năng mặc định', width: 20, value: (r) => String(r.default_function_code) },
    { header: 'Gợi ý là quản lý', width: 16, value: (r) => (r.suggest_manager ? 'Có' : 'Không') },
    { header: 'Trạng thái', width: 12, value: status },
    { header: 'Số người đang giữ', width: 18, value: (r) => r.usage.positions },
    { header: 'Mô tả', width: 40, value: (r) => String(r.description ?? '') },
  ],
  'job-functions': [
    { header: 'Mã', width: 16, value: (r) => r.code },
    { header: 'Tên', width: 28, value: (r) => r.name },
    { header: 'Trạng thái', width: 12, value: status },
    { header: 'Số vị trí đang dùng', width: 18, value: (r) => r.usage.positions },
    { header: 'Mô tả', width: 40, value: (r) => String(r.description ?? '') },
  ],
  'legal-entities': [
    { header: 'Mã', width: 14, value: (r) => r.code },
    { header: 'Tên đầy đủ', width: 40, value: (r) => r.name },
    { header: 'Tên ngắn', width: 16, value: (r) => String(r.short_name) },
    { header: 'Mã số thuế', width: 18, value: (r) => String(r.tax_code) },
    { header: 'Địa chỉ trụ sở', width: 40, value: (r) => String(r.hq_address) },
    { header: 'Domain email', width: 24, value: (r) => (r.email_domains as string[]).join(', ') },
    { header: 'Trạng thái', width: 12, value: status },
    { header: 'Từ ngày', width: 12, value: (r) => String(r.status_from) },
  ],
  'work-locations': [
    { header: 'Mã', width: 16, value: (r) => r.code },
    { header: 'Tên', width: 28, value: (r) => r.name },
    { header: 'Loại', width: 16, value: (r) => WORK_LOCATION_KINDS[r.kind as keyof typeof WORK_LOCATION_KINDS] ?? String(r.kind) },
    { header: 'Địa chỉ', width: 40, value: (r) => String(r.address) },
    { header: 'Tỉnh, thành', width: 16, value: (r) => PROVINCES[r.province as keyof typeof PROVINCES] ?? String(r.province) },
    { header: 'Pháp nhân quản lý', width: 18, value: (r) => (r.legal_entity_code as string | null) ?? 'Dùng chung' },
    { header: 'Trạng thái', width: 12, value: status },
    { header: 'Số nhân viên', width: 14, value: (r) => r.usage.people },
  ],
};

export async function catalogXlsx(type: CatalogType, rows: Row[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(CATALOG_INFO[type].label);
  const cols = COLUMNS[type];
  ws.columns = cols.map((c) => ({ header: c.header, width: c.width }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(cols.map((c) => c.value(r as Row & Record<string, unknown>)));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
