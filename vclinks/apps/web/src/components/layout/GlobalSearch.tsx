import { useEffect, useRef, useState } from 'react';
import { Empty, Input, List, Modal, Tag, Typography, type InputRef } from 'antd';
import { FileSearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { SEARCH_MIN_CHARS, type QuickSearchItem } from '@vclinks/shared';
import ChatAvatar from '../chat/ChatAvatar';
import { quickSearch } from './shellApi';

/**
 * MH-UI-04 global search (Ctrl+K). Two sources, both by name (accent-insensitive), phone digits or customer
 * code, phones masked by the API: customers (open Customer 360) listed first, then channel contacts (open the chat).
 */
export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<InputRef>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 150);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    if (open) {
      setText('');
      setActive(0);
      setTimeout(() => input.current?.focus(), 50);
    }
  }, [open]);

  const q = useQuery({
    queryKey: ['quick-search', debounced],
    queryFn: () => quickSearch(debounced),
    enabled: open && debounced.length > 0,
    staleTime: 10_000,
    retry: false,
  });
  const items = debounced ? (q.data?.items ?? []) : [];
  // MH-SZ-14 #2a: "Tìm trong tin nhắn" opens /search (also Ctrl+Enter); shown from 2 characters.
  const canSearchMessages = debounced.length >= SEARCH_MIN_CHARS;
  const searchMessages = () => {
    if (!canSearchMessages) return;
    onClose();
    navigate(`/search?q=${encodeURIComponent(debounced)}`);
  };

  const pick = (it: QuickSearchItem) => {
    if (it.kind === 'customer' && it.accountId) {
      onClose();
      navigate(`/customers/${encodeURIComponent(it.accountId)}`);
      return;
    }
    if (!it.conversationId) return;
    onClose();
    navigate(`/conversations/${encodeURIComponent(it.conversationId)}`);
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} closable={false} destroyOnClose width={560} styles={{ body: { paddingTop: 8 } }} title="Tìm kiếm">
      <Input
        ref={input}
        size="large"
        allowClear
        value={text}
        placeholder="Tìm khách theo tên, SĐT, mã KH…"
        aria-label="Tìm kiếm"
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            searchMessages();
          } else if (e.key === 'Enter' && items[active]) pick(items[active]);
        }}
      />
      <div style={{ marginTop: 12, minHeight: 120, maxHeight: 360, overflow: 'auto' }}>
        {canSearchMessages && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Tìm trong tin nhắn"
            onClick={searchMessages}
            onKeyDown={(e) => e.key === 'Enter' && searchMessages()}
            style={{ cursor: 'pointer', padding: '8px 12px', marginBottom: 4, borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}
          >
            <FileSearchOutlined /> Tìm trong tin nhắn: "{debounced}" <Typography.Text type="secondary">(Ctrl+Enter)</Typography.Text>
          </div>
        )}
        {!debounced ? (
          <Typography.Text type="secondary">Gõ tên, số điện thoại hoặc mã khách hàng. Dùng phím mũi tên và Enter để mở.</Typography.Text>
        ) : q.isError ? (
          <Typography.Text type="danger">Không tìm được lúc này. Thử lại sau.</Typography.Text>
        ) : !q.isLoading && items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có kết quả" />
        ) : (
          <List
            loading={q.isLoading}
            dataSource={items}
            renderItem={(it, i) => (
              <List.Item
                key={it.kind === 'customer' ? `c:${it.accountId}` : `${it.uid}:${it.userId}`}
                onClick={() => pick(it)}
                onMouseEnter={() => setActive(i)}
                style={{ cursor: it.conversationId || it.kind === 'customer' ? 'pointer' : 'default', background: i === active ? 'var(--ant-color-fill-tertiary, #f5f5f5)' : undefined, padding: '8px 12px' }}
              >
                <List.Item.Meta
                  avatar={<ChatAvatar size={32} name={it.name || it.userId} colorKey={it.userId} />}
                  title={<span>{it.name || it.userId}{it.kind === 'customer' && <Tag color="blue" style={{ marginLeft: 8 }}>Khách hàng</Tag>}</span>}
                  description={[it.phone, it.customerCode, it.kind === 'customer' || it.conversationId ? null : 'Chưa có hội thoại'].filter(Boolean).join(' · ') || undefined}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </Modal>
  );
}
