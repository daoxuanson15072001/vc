import { FileExcelOutlined, PlusOutlined } from '@ant-design/icons';
import { ORG_UNIT_TYPE_LABELS, USER_STATUS_LABELS, type OrgUnit, type OrgUnitType } from '@vclinks/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Modal, Result, Select, Skeleton, Space, Table, Tag, Tree, TreeSelect, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useMemo, useState } from 'react';
import { adminApi } from './adminApi';
import ImportModal from './ImportModal';

function buildTree(units: OrgUnit[]): DataNode[] {
  const kids = new Map<string | null, OrgUnit[]>();
  for (const u of units) (kids.get(u.parentId) ?? kids.set(u.parentId, []).get(u.parentId)!).push(u);
  const node = (u: OrgUnit): DataNode => ({
    key: u.id,
    title: (
      <span style={u.active ? undefined : { color: '#999' }}>
        {u.name} ({u.memberCount}) {!u.active && <Tag>Đã ngừng</Tag>}
      </span>
    ),
    children: (kids.get(u.id) ?? []).map(node),
  });
  return (kids.get(null) ?? []).map(node);
}

/** MH-PQ-01: tree on the left, details and members of the chosen unit on the right. */
export default function OrgTreeTab() {
  const qc = useQueryClient();
  const units = useQuery({ queryKey: ['admin', 'units'], queryFn: adminApi.units });
  const meta = useQuery({ queryKey: ['admin', 'meta'], queryFn: adminApi.meta });
  const [selected, setSelected] = useState<string>('GOC');
  const [form, setForm] = useState<{ mode: 'add' | 'edit'; unit?: OrgUnit } | null>(null);
  const [importing, setImporting] = useState(false);
  const [f] = Form.useForm();

  const list = units.data ?? [];
  const current = list.find((u) => u.id === selected) ?? list[0];
  const members = useQuery({
    queryKey: ['admin', 'members', current?.id],
    queryFn: () => adminApi.members(current!.id),
    enabled: !!current,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] });
  };
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e: Error) => message.error(e.message),
  });

  const tree = useMemo(() => buildTree(list), [list]);
  const treeSelectData = useMemo(() => {
    interface N { value: string; title: string; children?: N[] }
    const kids = new Map<string | null, OrgUnit[]>();
    for (const u of list) (kids.get(u.parentId) ?? kids.set(u.parentId, []).get(u.parentId)!).push(u);
    const node = (u: OrgUnit): N => ({ value: u.id, title: u.name, children: (kids.get(u.id) ?? []).map(node) });
    return (kids.get(null) ?? []).map(node);
  }, [list]);

  if (units.isError) return <Result status="error" title="Không tải được cây tổ chức." extra={<Button onClick={() => units.refetch()}>Thử lại</Button>} />;
  if (units.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

  const openForm = (mode: 'add' | 'edit', unit?: OrgUnit) => {
    setForm({ mode, unit });
    f.resetFields();
    if (mode === 'edit' && unit) f.setFieldsValue({ name: unit.name, type: unit.type, parentId: unit.parentId });
    else f.setFieldsValue({ parentId: current?.id });
  };

  const submit = async () => {
    const v = await f.validateFields();
    if (form?.mode === 'edit' && form.unit) {
      const u = form.unit;
      if (v.name !== u.name) await adminApi.updateUnit(u.id, { name: v.name });
      if (v.parentId !== u.parentId) {
        const ok = await new Promise<boolean>((res) =>
          Modal.confirm({
            title: `Chuyển ${u.name} sang đơn vị mới?`,
            content: 'Quyền xem của các thành viên sẽ thay đổi ngay.',
            okText: 'Chuyển',
            cancelText: 'Hủy',
            onOk: () => res(true),
            onCancel: () => res(false),
          }),
        );
        if (!ok) return;
        const r = await adminApi.moveUnit(u.id, v.parentId);
        message.success(`Đã chuyển đơn vị. Quyền đã cập nhật cho ${r.affected} người.`);
      } else message.success(`Đã cập nhật đơn vị ${v.name}.`);
    } else {
      await adminApi.createUnit({ name: v.name, type: v.type, parentId: v.parentId });
      message.success(`Đã thêm đơn vị ${v.name}.`);
    }
    setForm(null);
    refresh();
  };

  const parentLabel = (t: string) => ORG_UNIT_TYPE_LABELS[t as OrgUnitType] ?? t;

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<FileExcelOutlined />} onClick={() => setImporting(true)}>Nhập từ file</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm('add')}>Thêm đơn vị</Button>
      </Space>
      {list.length <= 1 && <Alert type="info" showIcon style={{ marginBottom: 12 }} message='Chưa có đơn vị nào. Bấm "Thêm đơn vị" để tạo division đầu tiên.' />}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 16 }}>
        <Card size="small">
          <Tree
            showLine
            blockNode
            defaultExpandedKeys={['GOC']}
            selectedKeys={current ? [current.id] : []}
            treeData={tree}
            onSelect={(k) => k[0] && setSelected(String(k[0]))}
          />
        </Card>
        {current && (
          <Card
            size="small"
            title={current.name}
            extra={
              current.type !== 'goc' && (
                <Space>
                  <Button onClick={() => openForm('edit', current)}>Sửa</Button>
                  {current.active ? (
                    <Button
                      danger
                      disabled={current.memberCount > 0}
                      title={current.memberCount > 0 ? 'Chuyển hết thành viên và kênh trước khi ngừng.' : undefined}
                      onClick={() => run.mutate(async () => { await adminApi.deactivate(current.id); message.success(`Đã ngừng đơn vị ${current.name}.`); })}
                    >
                      Ngừng
                    </Button>
                  ) : (
                    <Button onClick={() => run.mutate(async () => { await adminApi.reactivate(current.id); message.success(`Đã khôi phục đơn vị ${current.name}.`); })}>Khôi phục</Button>
                  )}
                </Space>
              )
            }
          >
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Mã">{current.code}</Descriptions.Item>
              <Descriptions.Item label="Loại">{parentLabel(current.type)}</Descriptions.Item>
              <Descriptions.Item label="Thuộc">{list.find((u) => u.id === current.parentId)?.name ?? '–'}</Descriptions.Item>
              <Descriptions.Item label="Quản lý">{current.managerName ?? 'Chưa có'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{current.active ? 'Đang hoạt động' : 'Đã ngừng'}</Descriptions.Item>
            </Descriptions>
            <Table
              style={{ marginTop: 12 }}
              size="small"
              loading={members.isLoading}
              rowKey={(m) => `${m.userId}:${m.roleKey}:${m.customRoleName ?? ''}`}
              dataSource={members.data ?? []}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              locale={{ emptyText: 'Chưa có thành viên' }}
              columns={[
                { title: 'Họ tên', dataIndex: 'fullName', render: (v, m) => <>{v} {m.lead && <Tag color="purple">Quản lý</Tag>}</> },
                { title: 'Email', dataIndex: 'email' },
                {
                  title: 'Vai trò',
                  dataIndex: 'roleKey',
                  render: (r, m) => (m.customRoleName ? <i>{m.customRoleName}</i> : (meta.data?.roles.find((x) => x.value === r)?.label ?? r)),
                },
                { title: 'Trạng thái', dataIndex: 'status', render: (s: keyof typeof USER_STATUS_LABELS) => USER_STATUS_LABELS[s] },
              ]}
            />
          </Card>
        )}
      </div>

      <Drawer
        title={form?.mode === 'edit' ? 'Sửa đơn vị' : 'Thêm đơn vị'}
        open={!!form}
        onClose={() => setForm(null)}
        width={420}
        extra={<Button type="primary" onClick={() => submit().catch((e) => e?.errorFields || message.error((e as Error).message))}>Lưu</Button>}
      >
        <Form form={f} layout="vertical">
          <Form.Item name="name" label="Tên đơn vị" rules={[{ required: true, min: 2, max: 80, message: 'Tên đơn vị 2–80 ký tự.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Loại đơn vị" rules={[{ required: true, message: 'Chọn loại đơn vị.' }]}>
            <Select
              disabled={form?.mode === 'edit'}
              options={(meta.data?.unitTypes ?? []).filter((t) => t.value !== 'goc').map((t) => ({ value: t.value, label: t.label }))}
            />
          </Form.Item>
          <Form.Item name="parentId" label="Thuộc đơn vị" rules={[{ required: true, message: 'Chọn đơn vị cha.' }]}>
            <TreeSelect treeData={treeSelectData} treeDefaultExpandAll />
          </Form.Item>
        </Form>
      </Drawer>
      <ImportModal kind="org" open={importing} onClose={() => setImporting(false)} onDone={refresh} />
    </>
  );
}
