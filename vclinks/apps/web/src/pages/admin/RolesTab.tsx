import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Empty, Input, Popconfirm, Select, Skeleton, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { foldVi, ROLE_LABELS, SCOPE_LABELS, type RoleColumn, type RoleKey } from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';
import { adminApi, type RolesResponse } from './adminApi';
import CustomRoleDrawer, { type DrawerTarget } from './CustomRoleDrawer';
import { cellHint, cellText } from './roleCells';

const SYSTEM_NOTICE = 'Vai trò hệ thống không sửa được. Sao chép để tạo bản tùy chỉnh.';

/**
 * MH-PQ-05 Vai trò và ma trận quyền: the 10 system roles (read only), then the custom roles (PQ-06),
 * which Admin (role.edit) creates by copying a system role and removing or narrowing scopes.
 */
export default function RolesTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.has('role.edit');
  const q = useQuery({ queryKey: ['admin', 'roles'], queryFn: adminApi.roles, retry: false });
  const [section, setSection] = useState<string>('');
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<RoleKey | null>(null);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // The admin shell scrolls in its own box (not the window), so the sticky header must track that box.
  const getScrollContainer = useCallback((): Window | HTMLElement => {
    let el: HTMLElement | null = wrapRef.current?.parentElement ?? null;
    while (el) {
      const ov = getComputedStyle(el).overflowY;
      if (ov === 'auto' || ov === 'scroll') return el;
      el = el.parentElement;
    }
    return window;
  }, []);

  const sections = useMemo(() => [...new Set((q.data?.keys ?? []).map((k) => k.section))], [q.data]);
  const rows = useMemo(() => {
    const needle = foldVi(text.trim());
    return (q.data?.keys ?? []).filter(
      (k) => (!section || k.section === section) && (!needle || foldVi(k.label).includes(needle) || foldVi(k.key).includes(needle)),
    );
  }, [q.data, section, text]);

  if (q.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (q.isError || !q.data)
    return (
      <Alert type="error" showIcon message="Không tải được ma trận quyền." action={<Button size="small" onClick={() => q.refetch()}>Thử lại</Button>} />
    );
  const data: RolesResponse = q.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'meta'] });
  };
  const remove = async (r: RoleColumn) => {
    try {
      const res = await adminApi.deleteCustomRole(r.roleKey);
      message.success(res.message);
      refresh();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const title = (r: RoleColumn) => {
    // The whole header cell answers the click (onHeaderCell below), not only the text.
    if (r.system) return <Typography.Link style={{ color: 'inherit' }}>{r.label}</Typography.Link>;
    const held = r.assignedCount ?? 0;
    return (
      <Space direction="vertical" size={2}>
        <Tooltip title={[`Gốc: ${ROLE_LABELS[r.baseRole!]}`, r.description].filter(Boolean).join(' · ')}>
          <span>
            <i>{r.label}</i> <Tag>Tùy chỉnh</Tag>
          </span>
        </Tooltip>
        {canEdit && (
          <Space size={0}>
            <Button type="text" size="small" icon={<EditOutlined />} aria-label={`Sửa ${r.label}`} onClick={() => setDrawer({ kind: 'edit', role: r })} />
            {held ? (
              <Tooltip title={`Còn ${held} người đang có vai trò này.`}>
                <Button type="text" size="small" icon={<DeleteOutlined />} disabled aria-label={`Xóa ${r.label}`} />
              </Tooltip>
            ) : (
              <Popconfirm title={`Xóa vai trò ${r.label}?`} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => remove(r)}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`Xóa ${r.label}`} />
              </Popconfirm>
            )}
          </Space>
        )}
      </Space>
    );
  };

  return (
    <div ref={wrapRef}>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Select
            style={{ width: 260 }}
            value={section}
            onChange={setSection}
            options={[{ value: '', label: 'Nhóm: Tất cả' }, ...sections.map((s) => ({ value: s, label: s }))]}
            aria-label="Nhóm quyền"
          />
          <Input.Search allowClear placeholder="Tìm quyền" style={{ width: 240 }} value={text} onChange={(e) => setText(e.target.value)} />
          <Typography.Text type="secondary">
            Chú giải: {Object.values(SCOPE_LABELS).join(' · ')} · ✖ không có · +NK ghi nhật ký mỗi lần dùng
          </Typography.Text>
        </Space>
        {canEdit && (
          <Button type="primary" icon={<CopyOutlined />} onClick={() => setDrawer({ kind: 'new' })}>
            Sao chép thành vai trò mới
          </Button>
        )}
      </Space>
      {notice && (
        <Alert
          type="info"
          showIcon
          closable
          onClose={() => setNotice(null)}
          style={{ marginBottom: 12 }}
          message={SYSTEM_NOTICE}
          action={
            canEdit ? (
              <Button size="small" icon={<CopyOutlined />} onClick={() => setDrawer({ kind: 'new', base: notice })}>
                Sao chép {ROLE_LABELS[notice]}
              </Button>
            ) : undefined
          }
        />
      )}
      <Table
        size="small"
        rowKey="key"
        pagination={false}
        dataSource={rows}
        locale={{ emptyText: <Empty description={`Không có quyền nào khớp "${text}".`}><Button onClick={() => setText('')}>Xóa tìm kiếm</Button></Empty> }}
        scroll={{ x: 'max-content' }}
        sticky={{ offsetHeader: 0, getContainer: getScrollContainer }}
        columns={[
          {
            title: 'Chức năng',
            key: 'label',
            fixed: 'left',
            width: 320,
            render: (_: unknown, k: RolesResponse['keys'][number]) => (
              <Tooltip title={k.key}>
                <div>
                  <div>{k.label}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{k.section}</Typography.Text>
                </div>
              </Tooltip>
            ),
          },
          ...data.roles.map((r) => ({
            title: title(r),
            key: r.roleKey,
            width: r.system ? 130 : 150,
            onHeaderCell: () => (r.system ? { onClick: () => setNotice(r.roleKey as RoleKey), style: { cursor: 'pointer' } } : {}),
            render: (_: unknown, k: RolesResponse['keys'][number]) => {
              const c = r.permissions[k.key];
              const t = cellText(c, data.scopes);
              return (
                <Tooltip title={cellHint(c)}>
                  <span style={{ color: t === '✖' ? 'var(--muted, #999)' : undefined, fontStyle: r.system ? undefined : 'italic' }}>{t}</span>
                </Tooltip>
              );
            },
          })),
        ]}
      />
      {drawer && (
        <CustomRoleDrawer
          target={drawer}
          keys={data.keys}
          scopes={data.scopes}
          names={data.roles.map((r) => ({ id: r.roleKey, name: r.label }))}
          onClose={() => setDrawer(null)}
          onSaved={(msg) => {
            message.success(msg);
            setDrawer(null);
            setNotice(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
