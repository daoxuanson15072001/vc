/**
 * Health of one connected account as a sale sees it (M1a-02, 03 SZ-10/SZ-12):
 * green = connected, yellow = slow (commands still queue), red = cannot send,
 * unsafe = flagged "Chưa an toàn" (locks sending like red even if the dot is green).
 * Only states, short Vietnamese reasons and ids — never message content.
 */
export const HEALTH_LEVELS = ['green', 'yellow', 'red', 'unsafe'] as const;
export type HealthLevel = (typeof HEALTH_LEVELS)[number];

/** The extension is offline (red) after this long without a heartbeat (SZ-10). */
export const HEALTH_OFFLINE_MS = 2 * 60_000;

export interface AccountHealth {
  uid: string;
  level: HealthLevel;
  /** Short chip text: "Đang kết nối", "Chậm", "Mất kết nối", "Chưa an toàn". */
  label: string;
  /** Business sentence explaining the state; null when green. */
  reason: string | null;
  /** Technical cause for the Admin ("Chi tiết cho Admin"); null when green. */
  technical: string | null;
  /** ISO time the current level began (red: shown as "từ HH:mm"); null if unknown. */
  since: string | null;
  lastSyncAt: string | null;
  /** False for red and unsafe: the API refuses new commands (SZ-10). */
  canSend: boolean;
  /** Test phase (SZ-14): when set, commands only go to these thread ids. */
  onlyThreadIds: string[] | null;
  /** Approved/sending commands waiting, and failed ones. */
  pendingCommands: number;
  failedCommands: number;
  /** How the máy Zalo runs this nick: `direct` (zca-js) or `browser` (Zalo Web); absent = not on the máy Zalo. */
  farmMode?: 'direct' | 'browser' | null;
}

/** Sentence shown when a thread is outside the test allowlist (SZ-14). */
export const TEST_PHASE_MESSAGE =
  'Giai đoạn thử: VClinks chỉ gửi vào nhóm "Kiểm thử vclink". Hãy trả lời khách trên Zalo.';
