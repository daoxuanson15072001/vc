/**
 * Text of a message VClinks itself sent, keyed by the Zalo cliMsgId the
 * extension reported. The extension sends one Zalo message per non-empty line
 * (compose.ts splitLines), so a multi-line send maps line i to cliMsgIds[i].
 * Older items carry only the last cliMsgId: it gets the last line.
 */
export interface SentTextSource {
  finalText: string;
  cliMsgId?: string | null;
  cliMsgIds?: string[] | null;
}

/** Same split as the extension: one message per trimmed, non-empty line. */
export function sentLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/ /g, ' ').replace(/[​-‍﻿]/g, '').trim())
    .filter((l) => l.length > 0);
}

export function sentTextByCliMsgId(src: SentTextSource): Map<string, string> {
  const out = new Map<string, string>();
  const lines = sentLines(src.finalText);
  if (!lines.length) return out;
  const ids = (src.cliMsgIds ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (ids.length && ids.length === lines.length) {
    ids.forEach((id, i) => out.set(id, lines[i]));
    return out;
  }
  if (src.cliMsgId) out.set(src.cliMsgId, lines[lines.length - 1]);
  return out;
}
