import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';

const FLASH_MS = 2400;

/**
 * Opening a chat with `?msg=` (a search hit, M1c-05): once the window holding the message is rendered, scroll it
 * to the middle and flash it. The chat stops sticking to the bottom while the jump is active.
 */
export function useJumpToMessage(opts: {
  scrollRef: RefObject<HTMLElement>;
  stickToBottom: MutableRefObject<boolean>;
  anchor: string | undefined;
  loaded: boolean;
}) {
  const { scrollRef, stickToBottom, anchor, loaded } = opts;
  const done = useRef<string | null>(null);
  // Before the window arrives: do not let the "stay at the bottom" rule scroll away from it.
  useEffect(() => {
    if (anchor) stickToBottom.current = false;
    else done.current = null;
  }, [anchor, stickToBottom]);
  useEffect(() => {
    if (!anchor || !loaded || done.current === anchor) return;
    const row = scrollRef.current?.querySelector<HTMLElement>(`[data-msgid="${CSS.escape(anchor)}"]`);
    if (!row) return;
    done.current = anchor;
    stickToBottom.current = false;
    row.scrollIntoView({ block: 'center' });
    row.classList.add('flash');
    window.setTimeout(() => row.classList.remove('flash'), FLASH_MS);
  }, [anchor, loaded, scrollRef, stickToBottom]);
}
