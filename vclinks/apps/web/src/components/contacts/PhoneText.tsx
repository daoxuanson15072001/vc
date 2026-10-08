import { Typography } from 'antd';

/**
 * Phone number of a contact (03 MH-SZ-09 #7, 01 PQ-36/PQ-45). The rule "who sees
 * the full number" comes with M1b-05; until then every viewer sees it in full
 * (`masked` stays false). The masked form is `0900 *** 101` and will get a
 * "Hiện" action logged per reveal.
 */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return raw.trim();
}

export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length < 7) return '***';
  return `${d.slice(0, 4)} *** ${d.slice(-3)}`;
}

export default function PhoneText({ phone, masked = false }: { phone: string | null | undefined; masked?: boolean }) {
  if (!phone) return <Typography.Text type="secondary">–</Typography.Text>;
  return <span style={{ whiteSpace: 'nowrap' }}>{masked ? maskPhone(phone) : formatPhone(phone)}</span>;
}
