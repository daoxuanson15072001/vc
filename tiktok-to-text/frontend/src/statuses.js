// Bảng nhãn trạng thái dùng chung (DESIGN V.5 CMP-14, V.8 "Mã nội bộ"): mã → { label, tone } cho mọi collection.
// Giao diện không hiện slug / mã thô; tone là một trong good · bad · warn · info · brand · muted (màu chỉ bổ trợ).
// UI-2: gom bảng có sẵn ở format.js; mỗi màn thêm bảng của mình vào ĐÚNG khối có tên màn bên dưới (tránh xung đột).
import { CARD_STATUS, CLUSTER_STATUS, DOC_STATUS, SOURCE_STATUS, SYNTH_STATUS, VIDEO_STATUS } from './format.js'

export const STATUSES = {
  source: SOURCE_STATUS,
  doc: DOC_STATUS,
  video: VIDEO_STATUS,
  synth: SYNTH_STATUS,
  cluster: CLUSTER_STATUS,
  card: { ...CARD_STATUS, rejected: { label: 'Từ chối', tone: 'muted' } },   // V.8: "Từ chối" thay "Loại"
  // --- SCR-03/04 Kho tư liệu + Tiến độ tinh chế ---
  // Ô lọc «Trạng thái» ở tab Nguồn (giá trị gửi GET /kb/sources?status=, nhiều mã cách dấu phẩy)
  kbSourceFilter: {
    '': { label: 'Mọi trạng thái', tone: 'muted' },
    'queued,extracting': { label: 'Đang chờ / chuyển chữ', tone: 'info' },
    extracted: { label: 'Đã chuyển chữ', tone: 'good' },
    error: { label: 'Lỗi', tone: 'bad' },
    cancelled: { label: 'Đã dừng', tone: 'muted' },
  },
  // Kết nối luồng trực tiếp (SSE) ở Tiến độ tinh chế › Trực tiếp
  refineConn: {
    connecting: { label: 'Đang kết nối…', tone: 'muted' },
    live: { label: 'Trực tiếp', tone: 'good' },
    lost: { label: 'Mất kết nối — đang nối lại', tone: 'warn' },
  },
  // --- /SCR-03/04 ---
  // --- SCR-06 VCWIKI ---
  // --- /SCR-06 ---
  // --- SCR-09 Hộp duyệt ---
  // trạng thái đề xuất sửa thẻ (change_requests.status — backend/app/kb/changes.py)
  change: {
    open: { label: 'Đang mở', tone: 'info' },   // warn trên nền warn-soft 12px chỉ 4,36:1 (token) — dùng info
    needs_rebase: { label: 'Cần cập nhật', tone: 'bad' },
    approved: { label: 'Đã duyệt', tone: 'good' },
    rejected: { label: 'Từ chối', tone: 'muted' },
    withdrawn: { label: 'Đã rút', tone: 'muted' },
  },
  // cờ trên đề xuất đang mở (GOV-13 — change_requests.returned): người duyệt trả về, chờ người đề xuất sửa + gửi lại
  changeFlag: {
    returned: { label: 'Cần sửa', tone: 'bad' },
  },
  // kết quả cổng so sánh (novelty.verdict)
  novelty: {
    new: { label: 'Mới', tone: 'good' },
    duplicate: { label: 'Trùng', tone: 'muted' },
    supplement: { label: 'Bổ sung', tone: 'info' },
    conflict: { label: 'Mâu thuẫn', tone: 'bad' },
    noise: { label: 'Nhiễu', tone: 'muted' },
  },
  // Duyệt hàng loạt: tag hệ thống bị loại mặc định (apply_v2.LOW_TAG / UNSORTED_TAG) — không hiện slug
  bulkTag: {
    'xem-lai-phan-loai': { label: 'độ tin cậy phân loại thấp', tone: 'warn' },
    'chua-xep-v2': { label: 'chưa xếp vào cây lĩnh vực mới', tone: 'warn' },
  },
  // Duyệt hàng loạt: lý do bỏ qua (bulk_review.assess — câu BE) → chữ ngắn cho người duyệt
  bulkSkip: {
    'Đề xuất cần cập nhật (rebase)': { label: 'Đề xuất cần cập nhật lên bản mới', tone: 'bad' },
    'Cổng so sánh xếp NHIỄU': { label: 'Cổng so sánh xếp Nhiễu', tone: 'muted' },
    'Cổng so sánh xếp TRÙNG': { label: 'Cổng so sánh xếp Trùng', tone: 'muted' },
    'Chưa có kết quả cổng so sánh': { label: 'Chưa có kết quả cổng so sánh', tone: 'muted' },
    'Bạn là tác giả (bốn mắt)': { label: 'Bạn là tác giả (không tự duyệt)', tone: 'muted' },
    'Đề xuất đã trả về người đề xuất (chờ gửi lại)': { label: 'Đã trả về, chờ người đề xuất gửi lại', tone: 'muted' },
    'Bạn không phải người duyệt của thẻ này': { label: 'Bạn không phải người duyệt của thẻ này', tone: 'muted' },
    'Không còn là thẻ nháp khớp bộ lọc': { label: 'Không còn là thẻ nháp khớp bộ lọc', tone: 'muted' },
  },
  // --- /SCR-09 ---
  // --- SCR-15/17 Học tập của tôi, làm bài, chấm bài ---
  learnAssign: {
    assigned: { label: 'Chưa bắt đầu', tone: 'muted' },
    in_progress: { label: 'Đang học', tone: 'info' },
    completed: { label: 'Hoàn thành', tone: 'good' },
    overdue: { label: 'Quá hạn', tone: 'bad' },
  },
  learnGrade: {
    pending: { label: 'Chờ chốt', tone: 'warn' },
    finalized: { label: 'Đã chốt', tone: 'good' },
  },
  learnPass: {
    pass: { label: 'Đạt', tone: 'good' },
    fail: { label: 'Chưa đạt', tone: 'bad' },
  },
  // --- /SCR-15/17 ---
  // --- SCR-16 Thư viện, bài học ---
  // trạng thái bài học (lessons.status — backend/app/learn/routes.py); nháp dùng info (warn 12px chưa đạt 4,5:1)
  lesson: {
    draft: { label: 'Nháp', tone: 'info' },
    published: { label: 'Đã phát hành', tone: 'good' },
    stale: { label: 'Cần cập nhật', tone: 'bad' },
  },
  // trạng thái câu hỏi trong ngân hàng (questions.status)
  question: {
    draft: { label: 'Nháp', tone: 'info' },
    approved: { label: 'Đã duyệt', tone: 'good' },
    stale: { label: 'Lỗi thời', tone: 'bad' },
  },
  // --- /SCR-16 ---
  // --- SCR-16b Lộ trình, thiết kế lộ trình ---
  // --- /SCR-16b ---
  // --- SCR-18 Cơ cấu tổ chức ---
  // Người trong đơn vị (users.org.status + users.active — backend/app/org.py, auth.py)
  orgPerson: {
    active: { label: 'Đang làm', tone: 'good' },
    locked: { label: 'Đã khoá', tone: 'bad' },
    left: { label: 'Đã nghỉ', tone: 'muted' },
  },
  // Đơn vị, chức năng (org_units.active, org_functions.active)
  orgActive: {
    active: { label: 'Đang dùng', tone: 'good' },
    hidden: { label: 'Đã ẩn', tone: 'muted' },
  },
  // Vai trò chức năng (grants: revoked_at, upcoming, active)
  orgGrant: {
    active: { label: 'Đang hiệu lực', tone: 'good' },
    upcoming: { label: 'Sắp hiệu lực', tone: 'info' },
    ended: { label: 'Đã hết hạn', tone: 'muted' },
    revoked: { label: 'Đã thu hồi', tone: 'bad' },
  },
  // Kết quả từng dòng khi nhập cơ cấu (org.import_org — action)
  orgImport: {
    create: { label: 'Tạo mới', tone: 'info' },
    update: { label: 'Cập nhật', tone: 'good' },
    unchanged: { label: 'Giữ nguyên', tone: 'muted' },
    error: { label: 'Lỗi', tone: 'bad' },
  },
  // --- /SCR-18 ---
  // --- SCR-19 Kho & chia sẻ ---
  // vai trò hiệu lực của mình trong kho (spaces.my_role — cao nhất giữa mời riêng, qua đơn vị, công khai)
  spaceRole: {
    owner: { label: 'Chủ kho', tone: 'good' },
    editor: { label: 'Được sửa', tone: 'info' },
    viewer: { label: 'Chỉ xem', tone: 'muted' },
  },
  spaceVisibility: {
    org: { label: 'Công khai trong công ty', tone: 'info' },
    private: { label: 'Riêng tư', tone: 'muted' },
  },
  // --- /SCR-19 ---
  // --- SCR-21 Người dùng & lĩnh vực ---
  // --- /SCR-21 ---
}

// { label, tone } của một mã; mã lạ → chữ "Không rõ (<mã>)" để không lộ slug trơn mà vẫn tra được
export function statusInfo(kind, status) {
  const hit = STATUSES[kind]?.[status]
  if (hit) return hit
  return { label: status ? `Không rõ (${status})` : '—', tone: 'muted' }
}
