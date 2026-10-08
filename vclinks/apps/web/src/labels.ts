import type { MappingStatus, Stream } from '@vclinks/shared';

export const STREAM_ORDER: Stream[] = ['contacts', 'groups', 'conversations', 'messages', 'reactions', 'labels', 'read_state'];

export const STREAM_LABEL: Record<Stream, string> = {
  contacts: 'Danh bạ',
  groups: 'Nhóm',
  conversations: 'Hội thoại',
  messages: 'Tin nhắn',
  reactions: 'Cảm xúc',
  labels: 'Thẻ phân loại',
  read_state: 'Đã đọc',
};

export const MAPPING_STATUS: Record<MappingStatus, { label: string; color: string }> = {
  proposed: { label: 'Chờ duyệt', color: 'gold' },
  active: { label: 'Đang áp dụng', color: 'green' },
  rejected: { label: 'Đã từ chối', color: 'red' },
  superseded: { label: 'Đã thay thế', color: 'default' },
};

export const DRIFT_KIND: Record<string, string> = {
  missing_db: 'Thiếu DB',
  missing_store: 'Thiếu store',
  missing_fields: 'Thiếu trường',
  type_mismatch: 'Sai kiểu dữ liệu',
  encrypted: 'Dữ liệu bị mã hóa',
  dom_selectors: 'Giao diện Zalo đổi (selector DOM)',
};
