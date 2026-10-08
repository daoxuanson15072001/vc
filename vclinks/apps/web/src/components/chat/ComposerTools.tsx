import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, AutoComplete, Button, Checkbox, Dropdown, Form, Input, Modal, Popover, Space, Spin, Tag, Tooltip, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { BankOutlined, BarChartOutlined, FilePdfOutlined, IdcardOutlined, PaperClipOutlined, PictureOutlined, SmileOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { STICKER_SETS, renderQuickReply, type QuickReply, type QuickReplyKind, type ZaloStickerSearch, type ZaloStickerView } from '@vclinks/shared';
import { api } from '../../api';
import SendQuoteModal from '../customers/SendQuoteModal';
import { OPEN_SEND_QUOTE_EVENT } from './composerBus';
import { uploadAttachment, useOutboxCommand, useParticipants, type OutboxCommand } from './commands';
import QuickRepliesModal from './QuickRepliesModal';
import { useQuickReplies } from './quick-replies';

interface Props {
  uid: string;
  threadId: string;
  conversationId: string;
  isGroup: boolean;
  accountLabel: string;
  /** Inserts "@Name " at the cursor of the text composer. */
  onMention: (m: { name: string; uid: string }) => void;
  /** Inserts a text (quick reply, bank account) at the cursor of the text composer. */
  onInsertText: (text: string) => void;
  /** Values for template variables: {ten_khach} = conversation / customer name, {ten_nv} = sending account. */
  vars: { ten_khach?: string | null; ten_nv?: string | null; ten_nguoi_giu_nick?: string | null };
  disabled?: boolean;
  /** The nick runs on the máy Zalo in direct mode (zca-js): no Zalo Web tab clicks anything. */
  direct?: boolean;
  /** Set when the user replies on behalf of the nick holder ("trả lời thay"): every command says so. */
  onBehalfHolder?: string | null;
}

const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif';
/** Keywords offered above Zalo's sticker search (direct nicks). */
const STICKER_KEYWORDS = ['chào', 'cảm ơn', 'ok', 'haha', 'yêu', 'buồn', 'xin lỗi', 'tuyệt vời'];
const MAX_IMAGES = 10;
const POLL_Q = 200;
const POLL_OPT = 120;

/**
 * Zalo-like tool row above the composer (personal Zalo only): sticker, photos,
 * file, name card, poll, @mention — the same tools Zalo Web shows — plus
 * VClinks' own quick replies and bank-account templates in place of Zalo's
 * per-account "Tin nhắn nhanh" / "Gửi nhanh số tài khoản". Every command is
 * confirmed here: confirming is the approval (approvedBy/approvedAt), then the
 * VClinks extension performs it on Zalo Web and checks the result. Templates
 * only fill the composer; pressing send is the approval.
 */
export default function ComposerTools({ uid, threadId, conversationId, isGroup, accountLabel, onMention, onInsertText, vars, disabled, direct, onBehalfHolder }: Props) {
  const { message, modal } = App.useApp();
  const command = useOutboxCommand(uid, threadId);
  const people = useParticipants(conversationId, true);
  const replies = useQuickReplies();
  const [busy, setBusy] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  // Direct (zca-js) nicks search Zalo's own stickers; nicks on Zalo Web keep the default set the extension clicks.
  const [stickerQ, setStickerQ] = useState('chào');
  const stickerSearch = useQuery({
    queryKey: ['zalo-stickers', uid, stickerQ],
    queryFn: () => api<ZaloStickerSearch>('/zalo/stickers', { query: { uid, q: stickerQ } }),
    enabled: stickerOpen && !disabled,
    staleTime: 60 * 60_000,
    retry: false,
  });
  // Gửi báo giá (M1c-02): opened by the toolbar button or by the quote tab of the side panel.
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteNo, setQuoteNo] = useState<string | undefined>();
  useEffect(() => {
    const h = (e: Event) => {
      if (disabled) return;
      setQuoteNo((e as CustomEvent<{ no?: string }>).detail?.no);
      setQuoteOpen(true);
    };
    window.addEventListener(OPEN_SEND_QUOTE_EVENT, h);
    return () => window.removeEventListener(OPEN_SEND_QUOTE_EVENT, h);
  }, [disabled]);
  const [repliesKind, setRepliesKind] = useState<QuickReplyKind | 'all' | null>(null);
  const [cardForm] = Form.useForm<{ name: string; withPhone: boolean }>();
  const [pollForm] = Form.useForm<{ question: string; options: string[] }>();

  // Who the customer sees, as the text composer's "trả lời thay" confirmation says it.
  const fromWho = onBehalfHolder
    ? `Bạn đang trả lời thay ${onBehalfHolder}: khách thấy tin từ nick ${accountLabel}.`
    : `Gửi từ tài khoản ${accountLabel}.`;
  const send = async (label: string, cmd: OutboxCommand) => {
    await command.mutateAsync(cmd);
    message.success(`Đã duyệt: ${label}. Đang gửi qua Zalo.`);
  };

  const confirmThen = (title: string, body: string, run: () => Promise<void>) =>
    modal.confirm({
      title,
      content: `${body} ${fromWho} Bấm "Gửi" nghĩa là bạn đã duyệt.`,
      okText: 'Gửi',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await run();
        } catch (e) {
          message.error((e as Error).message || 'Không gửi được');
          throw e;
        }
      },
    });

  const pickFiles = (kind: 'images' | 'file') => (files: File[]) => {
    if (!files.length) return;
    if (kind === 'images' && files.length > MAX_IMAGES) {
      message.warning(`Mỗi lần gửi tối đa ${MAX_IMAGES} ảnh`);
      return;
    }
    const label = kind === 'images' ? (files.length > 1 ? `${files.length} ảnh` : '1 ảnh') : `file "${files[0].name}"`;
    confirmThen(`Gửi ${label}?`, kind === 'images' ? 'Zalo gửi ảnh ngay, không có bước xem trước.' : 'Người nhận thấy đúng tên file này.', async () => {
      setBusy(kind);
      try {
        const atts = [];
        for (const f of files) atts.push(await uploadAttachment(f));
        await send(label, { action: kind === 'images' ? 'send_images' : 'send_file', attachments: atts.map((a) => a.id) });
      } finally {
        setBusy(null);
      }
    });
  };

  // antd Upload: collect the whole selection once, never auto-upload.
  const uploadProps = (kind: 'images' | 'file') => {
    let batch: File[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
      accept: kind === 'images' ? IMAGE_ACCEPT : undefined,
      multiple: kind === 'images',
      showUploadList: false,
      beforeUpload: (file: UploadFile & File) => {
        batch.push(file);
        clearTimeout(timer);
        timer = setTimeout(() => {
          const files = batch;
          batch = [];
          pickFiles(kind)(files);
        }, 0);
        return false;
      },
    };
  };

  const pickSticker = (set: (typeof STICKER_SETS)[number], index: number) => {
    setStickerOpen(false);
    const thumbUrl = set.thumb(index);
    modal.confirm({
      title: 'Gửi sticker này?',
      content: (
        <Space direction="vertical">
          <img src={thumbUrl} alt={`Sticker ${index} của bộ ${set.title}`} width={96} height={96} />
          <span>
            Bộ "{set.title}", vị trí {index}. Zalo gửi ngay khi tiện ích bấm chọn. {fromWho} Bấm "Gửi" nghĩa là bạn đã duyệt.
          </span>
        </Space>
      ),
      okText: 'Gửi',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await send(`sticker ${set.title} #${index}`, { action: 'send_sticker', sticker: { set: set.title, index, thumbUrl } });
        } catch (e) {
          message.error((e as Error).message || 'Không gửi được');
          throw e;
        }
      },
    });
  };

  const pickZaloSticker = (s: ZaloStickerView, index: number) => {
    setStickerOpen(false);
    modal.confirm({
      title: 'Gửi sticker này?',
      content: (
        <Space direction="vertical">
          <img src={s.url} alt="Sticker" width={96} height={96} />
          <span>{fromWho} Bấm "Gửi" nghĩa là bạn đã duyệt.</span>
        </Space>
      ),
      okText: 'Gửi',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await send('sticker', { action: 'send_sticker', sticker: { set: 'Zalo', index: index + 1, thumbUrl: s.url, id: s.id, cateId: s.cateId, type: s.type } });
        } catch (e) {
          message.error((e as Error).message || 'Không gửi được');
          throw e;
        }
      },
    });
  };

  const insertReply = (r: QuickReply) => {
    onInsertText(renderQuickReply(r.text, vars));
    setRepliesKind(null);
  };

  const bankReplies = useMemo(() => (replies.data ?? []).filter((r) => r.kind === 'bank'), [replies.data]);
  const names = (people.data ?? []).map((p) => ({ value: p.name, label: p.name }));

  const zaloStickers = (
    <div className="sticker-picker">
      <Input.Search
        size="small"
        allowClear
        placeholder="Tìm sticker của Zalo (ví dụ: chào, cảm ơn)"
        defaultValue={stickerQ}
        onSearch={(v) => setStickerQ(v.trim() || 'chào')}
        aria-label="Tìm sticker"
      />
      <div className="sticker-picker__keywords">
        {STICKER_KEYWORDS.map((k) => (
          <Tag.CheckableTag key={k} checked={stickerQ === k} onChange={() => setStickerQ(k)}>
            {k}
          </Tag.CheckableTag>
        ))}
      </div>
      {stickerSearch.isFetching ? (
        <div className="sticker-picker__empty">
          <Spin size="small" />
        </div>
      ) : stickerSearch.data?.items.length ? (
        <div className="sticker-picker__grid">
          {stickerSearch.data.items.map((s, i) => (
            <button key={s.id} type="button" className="sticker-picker__item" onClick={() => pickZaloSticker(s, i)} aria-label={`Sticker ${i + 1}`}>
              <img src={s.url} alt="" loading="lazy" width={56} height={56} />
            </button>
          ))}
        </div>
      ) : (
        <div className="sticker-picker__empty">Không có sticker cho từ này. Thử từ khác.</div>
      )}
    </div>
  );

  const defaultStickers = (
    <div className="sticker-picker">
      {STICKER_SETS.map((set) => (
        <div key={set.title}>
          <div className="sticker-picker__title">{set.title}</div>
          <div className="sticker-picker__grid">
            {Array.from({ length: set.count }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className="sticker-picker__item" onClick={() => pickSticker(set, n)} aria-label={`Sticker ${n}`}>
                <img src={set.thumb(n)} alt="" loading="lazy" width={56} height={56} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="composer__tools">
      <Space size={2}>
        <Popover
          open={stickerOpen && !disabled}
          onOpenChange={(o) => setStickerOpen(o)}
          trigger={['click']}
          placement="topLeft"
          content={stickerSearch.data?.direct ? zaloStickers : stickerSearch.isLoading ? <Spin size="small" /> : defaultStickers}
          overlayClassName="sticker-picker__popover"
        >
          <Tooltip title="Gửi Sticker">
            <Button type="text" icon={<SmileOutlined />} disabled={disabled} aria-label="Gửi Sticker" />
          </Tooltip>
        </Popover>
        <Upload {...uploadProps('images')} disabled={disabled}>
          <Tooltip title="Gửi hình ảnh">
            <Button type="text" icon={<PictureOutlined />} loading={busy === 'images'} disabled={disabled} aria-label="Gửi hình ảnh" />
          </Tooltip>
        </Upload>
        <Upload {...uploadProps('file')} disabled={disabled}>
          <Tooltip title="Đính kèm file (≤ 10 MB)">
            <Button type="text" icon={<PaperClipOutlined />} loading={busy === 'file'} disabled={disabled} aria-label="Đính kèm file" />
          </Tooltip>
        </Upload>
        <Tooltip title="Gửi danh thiếp">
          <Button type="text" icon={<IdcardOutlined />} disabled={disabled} onClick={() => setCardOpen(true)} aria-label="Gửi danh thiếp" />
        </Tooltip>
        <Tooltip title="Gửi báo giá">
          <Button type="text" icon={<FilePdfOutlined />} disabled={disabled} onClick={() => { setQuoteNo(undefined); setQuoteOpen(true); }} aria-label="Gửi báo giá" />
        </Tooltip>
        <Tooltip title="Tin nhắn nhanh (gõ / trong ô soạn)">
          <Button type="text" icon={<ThunderboltOutlined />} disabled={disabled} onClick={() => setRepliesKind('all')} aria-label="Tin nhắn nhanh" />
        </Tooltip>
        <Dropdown
          disabled={disabled}
          trigger={['click']}
          menu={{
            items: [
              ...bankReplies.slice(0, 20).map((r) => ({ key: r.id, label: r.title })),
              ...(bankReplies.length ? [{ type: 'divider' as const }] : []),
              { key: '__manage', label: bankReplies.length ? 'Quản lý số tài khoản…' : 'Thêm số tài khoản…' },
            ],
            onClick: ({ key }) => {
              if (key === '__manage') return setRepliesKind('bank');
              const r = bankReplies.find((x) => x.id === key);
              if (r) insertReply(r);
            },
          }}
        >
          <Tooltip title="Gửi nhanh số tài khoản">
            <Button type="text" icon={<BankOutlined />} disabled={disabled} aria-label="Gửi nhanh số tài khoản" />
          </Tooltip>
        </Dropdown>
        {isGroup && (
          <>
            <Tooltip title="Tạo bình chọn">
              <Button type="text" icon={<BarChartOutlined />} disabled={disabled} onClick={() => setPollOpen(true)} aria-label="Tạo bình chọn" />
            </Tooltip>
            <Dropdown
              disabled={disabled || !people.data?.length}
              trigger={['click']}
              menu={{
                items: (people.data ?? []).slice(0, 50).map((p) => ({ key: p.uid, label: p.name })),
                onClick: ({ key }) => {
                  const p = people.data?.find((x) => x.uid === key);
                  if (p) onMention({ name: p.name, uid: p.uid });
                },
              }}
            >
              <Tooltip title={people.data?.length ? 'Nhắc tên (@)' : 'Chưa biết thành viên nào của nhóm'}>
                <Button type="text" disabled={disabled || !people.data?.length} aria-label="Nhắc tên">
                  @
                </Button>
              </Tooltip>
            </Dropdown>
          </>
        )}
      </Space>

      <SendQuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        uid={uid}
        threadId={threadId}
        customerName={vars.ten_khach ?? 'khách'}
        accountLabel={accountLabel}
        vars={vars}
        initialNo={quoteNo}
        disabled={disabled}
      />

      <QuickRepliesModal open={repliesKind !== null} kind={repliesKind === 'bank' ? 'bank' : undefined} onClose={() => setRepliesKind(null)} onInsert={insertReply} />

      <Modal
        title="Gửi danh thiếp"
        open={cardOpen}
        okText="Gửi"
        cancelText="Hủy"
        confirmLoading={command.isPending}
        onCancel={() => setCardOpen(false)}
        onOk={async () => {
          const v = await cardForm.validateFields();
          try {
            // The person's Zalo id when picked from the participants: a direct nick sends the card by id.
            const picked = (people.data ?? []).find((p) => p.name === v.name.trim());
            await send(`danh thiếp ${v.name}`, { action: 'send_card', card: { name: v.name.trim(), withPhone: !!v.withPhone, ...(picked ? { userId: picked.uid } : {}) } });
            setCardOpen(false);
            cardForm.resetFields();
          } catch (e) {
            message.error((e as Error).message || 'Không gửi được');
          }
        }}
      >
        {onBehalfHolder && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={fromWho} />}
        <Form form={cardForm} layout="vertical" initialValues={{ withPhone: false }}>
          <Form.Item
            name="name"
            label="Tên liên hệ (đúng như trong Zalo)"
            extra={
              direct
                ? 'Chọn một người trong danh sách gợi ý (người trong hội thoại): máy Zalo gửi danh thiếp theo tài khoản Zalo của họ.'
                : "Tiện ích sẽ tìm tên này trong hộp 'Gửi danh thiếp' của Zalo; nếu không thấy hoặc có nhiều người trùng tên thì sẽ không gửi."
            }
            rules={[{ required: true, whitespace: true, message: 'Nhập tên liên hệ' }]}
          >
            <AutoComplete options={names} filterOption={(input, o) => !!o?.value.toLowerCase().includes(input.toLowerCase())} placeholder="Ví dụ: 9C_Hiệp Lễ" />
          </Form.Item>
          <Form.Item name="withPhone" valuePropName="checked">
            <Checkbox>Gửi kèm số điện thoại</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Tạo bình chọn"
        open={pollOpen}
        okText="Tạo bình chọn"
        cancelText="Hủy"
        confirmLoading={command.isPending}
        onCancel={() => setPollOpen(false)}
        onOk={async () => {
          const v = await pollForm.validateFields();
          const options = (v.options ?? []).map((o) => o.trim()).filter(Boolean);
          if (options.length < 2) {
            message.warning('Cần ít nhất 2 lựa chọn');
            return;
          }
          try {
            await send(`bình chọn "${v.question}"`, { action: 'create_poll', poll: { question: v.question.trim(), options } });
            setPollOpen(false);
            pollForm.resetFields();
          } catch (e) {
            message.error((e as Error).message || 'Không gửi được');
          }
        }}
      >
        <Form form={pollForm} layout="vertical" initialValues={{ options: ['', ''] }}>
          <Form.Item name="question" label="Chủ đề bình chọn" rules={[{ required: true, whitespace: true, message: 'Nhập câu hỏi' }]}>
            <Input.TextArea maxLength={POLL_Q} showCount autoSize={{ minRows: 1, maxRows: 4 }} placeholder="Đặt câu hỏi bình chọn" />
          </Form.Item>
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f, i) => (
                  <Form.Item key={f.key} label={i === 0 ? 'Các lựa chọn' : undefined} style={{ marginBottom: 8 }}>
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item name={f.name} noStyle>
                        <Input maxLength={POLL_OPT} placeholder={`Lựa chọn ${i + 1}`} />
                      </Form.Item>
                      {fields.length > 2 && <Button onClick={() => remove(f.name)}>Xóa</Button>}
                    </Space.Compact>
                  </Form.Item>
                ))}
                {fields.length < 30 && (
                  <Button type="dashed" block onClick={() => add('')}>
                    + Thêm lựa chọn
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
