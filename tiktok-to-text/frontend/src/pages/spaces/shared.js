// Dùng chung cho màn Kho & chia sẻ (SCR-19): ai mở được khung quản lý, link nạp nguồn chọn sẵn kho, nhãn quyền.

// Mở khung quản lý: chủ kho, hoặc người được cấp quyền kho theo đơn vị (quản trị viên — BE trả can_share_units)
export const canManage = (s) => s.my_role === 'owner' || !!s.can_share_units

export const addSourceHref = (s) => `/kb?add=1&space_id=${s.id}`

// Quyền cấp cho người / đơn vị (quyền Quản lý chỉ chủ kho — không cấp được)
export const GRANT_ROLES = [
  { value: 'viewer', label: 'Xem', hint: 'Đọc thẻ, tư liệu, bản chữ video; đề xuất sửa thẻ' },
  { value: 'editor', label: 'Sửa', hint: 'Nạp nguồn, tạo và sửa thẻ, duyệt đề xuất trong kho' },
]
export const ROLE_LABEL = { owner: 'Quản lý', editor: 'Sửa', viewer: 'Xem' }
