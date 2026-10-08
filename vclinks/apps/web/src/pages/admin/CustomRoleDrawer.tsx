import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Drawer, Form, Input, Select, Space, Table, Tooltip, Typography } from 'antd';
import {
  ROLE_KEYS,
  ROLE_LABELS,
  ROLE_MATRIX,
  SCOPE_CODES,
  allowedScopes,
  ceilingMessage,
  customField,
  foldVi,
  roleShortName,
  type CustomRolePicks,
  type PermCell,
  type PermissionKey,
  type RoleColumn,
  type RoleKey,
  type ScopeCode,
} from '@vclinks/shared';
import { adminApi, type RolesResponse } from './adminApi';
import { cellHint, cellText } from './roleCells';

export type DrawerTarget = { kind: 'new'; base?: RoleKey } | { kind: 'edit'; role: RoleColumn };

/** Data scopes nested from widest to narrowest (MH-PQ-05 #7). */
const CHAIN: readonly ScopeCode[] = ['TD', 'DV', 'TO', 'NH', 'CT'];

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Choices of one row: what the base cell keeps or narrows to, plus the wider nested scopes, shown locked. */
function choices(cell: PermCell | undefined, key: PermissionKey): { value: ScopeCode; allowed: boolean }[] {
  const own = cell?.[customField(key)] ?? [];
  const allowed = allowedScopes(cell, key);
  const nested = own.some((s) => CHAIN.includes(s));
  return SCOPE_CODES.filter((c) => allowed.includes(c) || (nested && CHAIN.includes(c) && (c !== 'NH' || own.includes('NH')))).map((c) => ({
    value: c,
    allowed: allowed.includes(c),
  }));
}

const startValues = (base: RoleKey, picks: CustomRolePicks = {}) => {
  const out: Partial<Record<PermissionKey, ScopeCode[]>> = {};
  for (const [k, cell] of Object.entries(ROLE_MATRIX[base] ?? {}) as [PermissionKey, PermCell][]) {
    out[k] = picks[k] ?? [...(cell[customField(k)] ?? [])];
  }
  return out;
};

/**
 * Drawer of MH-PQ-05 #5–#8: copy a system role and keep, narrow or remove each scope (PQ-06). A scope
 * wider than the base role is locked with "Vượt quyền của vai trò gốc <tên>."; the base role is fixed
 * once the role exists.
 */
export default function CustomRoleDrawer({
  target,
  keys,
  scopes,
  names,
  onClose,
  onSaved,
}: {
  target: DrawerTarget;
  keys: RolesResponse['keys'];
  scopes: RolesResponse['scopes'];
  names: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const editing = target.kind === 'edit' ? target.role : null;
  const [base, setBase] = useState<RoleKey | undefined>(editing?.baseRole ?? (target.kind === 'new' ? target.base : undefined));
  const [name, setName] = useState(editing?.label ?? (base ? `${roleShortName(base)} (tùy chỉnh)` : ''));
  const [nameTouched, setNameTouched] = useState(!!editing);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [values, setValues] = useState(() => (base ? startValues(base, editing?.picks) : {}));
  const [text, setText] = useState('');
  const [onlyBase, setOnlyBase] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const row = base ? (ROLE_MATRIX[base] ?? {}) : {};
  const pickBase = (r: RoleKey) => {
    setBase(r);
    setValues(startValues(r));
    if (!nameTouched) setName(`${roleShortName(r)} (tùy chỉnh)`);
  };

  const trimmed = name.trim();
  const nameError =
    trimmed.length < 2 || trimmed.length > 60
      ? 'Tên vai trò 2–60 ký tự.'
      : names.some((n) => n.id !== editing?.roleKey && foldVi(n.name) === foldVi(trimmed))
        ? `Đã có vai trò "${trimmed}".`
        : null;

  const picks = useMemo(() => {
    const out: CustomRolePicks = {};
    if (!base) return out;
    for (const [k, v] of Object.entries(values) as [PermissionKey, ScopeCode[]][]) {
      if (!sameSet(v, ROLE_MATRIX[base]?.[k]?.[customField(k)] ?? [])) out[k] = v;
    }
    return out;
  }, [base, values]);
  const narrowed = Object.keys(picks).length;

  const shown = useMemo(() => {
    const needle = foldVi(text.trim());
    return keys.filter(
      (k) =>
        (!onlyBase || allowedScopes(row[k.key], k.key).length > 0) &&
        (!needle || foldVi(k.label).includes(needle) || foldVi(k.key).includes(needle) || foldVi(k.section).includes(needle)),
    );
  }, [keys, row, text, onlyBase]);

  const save = async () => {
    if (!base || nameError) return;
    setSaving(true);
    setError(null);
    try {
      const body = { name: trimmed, baseRole: base, description: description.trim(), picks };
      const res = editing ? await adminApi.updateCustomRole(editing.roleKey, body) : await adminApi.createCustomRole(body);
      onSaved(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      width={920}
      onClose={onClose}
      title={editing ? `Sửa vai trò ${editing.label}` : 'Sao chép thành vai trò mới'}
      destroyOnClose
      // Many picks can be lost by a stray Esc or click outside: only "Hủy" / × close it.
      keyboard={false}
      maskClosable={false}
      extra={
        <Space>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary" loading={saving} disabled={!base || !!nameError} onClick={save}>
            {editing ? 'Lưu' : 'Tạo vai trò'}
          </Button>
        </Space>
      }
    >
      {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} closable onClose={() => setError(null)} />}
      <Form layout="vertical" requiredMark>
        <Space align="start" wrap style={{ width: '100%' }}>
          <Form.Item label="Vai trò gốc" required style={{ width: 260 }} extra={editing ? 'Không đổi được sau khi tạo.' : 'Vai trò mới chỉ có thể bớt quyền của vai trò này.'}>
            <Select
              value={base}
              disabled={!!editing}
              placeholder="Chọn vai trò hệ thống"
              onChange={pickBase}
              options={ROLE_KEYS.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
          </Form.Item>
          <Form.Item
            label="Tên vai trò"
            required
            style={{ width: 300 }}
            validateStatus={nameError && (nameTouched || base) ? 'error' : undefined}
            help={nameError && (nameTouched || base) ? nameError : undefined}
          >
            <Input
              value={name}
              maxLength={60}
              showCount
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
            />
          </Form.Item>
          {editing && (
            <Form.Item label="Mã" extra="Dùng ở cột vai_tro khi nhập người dùng từ file.">
              <Typography.Text code copyable>
                {editing.roleKey}
              </Typography.Text>
            </Form.Item>
          )}
        </Space>
        <Form.Item label="Mô tả">
          <Input.TextArea value={description} maxLength={300} showCount autoSize={{ minRows: 2, maxRows: 4 }} onChange={(e) => setDescription(e.target.value)} />
        </Form.Item>
      </Form>
      {editing && (editing.assignedCount ?? 0) > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${editing.assignedCount} người đang có vai trò này: quyền mới áp dụng cho họ trong vòng 1 phút sau khi lưu.`}
        />
      )}
      {base ? (
        <>
          <Space wrap style={{ marginBottom: 8 }}>
            <Input.Search allowClear placeholder="Tìm quyền" style={{ width: 240 }} value={text} onChange={(e) => setText(e.target.value)} />
            <Checkbox checked={onlyBase} onChange={(e) => setOnlyBase(e.target.checked)}>
              Chỉ hiện quyền vai trò gốc có
            </Checkbox>
            <Typography.Text type="secondary">
              {narrowed ? `Đã bớt hoặc thu hẹp ${narrowed} quyền.` : 'Đang giống hệt vai trò gốc.'} Bỏ hết phạm vi của một dòng = ✖.
            </Typography.Text>
          </Space>
          <Table
            size="small"
            rowKey="key"
            pagination={false}
            dataSource={shown}
            scroll={{ y: 520 }}
            columns={[
              {
                title: 'Chức năng',
                key: 'label',
                render: (_: unknown, k: RolesResponse['keys'][number]) => (
                  <div>
                    <div>{k.label}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {k.section} · {k.key}
                    </Typography.Text>
                  </div>
                ),
              },
              {
                title: `Gốc: ${roleShortName(base)}`,
                key: 'base',
                width: 150,
                render: (_: unknown, k: RolesResponse['keys'][number]) => (
                  <Tooltip title={cellHint(row[k.key])}>
                    <span>{cellText(row[k.key], scopes)}</span>
                  </Tooltip>
                ),
              },
              {
                title: 'Vai trò mới',
                key: 'pick',
                width: 300,
                render: (_: unknown, k: RolesResponse['keys'][number]) => {
                  const cell = row[k.key];
                  const opts = choices(cell, k.key);
                  // The always-shown phone follows the relation with the customer (PQ-45); only "Hiện" is narrowed.
                  const phone =
                    customField(k.key) === 'reveal' ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Luôn hiện: {cell?.s.length ? cell.s.map((s) => scopes[s]).join(', ') : 'không'} (theo quan hệ với khách)
                        {opts.some((o) => o.allowed) ? ' · Bấm "Hiện":' : ' · Không có nút "Hiện"'}
                      </Typography.Text>
                    ) : null;
                  if (!opts.some((o) => o.allowed)) {
                    return (
                      phone ?? (
                        <Tooltip title={ceilingMessage(base)}>
                          <span style={{ color: 'var(--muted, #999)' }}>✖</span>
                        </Tooltip>
                      )
                    );
                  }
                  const select = (
                    <Select
                      mode="multiple"
                      size="small"
                      style={{ minWidth: 180, width: '100%' }}
                      placeholder="✖ (không có)"
                      value={values[k.key] ?? []}
                      onChange={(v: ScopeCode[]) => setValues((cur) => ({ ...cur, [k.key]: v }))}
                      options={opts.map((o) => ({
                        value: o.value,
                        disabled: !o.allowed,
                        label: o.allowed ? (
                          scopes[o.value]
                        ) : (
                          <Tooltip title={ceilingMessage(base)}>
                            <span>{scopes[o.value]}</span>
                          </Tooltip>
                        ),
                      }))}
                      aria-label={`Phạm vi ${k.label}`}
                    />
                  );
                  if (phone) {
                    return (
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        {phone}
                        {select}
                      </Space>
                    );
                  }
                  return select;
                },
              },
            ]}
          />
        </>
      ) : (
        <Alert type="info" showIcon message="Chọn vai trò gốc để xem và bớt quyền." />
      )}
    </Drawer>
  );
}
