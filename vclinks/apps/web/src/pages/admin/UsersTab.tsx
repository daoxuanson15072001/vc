import { PlusOutlined } from '@ant-design/icons';
import { COMPANY_DOMAINS_TEXT, ROLE_LABELS, USER_STATUS_LABELS, isCompanyEmail, type AdminUser, type RoleKey } from '@vclinks/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Drawer, Dropdown, Form, Input, Modal, Select, Space, Switch, Table, Tabs, Tag, message, type SelectProps } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePermissions } from '../../state/permissions';
import { adminApi } from './adminApi';
import EffectiveRightsTab from './EffectiveRightsTab';
import ImportModal from './ImportModal';

const STATUS_COLOR: Record<string, 'success' | 'processing' | 'warning' | 'default'> = {
  hoat_dong: 'success',
  cho_kich_hoat: 'processing',
  tam_khoa: 'warning',
  nghi_viec: 'default',
};

/** MH-PQ-02 list and MH-PQ-03 detail (info + roles and positions). Effective-rights and channel tabs come with M1b-04/06. */
export default function UsersTab() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const perms = usePermissions();
  // `?role=none` (link of "Việc cần làm" and of the Admin notice): people waiting for a role.
  const [search] = useSearchParams();
  const [filters, setFilters] = useState<{ q?: string; role?: string; orgUnitId?: string; status?: string }>(() =>
    search.get('role') ? { role: search.get('role')! } : {},
  );
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const meta = useQuery({ queryKey: ['admin', 'meta'], queryFn: adminApi.meta });
  const units = useQuery({ queryKey: ['admin', 'units'], queryFn: adminApi.units });
  const users = useQuery({
    queryKey: ['admin', 'users', filters, page],
    queryFn: () => adminApi.users({ ...filters, page, pageSize: 20 }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] });
  const unitName = (id: string | null) => units.data?.find((u) => u.id === id)?.name ?? '–';

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e: Error) => message.error(e.message),
  });
  const askReason = (title: string, okText: string, run: (reason: string) => Promise<unknown>) => {
    let reason = '';
    Modal.confirm({
      title,
      okText,
      cancelText: 'Hủy',
      content: <Input.TextArea rows={3} placeholder="Lý do (ít nhất 10 ký tự)" onChange={(e) => (reason = e.target.value)} />,
      onOk: () => (reason.trim().length >= 10 ? run(reason.trim()).then(refresh) : (message.error('Lý do ít nhất 10 ký tự.'), Promise.reject())),
    });
  };

  /** "Đặt cờ Sắp nghỉ…" (PQ-82): expected last day and reason. */
  const askPreLeave = (u: AdminUser) => {
    let date = '';
    let reason = '';
    Modal.confirm({
      title: `Đặt cờ Sắp nghỉ cho ${u.fullName}?`,
      okText: 'Đặt cờ',
      cancelText: 'Hủy',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input type="date" onChange={(e) => (date = e.target.value)} />
          <Input.TextArea rows={3} placeholder="Lý do (ít nhất 10 ký tự)" onChange={(e) => (reason = e.target.value)} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Ngưỡng cảnh báo của người này giảm còn 1/4; mọi lần xuất file và xin quyền tạm thời của họ được báo cho quản lý.</span>
        </Space>
      ),
      onOk: () => {
        if (!date) return (message.error('Chọn ngày nghỉ dự kiến.'), Promise.reject());
        if (reason.trim().length < 10) return (message.error('Lý do ít nhất 10 ký tự.'), Promise.reject());
        return adminApi.setPreLeave(u.id, date, reason.trim()).then(() => { message.success(`Đã đặt cờ Sắp nghỉ cho ${u.fullName}. Ngưỡng cảnh báo của người này đã giảm.`); refresh(); });
      },
    });
  };

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search allowClear placeholder="Tìm tên, email" style={{ width: 220 }} onSearch={(q) => { setPage(1); setFilters((f) => ({ ...f, q: q || undefined })); }} />
        <Select
          allowClear
          placeholder="Vai trò"
          style={{ width: 200 }}
          value={filters.role}
          options={[
            { value: 'none', label: 'Chưa có vai trò' },
            ...(meta.data?.roles.map((r) => ({ value: r.value, label: r.label })) ?? []),
            ...(meta.data?.customRoles ?? []).map((c) => ({ value: c.id, label: `${c.name} (tùy chỉnh)` })),
          ]}
          onChange={(role) => { setPage(1); setFilters((f) => ({ ...f, role })); }}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Đơn vị"
          style={{ width: 220 }}
          options={(units.data ?? []).map((u) => ({ value: u.id, label: u.name }))}
          onChange={(orgUnitId) => { setPage(1); setFilters((f) => ({ ...f, orgUnitId })); }}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          style={{ width: 160 }}
          options={Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(status) => { setPage(1); setFilters((f) => ({ ...f, status })); }}
        />
        <Button onClick={() => setImporting(true)}>Nhập từ file</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDetail('new')}>Thêm người</Button>
      </Space>
      {users.isError && <Alert type="error" showIcon message="Không tải được danh sách người dùng." action={<Button size="small" onClick={() => users.refetch()}>Thử lại</Button>} />}
      <Table<AdminUser>
        rowKey="id"
        loading={users.isLoading}
        dataSource={users.data?.items ?? []}
        locale={{ emptyText: 'Không có người dùng nào khớp bộ lọc.' }}
        pagination={{ current: page, pageSize: 20, total: users.data?.total ?? 0, showSizeChanger: false, onChange: setPage }}
        onRow={(u) => ({ onClick: () => setDetail(u.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Họ tên', dataIndex: 'fullName' },
          { title: 'Email', dataIndex: 'email' },
          {
            title: 'Vai trò',
            render: (_, u) => (
              <Space size={[4, 4]} wrap>
                {u.assignments.map((a) => (
                  <Tag key={a.id}>{a.customRoleName ?? ROLE_LABELS[a.roleKey]}{a.lead ? ' (Trưởng nhóm)' : ''}</Tag>
                ))}
                {u.pending.map((p) => (
                  <Tag key={p.id} color="gold">Chờ duyệt: {p.change.customRoleName ?? ROLE_LABELS[p.change.roleKey]}</Tag>
                ))}
                {!u.assignments.length && !u.pending.length && <Tag color="orange">Chưa có vai trò</Tag>}
              </Space>
            ),
          },
          { title: 'Đơn vị', render: (_, u) => unitName(u.primaryOrgUnitId) },
          {
            title: 'Trạng thái',
            render: (_, u) => (
              <Space size={4} wrap>
                <Badge status={STATUS_COLOR[u.status]} text={USER_STATUS_LABELS[u.status]} />
                {u.preLeave && <Tag color="orange">Sắp nghỉ {u.preLeave.date.slice(8, 10)}/{u.preLeave.date.slice(5, 7)}</Tag>}
              </Space>
            ),
          },
          { title: 'Đăng nhập cuối', dataIndex: 'lastLoginAt', render: (v: string | null) => (v ? new Date(v).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '–') },
          {
            title: '',
            width: 48,
            render: (_, u) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      // UAT-PQ-95: GS sees neither "Nghỉ việc…" nor "Mở khóa"; a locked leaver offers "Tiếp tục bàn giao".
                      ...(u.status === 'tam_khoa' && perms.has('user.lock')
                        ? [{ key: 'unlock', label: 'Mở khóa', onClick: () => act.mutate(() => adminApi.unlock(u.id)) }]
                        : u.status !== 'tam_khoa' && perms.has('user.lock')
                          ? [{ key: 'lock', label: 'Tạm khóa', disabled: u.isSelf || u.status === 'nghi_viec', onClick: () => askReason(`Tạm khóa ${u.fullName}? Người này bị đăng xuất ngay.`, 'Tạm khóa', (r) => adminApi.lock(u.id, r)) }]
                          : []),
                      ...(u.status !== 'nghi_viec' && perms.has('user.pre_leave') && !u.isSelf
                        ? [u.preLeave ? { key: 'preLeaveOff', label: 'Bỏ cờ Sắp nghỉ', onClick: () => act.mutate(() => adminApi.clearPreLeave(u.id)) } : { key: 'preLeave', label: 'Đặt cờ Sắp nghỉ…', onClick: () => askPreLeave(u) }]
                        : []),
                      ...(u.status !== 'nghi_viec' && perms.has('user.offboard')
                        ? [{ key: 'off', label: 'Nghỉ việc…', disabled: u.isSelf, onClick: () => nav(`/admin/users/${encodeURIComponent(u.id)}/offboard`) }]
                        : []),
                      ...(u.status === 'nghi_viec' && perms.has('user.handover')
                        ? [{ key: 'handover', label: 'Tiếp tục bàn giao', onClick: () => nav(`/admin/users/${encodeURIComponent(u.id)}/offboard`) }]
                        : []),
                    ],
                  }}
                >
                  <Button type="text">⋯</Button>
                </Dropdown>
              </span>
            ),
          },
        ]}
      />
      {detail && <UserDrawer id={detail} onClose={() => setDetail(null)} onChanged={refresh} />}
      <ImportModal kind="users" open={importing} onClose={() => setImporting(false)} onDone={refresh} />
    </>
  );
}

function UserDrawer({ id, onClose, onChanged }: { id: string | 'new'; onClose: () => void; onChanged: () => void }) {
  const isNew = id === 'new';
  const perms = usePermissions();
  const meta = useQuery({ queryKey: ['admin', 'meta'], queryFn: adminApi.meta });
  const units = useQuery({ queryKey: ['admin', 'units'], queryFn: adminApi.units });
  const user = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminApi.user(id), enabled: !isNew });
  const [info] = Form.useForm();
  const [role] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const u = user.data;
  const mine = u?.isSelf ?? false;

  // A custom role (`tc_…`) sits where its base role sits.
  const customOf = (value?: string) => meta.data?.customRoles.find((c) => c.id === value);
  const roleUnits = (roleKey?: string) => {
    const need = meta.data?.roles.find((r) => r.value === roleKey)?.unitType ?? customOf(roleKey)?.unitType;
    return (units.data ?? []).filter((x) => x.active && (!need || x.type === need)).map((x) => ({ value: x.id, label: x.name }));
  };

  const fail = (e: unknown) => message.error(`Không lưu được: ${(e as Error).message}`);

  const saveInfo = async () => {
    const v = await info.validateFields();
    setSaving(true);
    try {
      if (isNew) {
        const r = await adminApi.createUser({ email: v.email, fullName: v.fullName, phone: v.phone || undefined, assignments: [] });
        message.success('Đã thêm người. Thêm vai trò ở tab "Vai trò & vị trí".');
        onChanged();
        onClose();
        return r;
      }
      await adminApi.updateUser(id, { fullName: v.fullName, phone: v.phone || null });
      message.success('Đã lưu.');
      void user.refetch();
      onChanged();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const addRole = async (replace = false) => {
    const v = await role.validateFields();
    try {
      const custom = customOf(v.roleKey);
      const pick = custom ? { roleKey: custom.baseRole, customRoleId: custom.id } : { roleKey: v.roleKey as RoleKey };
      const r = await adminApi.addAssignment(id, { ...pick, orgUnitId: v.orgUnitId, lead: !!v.lead }, replace);
      message.success(r.applied ? 'Đã lưu. Quyền mới có hiệu lực trong vòng 1 phút.' : `Đã lưu. ${r.message}`);
      role.resetFields();
      void user.refetch();
      onChanged();
    } catch (e) {
      const text = (e as Error).message;
      if (!replace && text.startsWith('Thay ')) {
        Modal.confirm({ title: text, okText: 'Thay', cancelText: 'Hủy', onOk: () => addRole(true) });
      } else fail(e);
    }
  };

  return (
    <Drawer open width={720} onClose={onClose} title={isNew ? 'Thêm người' : (u?.fullName ?? 'Người dùng')} loading={!isNew && user.isLoading}>
      {user.isError && <Alert type="error" showIcon message="Không tải được thông tin người dùng." />}
      {mine && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Không sửa được quyền của chính bạn." />}
      {u && !u.assignments.length && !u.pending.length && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Người này chưa có vai trò: đăng nhập được nhưng chưa thấy dữ liệu nào. Thêm ít nhất một vai trò." />
      )}
      <Tabs
        items={[
          {
            key: 'info',
            label: 'Thông tin',
            children: (
              <Form form={info} layout="vertical" initialValues={u ? { fullName: u.fullName, email: u.email, phone: u.phone } : undefined} key={u?.id ?? 'new'}>
                <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, min: 2, max: 80, message: 'Họ tên 2–80 ký tự.' }]}><Input /></Form.Item>
                <Form.Item
                  name="email"
                  label="Email công ty"
                  rules={[
                    { required: true, message: 'Nhập email công ty.' },
                    { validator: (_, v) => (!v || isCompanyEmail(v) ? Promise.resolve() : Promise.reject(new Error(`Email phải kết thúc ${COMPANY_DOMAINS_TEXT}.`))) },
                  ]}
                >
                  <Input disabled={!isNew} />
                </Form.Item>
                <Form.Item name="phone" label="SĐT nội bộ" rules={[{ pattern: /^0\d{9}$/, message: 'SĐT nội bộ gồm 10 số, bắt đầu bằng 0.' }]}><Input /></Form.Item>
                <Button type="primary" loading={saving} onClick={() => saveInfo().catch(() => undefined)}>Lưu</Button>
              </Form>
            ),
          },
          {
            key: 'roles',
            label: 'Vai trò & vị trí',
            disabled: isNew,
            children: u && (
              <>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={[...u.assignments]}
                  columns={[
                    { title: 'Vai trò', render: (_, a) => (a.customRoleName ? <i>{a.customRoleName}</i> : ROLE_LABELS[a.roleKey as RoleKey]) },
                    { title: 'Đơn vị', dataIndex: 'orgUnitName' },
                    { title: 'Trưởng nhóm', render: (_, a) => (a.lead ? 'Có' : '–') },
                    {
                      title: '',
                      render: (_, a) => (
                        <Button
                          size="small"
                          disabled={mine}
                          onClick={() =>
                            Modal.confirm({
                              title: `Gỡ vai trò ${a.customRoleName ?? ROLE_LABELS[a.roleKey as RoleKey]} tại ${a.orgUnitName}?`,
                              okText: 'Gỡ',
                              cancelText: 'Hủy',
                              onOk: () => adminApi.removeAssignment(u.id, a.id).then(() => { void user.refetch(); onChanged(); }).catch(fail),
                            })
                          }
                        >
                          Xóa
                        </Button>
                      ),
                    },
                  ]}
                />
                {u.pending.map((p) => (
                  <Tag key={p.id} color="gold" style={{ marginTop: 8 }}>
                    Chờ duyệt: {p.change.customRoleName ?? ROLE_LABELS[p.change.roleKey]} tại {units.data?.find((x) => x.id === p.change.orgUnitId)?.name ?? p.change.orgUnitId}
                  </Tag>
                ))}
                <Form form={role} layout="inline" style={{ marginTop: 16, rowGap: 8 }} disabled={mine}>
                  <Form.Item name="roleKey" rules={[{ required: true, message: 'Chọn vai trò' }]}>
                    <Select
                      placeholder="Vai trò"
                      style={{ width: 220 }}
                      options={
                        (meta.data?.customRoles.length
                          ? [
                              { label: 'Vai trò hệ thống', options: meta.data.roles.map((r) => ({ value: r.value, label: r.label })) },
                              {
                                label: 'Vai trò tùy chỉnh',
                                options: meta.data.customRoles.map((c) => ({ value: c.id, label: `${c.name} (gốc ${ROLE_LABELS[c.baseRole]})` })),
                              },
                            ]
                          : meta.data?.roles.map((r) => ({ value: r.value, label: r.label }))) as SelectProps['options']
                      }
                      onChange={() => role.setFieldValue('orgUnitId', undefined)}
                    />
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate={(a, b) => a.roleKey !== b.roleKey}>
                    {({ getFieldValue }) => (
                      <Form.Item name="orgUnitId" rules={[{ required: true, message: 'Chọn đơn vị' }]}>
                        <Select placeholder="Đơn vị" showSearch optionFilterProp="label" style={{ width: 220 }} options={roleUnits(getFieldValue('roleKey'))} />
                      </Form.Item>
                    )}
                  </Form.Item>
                  <Form.Item name="lead" valuePropName="checked" label="Trưởng nhóm"><Switch /></Form.Item>
                  <Button type="primary" onClick={() => addRole().catch(() => undefined)}>Thêm vai trò</Button>
                </Form>
              </>
            ),
          },
          ...(perms.has('permission.explain') && !isNew && !mine ? [{ key: 'effective', label: 'Quyền hiệu lực', children: <EffectiveRightsTab userId={id} /> }] : []),
        ]}
      />
    </Drawer>
  );
}
