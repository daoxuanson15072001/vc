import { useState } from 'react';
import { App, Button, Dropdown, Form, Input, Modal, Select, Tooltip, type MenuProps } from 'antd';
import { UserSwitchOutlined } from '@ant-design/icons';
import type { ChatConversation } from '../../types';
import { usePermissions } from '../../state/permissions';
import { useHandlerActions, usePeople } from './conversationWorkApi';

/**
 * "Phụ trách" of the chat header (00 MH-UI-10): who handles the conversation, and Nhận / Phân công cho… /
 * Chuyển cho… / Trả về Chưa phân công. On a personal nick with a holder the holder handles it (02 DK-21), so the
 * menu only says so. The API checks the right on this conversation again.
 */
export default function HandlerControl({ conversationId, conversation, meId }: { conversationId: string; conversation?: ChatConversation; meId?: string | null }) {
  const { message } = App.useApp();
  const perms = usePermissions();
  const actions = useHandlerActions(conversationId);
  const [dialog, setDialog] = useState<'assign' | 'transfer' | null>(null);
  const people = usePeople(conversationId, dialog !== null);
  const [form] = Form.useForm<{ userId: string; reason?: string }>();
  const can = { claim: perms.has('conv.claim'), assign: perms.has('conv.assign'), transfer: perms.has('conv.transfer') };
  if (!conversation || !(can.claim || can.assign || can.transfer)) return null;

  const assignable = conversation.assignable !== false;
  const assignee = conversation.assigneeId ?? null;
  const mine = !!meId && assignee === meId;
  const label = conversation.ownerName ? `Phụ trách: ${conversation.ownerName}` : assignable ? 'Chưa phân công' : 'Phụ trách';
  const fail = (e: unknown) => message.error((e as Error).message);

  const items: MenuProps['items'] = assignable
    ? [
        ...(can.claim && !assignee ? [{ key: 'claim', label: 'Nhận hội thoại này' }] : []),
        ...(can.assign ? [{ key: 'assign', label: 'Phân công cho…' }] : []),
        ...(can.transfer && assignee && (mine || can.assign) ? [{ key: 'transfer', label: 'Chuyển cho…' }] : []),
        ...(assignee && (mine || can.assign) ? [{ key: 'release', label: 'Trả về Chưa phân công' }] : []),
      ]
    : [{ key: 'holder', disabled: true, label: 'Nick cá nhân: người giữ nick xử lý hội thoại' }];

  const onMenu: MenuProps['onClick'] = ({ key }) => {
    if (key === 'claim') actions.claim.mutate(undefined, { onSuccess: () => message.success(`Đã nhận hội thoại ${conversation.name ?? ''}.`), onError: fail });
    if (key === 'release') actions.release.mutate(undefined, { onSuccess: () => message.success('Đã trả hội thoại về Chưa phân công.'), onError: fail });
    if (key === 'assign' || key === 'transfer') {
      form.resetFields();
      setDialog(key);
    }
  };

  const submit = async () => {
    const v = await form.validateFields();
    const who = people.data?.find((p) => p.id === v.userId)?.name ?? '';
    const done = () => {
      message.success(dialog === 'assign' ? `Đã phân công hội thoại cho ${who}.` : `Đã chuyển hội thoại cho ${who}.`);
      setDialog(null);
    };
    if (dialog === 'assign') actions.assign.mutate({ userId: v.userId, reason: v.reason?.trim() || undefined }, { onSuccess: done, onError: fail });
    else actions.transfer.mutate({ userId: v.userId, reason: (v.reason ?? '').trim() }, { onSuccess: done, onError: fail });
  };

  return (
    <>
      <Dropdown trigger={['click']} menu={{ items, onClick: onMenu }}>
        <Tooltip title="Người xử lý hội thoại">
          <Button icon={<UserSwitchOutlined />} loading={actions.claim.isPending || actions.release.isPending} aria-label="Phụ trách">
            <span className="btn-label">{label}</span>
          </Button>
        </Tooltip>
      </Dropdown>
      <Modal
        open={dialog !== null}
        title={dialog === 'assign' ? 'Phân công hội thoại' : 'Chuyển hội thoại'}
        okText={dialog === 'assign' ? 'Phân công' : 'Chuyển'}
        cancelText="Hủy"
        onOk={submit}
        onCancel={() => setDialog(null)}
        confirmLoading={actions.assign.isPending || actions.transfer.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="userId" label="Người nhận" rules={[{ required: true, message: 'Chọn người nhận' }]} extra="Chỉ hiện người xem được hội thoại này.">
            <Select
              showSearch
              optionFilterProp="label"
              loading={people.isLoading}
              placeholder="Chọn người"
              options={(people.data ?? []).filter((p) => p.id !== assignee).map((p) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label={dialog === 'transfer' ? 'Lý do chuyển' : 'Lý do (không bắt buộc)'}
            rules={dialog === 'transfer' ? [{ required: true, min: 10, whitespace: true, message: 'Lý do chuyển cần ít nhất 10 ký tự' }] : []}
          >
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
