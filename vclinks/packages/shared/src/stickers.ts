/**
 * Zalo Web's sticker panel (surveyed live 29/09/2026, docs/04-ky-thuat/zalo-web/zalo-dom-selectors.md):
 * every account has the built-in default set "Củ hành" of 40 stickers whose
 * panel thumbnails are public CDN images, `default/thumb/<n>.png`. Sets the
 * account added are listed as more `div_StickerMenu_SetItem[title]` tabs; the
 * Dashboard only offers the default set for now (a catalog of added sets
 * would need the extension to read Zalo's `sticker` IndexedDB store).
 */

export interface StickerSet {
  /** Tab title in Zalo's panel, exactly. */
  title: string;
  /** Number of stickers in the set. */
  count: number;
  /** Thumbnail of the n-th sticker (1-based), as shown in the panel. */
  thumb: (index: number) => string;
}

export const ZALO_DEFAULT_STICKER_SET: StickerSet = {
  title: 'Củ hành',
  count: 40,
  thumb: (index) => `https://stc-chat.zdn.vn/images/stickers/default/thumb/${index}.png`,
};

/** Sets the Dashboard can offer without a per-account catalog. */
export const STICKER_SETS: readonly StickerSet[] = [ZALO_DEFAULT_STICKER_SET];
