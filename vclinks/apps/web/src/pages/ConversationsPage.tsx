import { nickName } from '../utils/nick';
import { useCallback, useEffect, useState } from 'react';
import { Button, Drawer, Grid } from 'antd';
import { MessageOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ChatConversation } from '../types';
import { usePrefs } from '../state/prefs';
import { useAccounts } from '../components/AccountSelect';
import ChatPane from '../components/chat/ChatPane';
import ConversationList from '../components/chat/ConversationList';
import { splitConversationId } from '../components/chat/hooks';
import CustomerPanel from '../components/customers/CustomerPanel';

/** The right panel shows by itself from this window width (00 MH-UI-09); narrower, it opens as a drawer. */
const PANEL_MIN_WIDTH = 1360;

function useWide() {
  const q = '(min-width: ' + PANEL_MIN_WIDTH + 'px)';
  const [wide, setWide] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : true));
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setWide(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return wide;
}

export default function ConversationsPage() {
  const { id: selectedId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const mobile = screens.md === false;
  const { accountUid, setAccountUid } = usePrefs();
  const accounts = useAccounts();
  const [items, setItems] = useState<ChatConversation[]>([]);
  // Remember the opened conversation so the header survives list refreshes/filters.
  const [selected, setSelected] = useState<ChatConversation | undefined>();
  const wide = useWide();
  // Panel: open by default on a wide window; Alt+P toggles (MH-UI-09); narrower windows use a drawer.
  const [panelOpen, setPanelOpen] = useState<boolean | undefined>();
  const panelShown = panelOpen ?? wide;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) {
        e.preventDefault();
        setPanelOpen((v) => !(v ?? wide));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide]);

  // J / K: next / previous conversation of the list (plan B2 shortcuts); never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((k !== 'j' && k !== 'k') || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (!items.length) return;
      const i = items.findIndex((c) => c.id === selectedId);
      const next = i < 0 ? items[0] : items[k === 'j' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1)];
      if (!next || next.id === selectedId) return;
      e.preventDefault();
      setSelected(next);
      navigate(`/conversations/${encodeURIComponent(next.id)}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, selectedId, navigate]);

  const accountLabel = useCallback(
    (u: string) => {
      const a = accounts.data?.find((x) => x.uid === u);
      return a ? nickName(a.label, a.ownerName) : nickName(undefined);
    },
    [accounts.data],
  );

  useEffect(() => {
    if (!selectedId) return;
    const fresh = items.find((c) => c.id === selectedId);
    if (fresh) setSelected(fresh);
    else setSelected((prev) => (prev?.id === selectedId ? prev : undefined));
  }, [items, selectedId]);

  const multiAccount = !accountUid && (accounts.data?.length ?? 0) > 1;
  const showList = !mobile || !selectedId;
  const showChat = !mobile || !!selectedId;

  return (
    <div className={`chat-layout${mobile ? ' chat-layout--mobile' : ''}`}>
      {showList && (
        <ConversationList
          accountUid={accountUid}
          selectedId={selectedId}
          onSelect={(c) => {
            setSelected(c);
            navigate(`/conversations/${encodeURIComponent(c.id)}`);
          }}
          accountLabel={accountLabel}
          showAccountTag={multiAccount}
          onItems={setItems}
          onAccountChange={(uid) => {
            setAccountUid(uid);
            if (selectedId) navigate('/conversations');
          }}
          resizable={!mobile}
        />
      )}
      {showChat &&
        (selectedId ? (
          <ChatPane
            key={selectedId}
            conversationId={selectedId}
            conversation={selected?.id === selectedId ? selected : undefined}
            accountLabel={accountLabel(splitConversationId(selectedId).uid)}
            onBack={mobile ? () => navigate('/conversations') : undefined}
            headerExtra={
              !mobile && !(panelShown && wide) ? (
                <Button icon={<UserOutlined />} onClick={() => setPanelOpen(true)} aria-label="Mở thông tin khách (Alt+P)" title="Thông tin khách (Alt+P)">
                  <span className="btn-label">Khách</span>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="chat-empty">
            <MessageOutlined style={{ fontSize: 40, color: 'var(--accent)', marginBottom: 16 }} />
            <h2>Chào mừng đến với VClinks</h2>
            <div>Chọn một hội thoại ở danh sách bên trái để xem tin nhắn và trả lời.</div>
          </div>
        ))}
      {selectedId && !mobile && (
        <>
          {panelShown && wide && <CustomerPanel key={selectedId} uid={splitConversationId(selectedId).uid} userId={splitConversationId(selectedId).threadId} conversationId={selectedId} onClose={() => setPanelOpen(false)} />}
          {!wide && (
            <Drawer open={panelShown} width={340} title={null} closable={false} onClose={() => setPanelOpen(false)} styles={{ body: { padding: 0, display: 'flex' } }}>
              <CustomerPanel key={selectedId} uid={splitConversationId(selectedId).uid} userId={splitConversationId(selectedId).threadId} conversationId={selectedId} onClose={() => setPanelOpen(false)} />
            </Drawer>
          )}
        </>
      )}
    </div>
  );
}
