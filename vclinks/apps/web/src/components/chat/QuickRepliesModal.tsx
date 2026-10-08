import { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Form, Input, List, Modal, Popconfirm, Radio, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { QUICK_REPLY_LIMITS, filterQuickReplies, type QuickReply, type QuickReplyKind } from '@vclinks/shared';
import { useQuickReplies, useQuickReplyMutations } from './quick-replies';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Inserts the (already rendered) template into the composer. */
  onInsert: (r: QuickReply) => void;
  /** Show only templates of this kind (bank = "Gửi nhanh số tài khoản"). */
  kind?: QuickReplyKind;
}

const KIND_LABEL: Record<QuickReplyKind, string> = { text: 'Mẫu câu', bank: 'Số tài khoản' };

type FormValues = { shortcut: string; title: string; text: string; kind: QuickReplyKind };

/**
 * Quick replies ("Tin nhắn nhanh" of VClinks, company-wide): pick one to
 * insert into the composer, or add / edit / delete templates. Variables
 * {ten_khach} and {ten_nv} are filled in on insert.
 */
export default function QuickRepliesModal({ open, onClose, onInsert, kind }: Props) {
  const { message } = App.useApp();
  const replies = useQuickReplies(open);
  const mut = useQuickReplyMutations();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<QuickReply | 'new' | null>(null);
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setQuery('');
    }
  }, [open]);

  const list = useMemo(() => {
    const all = (replies.data ?? []).filter((r) => !kind || r.kind === kind);
    return query.trim() ? filterQuickReplies(all, query.trim().replace(/^\//, ''), 100) : all;
  }, [replies.data, kind, query]);

  const startEdit = (r: QuickReply | 'new') => {
    setEditing(r);
    form.setFieldsValue(r === 'new' ? { shortcut: '', title: '', text: '', kind: kind ?? 'text' } : { shortcut: r.shortcut, title: r.title, text: r.text, kind: r.kind });
  };

  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing === 'new') await mut.create.mutateAsync(v);
      else if (editing) await mut.update.mutateAsync({ id: editing.id, ...v });
      message.success('Đã lưu mẫu câu');
      setEditing(null);
    } catch (e) {
      message.error((e as Error).message || 'Không lưu được');
    }
  };

  const title = kind === 'bank' ? 'Gửi nhanh số tài khoản' : 'Tin nhắn nhanh (mẫu câu)';

  return (
    <Modal title={title} open={open} onCancel={onClose} footer={null} width={640} destroyOnClose>
      {editing ? (
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="shortcut"
              label="Phím tắt"
              style={{ width: '40%' }}
              normalize={(v: string) => (v ?? '').toLowerCase().replace(/^\//, '')}
              rules={[{ required: true, pattern: /^[a-z0-9_-]{1,32}$/, message: 'Chữ thường, số, _ và -, tối đa 32 ký tự' }]}
            >
              <Input addonBefore="/" maxLength={QUICK_REPLY_LIMITS.shortcut} placeholder="baohanh" />
            </Form.Item>
            <Form.Item name="title" label="Tên mẫu" style={{ width: '60%' }} rules={[{ required: true, whitespace: true, message: 'Nhập tên mẫu' }]}>
              <Input maxLength={QUICK_REPLY_LIMITS.title} placeholder="Chính sách bảo hành" />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="kind" label="Loại">
            <Radio.Group options={[{ value: 'text', label: 'Mẫu câu' }, { value: 'bank', label: 'Số tài khoản' }]} optionType="button" />
          </Form.Item>
          <Form.Item
            name="text"
            label="Nội dung"
            extra="Biến: {ten_khach} = tên khách / hội thoại, {ten_nv} = tên của bạn (người đang gửi trên VClinks)."
            rules={[{ required: true, whitespace: true, message: 'Nhập nội dung' }]}
          >
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} maxLength={QUICK_REPLY_LIMITS.text} showCount />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={save} loading={mut.create.isPending || mut.update.isPending}>
              Lưu
            </Button>
            <Button onClick={() => setEditing(null)}>Hủy</Button>
          </Space>
        </Form>
      ) : (
        <>
          <Space style={{ width: '100%', marginBottom: 8 }}>
            <Input.Search allowClear placeholder="Tìm theo phím tắt hoặc tên" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 360 }} />
            <Button icon={<PlusOutlined />} onClick={() => startEdit('new')}>
              Thêm mẫu
            </Button>
          </Space>
          <List
            loading={replies.isLoading}
            dataSource={list}
            locale={{ emptyText: <Empty description={kind === 'bank' ? 'Chưa có số tài khoản nào. Bấm "Thêm mẫu" để lưu số tài khoản công ty.' : 'Chưa có mẫu câu nào'} /> }}
            style={{ maxHeight: 420, overflow: 'auto' }}
            renderItem={(r) => (
              <List.Item
                actions={[
                  <Button key="insert" type="primary" size="small" onClick={() => onInsert(r)} aria-label={`Chèn /${r.shortcut}`}>
                    Chèn
                  </Button>,
                  <Button key="edit" type="text" size="small" icon={<EditOutlined />} onClick={() => startEdit(r)} aria-label={`Sửa /${r.shortcut}`} />,
                  <Popconfirm key="del" title="Xóa mẫu này?" okText="Xóa" cancelText="Hủy" onConfirm={() => mut.remove.mutateAsync(r.id).catch((e: Error) => message.error(e.message))}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`Xóa /${r.shortcut}`} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={6}>
                      <Tag color="blue">/{r.shortcut}</Tag>
                      <span>{r.title}</span>
                      {!kind && r.kind === 'bank' && <Tag>{KIND_LABEL.bank}</Tag>}
                    </Space>
                  }
                  description={
                    <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                      {r.text}
                    </Typography.Paragraph>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
    </Modal>
  );
}
