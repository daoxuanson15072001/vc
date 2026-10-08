import { Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import type { AccountStatus } from '@vclinks/shared';
import { api } from '../api';

export function useAccounts(refetchInterval?: number) {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api<AccountStatus[]>('/accounts'),
    refetchInterval,
  });
}

const ALL = '__all__';

export default function AccountSelect({ value, onChange }: { value?: string; onChange: (uid?: string) => void }) {
  const { data, isLoading } = useAccounts();
  return (
    <Select
      style={{ width: 220 }}
      loading={isLoading}
      value={value ?? ALL}
      onChange={(v) => onChange(v === ALL ? undefined : v)}
      options={[
        { value: ALL, label: 'Tất cả tài khoản' },
        ...(data ?? []).map((a) => ({ value: a.uid, label: a.label || a.uid })),
      ]}
    />
  );
}
