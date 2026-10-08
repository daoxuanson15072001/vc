import { useState } from 'react';
import { App, Button, Divider, Input, Popover, Select, Space, Tag, Tooltip } from 'antd';
import { TagsOutlined } from '@ant-design/icons';
import { LABEL_COLORS, LABELS_PER_CONVERSATION, type ConversationLabel, type LabelColor } from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';
import { useLabelActions, useLabelCatalog } from './conversationWorkApi';

/** Chips of the VClinks labels of a conversation (list rows, chat header). */
export function LabelChips({ labels }: { labels?: ConversationLabel[] }) {
  if (!labels?.length) return null;
  return (
    <>
      {labels.map((l) => (
        <Tag key={l.id} color={l.color} bordered={false} style={{ marginInlineEnd: 4 }}>
          {l.name}
        </Tag>
      ))}
    </>
  );
}

/**
 * "Nhãn" of the chat header: VClinks labels of this conversation (not Zalo's "Thẻ phân loại"); up to 5, picked
 * from the company list, or created on the spot by people allowed to label (conv.label).
 */
export default function LabelsControl({ conversationId, labels }: { conversationId: string; labels?: ConversationLabel[] }) {
  const { message } = App.useApp();
  const perms = usePermissions();
  const canLabel = perms.has('conv.label');
  const [open, setOpen] = useState(false);
  const catalog = useLabelCatalog(open);
  const actions = useLabelActions(conversationId);
  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColor>('blue');
  if (!canLabel) return <LabelChips labels={labels} />;
  const current = (labels ?? []).map((l) => l.id);
  const fail = (e: unknown) => message.error((e as Error).message);
  const save = (ids: string[]) => actions.set.mutate(ids, { onError: fail });
  const create = () =>
    actions.create.mutate(
      { name: name.trim(), color },
      {
        onSuccess: (l) => {
          setName('');
          if (!current.includes(l.id) && current.length < LABELS_PER_CONVERSATION) save([...current, l.id]);
        },
        onError: fail,
      },
    );
  return (
    <Space size={2} wrap>
      <LabelChips labels={labels} />
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="bottomRight"
        title="Nhãn của hội thoại"
        content={
          <div style={{ width: 280 }}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Chọn nhãn"
              value={current}
              loading={catalog.isLoading || actions.set.isPending}
              maxCount={LABELS_PER_CONVERSATION}
              onChange={save}
              options={(catalog.data ?? []).map((l) => ({ value: l.id, label: <Tag color={l.color} bordered={false}>{l.name}</Tag> }))}
              optionFilterProp="title"
            />
            <Divider style={{ margin: '12px 0 8px' }}>Nhãn mới</Divider>
            <Space.Compact style={{ width: '100%' }}>
              <Input value={name} maxLength={40} placeholder="Tên nhãn" onChange={(e) => setName(e.target.value)} onPressEnter={() => name.trim() && create()} />
              <Select value={color} onChange={setColor} style={{ width: 96 }} options={LABEL_COLORS.map((c) => ({ value: c, label: <Tag color={c} bordered={false}>{c}</Tag> }))} />
            </Space.Compact>
            <Button block style={{ marginTop: 8 }} disabled={!name.trim()} loading={actions.create.isPending} onClick={create}>
              Thêm nhãn
            </Button>
          </div>
        }
      >
        <Tooltip title="Nhãn VClinks của hội thoại">
          <Button type="text" size="small" icon={<TagsOutlined />} aria-label="Nhãn" />
        </Tooltip>
      </Popover>
    </Space>
  );
}
