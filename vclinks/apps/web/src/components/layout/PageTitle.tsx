import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyDocumentTitle, pageTitleOf } from '../../utils/title';

/** A page-specific title (conversation name, customer name...) and the pathname it belongs to. */
let override: { path: string; title: string } | null = null;

/**
 * Sets the tab title from the route ("Tin nhắn · VClinks"). Rendered once in the shell. A page that knows a
 * better title calls `usePageTitle`; since child effects run before this one, the override for the current
 * pathname wins here.
 */
export default function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (override?.path === pathname) return;
    applyDocumentTitle(pageTitleOf(pathname));
  }, [pathname]);
  return null;
}

/** Title of a detail page, e.g. the conversation or customer name; falls back to the route title when empty. */
export function usePageTitle(title: string | null | undefined): void {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!title) return;
    override = { path: pathname, title };
    applyDocumentTitle(title);
    return () => {
      if (override?.path === pathname) override = null;
    };
  }, [title, pathname]);
}
