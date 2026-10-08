import { useEffect, useState } from 'react';
import { Tag, Tooltip } from 'antd';
import { overText, type SlaChip as SlaChipData } from '@vclinks/shared';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

/** Chip text of the list (00 §3.4 "Chip ngắn"): only "Sắp quá" and "Quá hạn"; the rest shows nothing. */
export function slaShortText(chip: SlaChipData | null | undefined, nowMs: number): { text: string; level: 'warn' | 'over' } | null {
  if (!chip) return null;
  const due = Date.parse(chip.dueAt);
  // The API computed the chip when it answered; past the deadline the text is recomputed here (every 30 s).
  if (nowMs >= due) return { text: overText(Math.floor((nowMs - due) / 60_000)), level: 'over' };
  if (chip.level === 'warn' && chip.text) return { text: chip.text, level: 'warn' };
  return null;
}

/** SLA chip of a conversation row (UI-TP-03 `short`); redraws every 30 seconds. */
export default function SlaChip({ chip }: { chip: SlaChipData | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const s = slaShortText(chip, now);
  if (!s || !chip) return null;
  const tip = `Hạn phản hồi đầu: ${hhmm(chip.dueAt)} · SLA ${chip.slaMinutes} phút theo giờ làm việc${chip.divisionName ? ` của ${chip.divisionName}` : ''}`;
  return (
    <Tooltip title={tip}>
      <Tag className={`sla-chip sla-chip--${s.level}`} bordered={false}>
        {s.text}
      </Tag>
    </Tooltip>
  );
}
