/**
 * Bubble structure survey (docs/04-ky-thuat/zalo-web/zalo-dom-selectors.md). Each chat bubble is
 * classified against the structures locked from real Zalo Web HTML
 * (`dom.knownBubbles`). An unsurveyed structure is never stored — its message
 * stays `pending` — and is reported as a `dom_selectors` drift with a
 * structure-only skeleton (tag, data-id, classes, attribute NAMES; never text
 * or attribute values) so Claude can lock it.
 *
 * Pure DOM parsing, no chrome.* — unit-tested with happy-dom.
 */
import { DEFAULT_KNOWN_BUBBLES, type DomSelectors } from '@vclinks/shared';

/** `known:<kind>` for a locked structure, `empty` for a bubble with nothing to read. */
export type BubbleStructure = `known:${string}` | 'empty' | 'unknown';

/** data-ids that carry no content (layout layer, reaction button). */
const NON_CONTENT_DATA_ID = /^div_DisabledTargetEventLayer$|Msg_React$/;
const CONTENT_TAGS = 'img, audio, video, source, canvas, a[href], picture';

function matchesSafe(root: Element, css: string): boolean {
  try {
    return !!root.querySelector(css);
  } catch {
    return false; // a bad selector from a mapping must never break extraction
  }
}

export function knownBubbles(sel?: Partial<Pick<DomSelectors, 'knownBubbles'>>): Readonly<Record<string, string>> {
  return sel?.knownBubbles ?? DEFAULT_KNOWN_BUBBLES;
}

/**
 * Classifies one bubble. A locked anchor anywhere inside wins (a text bubble
 * quoting a photo is still text). A bubble with only layout/reaction data-ids,
 * no media and no text is `empty` (recalled messages: their placeholder comes
 * from `msgType`, not the DOM).
 */
export function classifyBubble(el: Element, sel?: Partial<Pick<DomSelectors, 'knownBubbles' | 'text'>>): BubbleStructure {
  // The mapping's own text selector is a locked anchor too, so a UI change fixed
  // by new selectors keeps working without also updating knownBubbles.
  if (sel?.text && matchesSafe(el, sel.text)) return 'known:text';
  for (const [kind, css] of Object.entries(knownBubbles(sel))) {
    if (matchesSafe(el, css)) return `known:${kind}`;
  }
  const contentIds = [...el.querySelectorAll('[data-id]')].filter(
    (n) => !NON_CONTENT_DATA_ID.test(n.getAttribute('data-id') ?? ''),
  );
  const hasMedia = !!el.querySelector(CONTENT_TAGS);
  if (!contentIds.length && !hasMedia) return 'empty';
  return 'unknown';
}

/** Structure-only outline of a bubble: never text content or attribute values. */
export function bubbleSkeleton(el: Element, maxDepth = 12, maxLines = 80): string[] {
  const out: string[] = [];
  const rec = (n: Element, d: number) => {
    if (d > maxDepth || out.length >= maxLines) return;
    const cls = [...n.classList].slice(0, 4).join('.');
    const dataId = n.getAttribute('data-id');
    const attrs = [...n.attributes].map((a) => a.name).filter((x) => !['class', 'style', 'id', 'data-id'].includes(x));
    const hasText = [...n.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? '').trim());
    out.push(
      (
        '  '.repeat(d) +
        n.tagName.toLowerCase() +
        (dataId ? ` data-id="${dataId}"` : '') +
        (cls ? `.${cls}` : '') +
        (attrs.length ? `  [${attrs.join(', ')}]` : '') +
        (hasText ? ' «text»' : '')
      ).slice(0, 200),
    );
    for (const c of n.children) rec(c, d + 1);
  };
  rec(el, 0);
  return out;
}

/** Signature grouping bubbles of the same shape: data-ids (direction-neutral) + media tags. */
export function bubbleSignature(el: Element): string {
  const ids = new Set<string>();
  for (const n of el.querySelectorAll('[data-id]')) {
    const v = n.getAttribute('data-id') ?? '';
    // div_SentMsg_X / div_LastReceivedMsg_X → Msg_X, so direction does not split groups.
    ids.add(v.replace(/^div_(Last)?(Sent|Received)Msg_/, 'Msg_').replace(/^btn_(Last)?(Sent|Received)Msg_/, 'btn_Msg_'));
  }
  const tags = new Set<string>();
  for (const n of el.querySelectorAll('img, audio, video, a, canvas, svg, source')) tags.add(n.tagName.toLowerCase());
  return `${[...ids].sort().join('|')}#${[...tags].sort().join(',')}`;
}

export interface UnknownBubbleGroup {
  signature: string;
  count: number;
  skeleton: string[];
}

export interface BubbleSurvey {
  /** Bubbles per structure, e.g. { 'known:text': 30, empty: 2, unknown: 1 }. */
  counts: Record<string, number>;
  unknown: UnknownBubbleGroup[];
}

/** Surveys every rendered bubble under `root`, grouping unsurveyed structures by signature. */
export function surveyBubbles(
  root: ParentNode,
  sel: Pick<DomSelectors, 'bubbleIdPrefix'> & Partial<Pick<DomSelectors, 'knownBubbles' | 'text'>>,
): BubbleSurvey {
  const counts: Record<string, number> = {};
  const groups = new Map<string, UnknownBubbleGroup>();
  for (const el of root.querySelectorAll(`[id^="${sel.bubbleIdPrefix}"]`)) {
    const s = classifyBubble(el, sel);
    counts[s] = (counts[s] ?? 0) + 1;
    if (s !== 'unknown') continue;
    const sig = bubbleSignature(el);
    const g = groups.get(sig);
    if (g) g.count++;
    else groups.set(sig, { signature: sig.slice(0, 200), count: 1, skeleton: bubbleSkeleton(el) });
  }
  return { counts, unknown: [...groups.values()] };
}

/**
 * Drift `observedKeys` for unsurveyed structures: one `sig:` line per group
 * followed by its skeleton, bounded to the schema limits (500 × 200 chars).
 */
export function unknownDriftKeys(survey: BubbleSurvey, max = 500): string[] {
  const keys: string[] = [];
  for (const g of survey.unknown) {
    keys.push(`sig(x${g.count}): ${g.signature}`.slice(0, 200));
    for (const line of g.skeleton) keys.push(line.slice(0, 200));
    if (keys.length >= max) break;
  }
  return keys.slice(0, max);
}
