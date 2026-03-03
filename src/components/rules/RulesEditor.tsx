import React, { useEffect, useMemo, useState } from 'react';

export type RuleTypeUI = 'TIME' | 'DEVICE' | 'COUNTRY' | 'AB';

export type RuleDto = {
  id?: number;
  type: RuleTypeUI;
  priority?: number;
  targetUrl: string;
  active?: boolean;
  // TIME: { startIso?: string, endIso?: string }
  // DEVICE: { devices?: string[] }
  // COUNTRY: { countries?: string[] }
  // AB: { buckets?: Array<{ pct: number, url: string }> }
  config?: any;
};

export type RuleSetDto = {
  enabled?: boolean;
  version?: number;
  rules: RuleDto[];
};

type Props = {
  isOpen: boolean;
  shortCode: string | null;
  apiBase: string;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
};

function isoToLocal(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function localToIso(local: string): string | undefined {
  if (!local) return undefined;
  try {
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return undefined;
    const tzOffset = d.getTimezoneOffset() * 60000;
    const utc = new Date(d.getTime() - tzOffset);
    return utc.toISOString();
  } catch {
    return undefined;
  }
}

function splitCountries(text: string): string[] {
  return (text || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function joinCountries(arr?: string[]): string {
  return (arr || []).join(',');
}

export default function RulesEditor({ isOpen, shortCode, apiBase, apiFetch, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RuleSetDto>({ enabled: false, rules: [] });

  const canLoad = useMemo(() => isOpen && !!shortCode, [isOpen, shortCode]);

  useEffect(() => {
    if (!canLoad) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`${apiBase}/links/${shortCode}/rules`);
        if (!res.ok) {
          if (!cancelled) setError(`Failed to load rules (status ${res.status})`);
          return;
        }
        const data: RuleSetDto = await res.json();
        if (cancelled) return;
        setForm({
          enabled: !!data.enabled,
          version: data.version,
          rules: (data.rules || []).map((r) => ({
            id: r.id,
            type: r.type,
            priority: typeof r.priority === 'number' ? r.priority : 100,
            targetUrl: r.targetUrl || '',
            active: r.active !== false,
            config: r.config || {},
          })),
        });
      } catch {
        if (!cancelled) setError('Network error while loading rules.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, apiFetch, canLoad, shortCode]);

  function setEnabled(v: boolean) {
    setForm((prev) => ({ ...prev, enabled: v }));
  }

  function addRule() {
    setForm((prev) => ({
      ...prev,
      rules: [...(prev.rules || []), { type: 'DEVICE', priority: 100, targetUrl: '', active: true, config: {} }],
    }));
  }

  function removeRule(idx: number) {
    setForm((prev) => ({ ...prev, rules: (prev.rules || []).filter((_, i) => i !== idx) }));
  }

  function updateRule(idx: number, next: RuleDto) {
    setForm((prev) => {
      const rules = [...(prev.rules || [])];
      rules[idx] = next;
      return { ...prev, rules };
    });
  }

  async function save() {
    if (!shortCode) return;
    setSaving(true);
    setError(null);
    try {
      const payload: RuleSetDto = {
        enabled: !!form.enabled,
        rules: (form.rules || []).map((r) => ({
          id: r.id,
          type: r.type,
          priority: typeof r.priority === 'number' ? r.priority : 100,
          targetUrl: r.targetUrl,
          active: r.active !== false,
          config: r.config || {},
        })),
      };
      const res = await apiFetch(`${apiBase}/links/${shortCode}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(`Failed to save (status ${res.status})`);
        return;
      }
      onClose();
    } catch {
      setError('Network error while saving rules.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          color: '#222',
          width: 'min(920px, 95vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 8,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          padding: '1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Manage rules for {shortCode}</h3>
          <button className="btn btn-cta" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? (
          <p>Loading rules…</p>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                style={{
                  background: '#fdecea',
                  color: '#b71c1c',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 6,
                  marginBottom: '0.75rem',
                  border: '1px solid #f5c6cb',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!form.enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Rules enabled
              </label>
              <span style={{ color: '#666' }}>Version: {form.version ?? 0}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(form.rules || []).map((r, idx) => (
                <RuleCard
                  key={idx}
                  value={r}
                  onChange={(next) => updateRule(idx, next)}
                  onRemove={() => removeRule(idx)}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" className="btn btn-cta" onClick={addRule}>
                Add rule
              </button>
              <button type="button" className="btn btn-cta" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RuleCard({
  value,
  onChange,
  onRemove,
}: {
  value: RuleDto;
  onChange: (next: RuleDto) => void;
  onRemove: () => void;
}) {
  function updateField<K extends keyof RuleDto>(field: K, val: RuleDto[K]) {
    const next: RuleDto = { ...value, [field]: val };
    if (field === 'type') {
      next.config = {};
    }
    onChange(next);
  }

  function toggleDevice(device: string, checked: boolean) {
    const cur: string[] = Array.isArray(value.config?.devices) ? [...value.config.devices] : [];
    const nextDevices = checked ? Array.from(new Set([...cur, device])) : cur.filter((d) => d !== device);
    onChange({ ...value, config: { ...(value.config || {}), devices: nextDevices } });
  }

  function setCountriesText(text: string) {
    const arr = splitCountries(text);
    onChange({ ...value, config: { ...(value.config || {}), countries: arr } });
  }

  function setTime(key: 'startIso' | 'endIso', localVal: string) {
    const iso = localToIso(localVal);
    const cfg = { ...(value.config || {}) } as any;
    if (iso) cfg[key] = iso;
    else delete cfg[key];
    onChange({ ...value, config: cfg });
  }

  function addBucket() {
    const buckets: any[] = Array.isArray(value.config?.buckets) ? [...value.config.buckets] : [];
    buckets.push({ pct: 50, url: '' });
    onChange({ ...value, config: { ...(value.config || {}), buckets } });
  }

  function updateBucket(bIndex: number, field: 'pct' | 'url', val: any) {
    const buckets: any[] = Array.isArray(value.config?.buckets) ? [...value.config.buckets] : [];
    const b = { ...(buckets[bIndex] || { pct: 0, url: '' }) };
    b[field] = field === 'pct' ? (parseInt(val, 10) || 0) : val;
    buckets[bIndex] = b;
    onChange({ ...value, config: { ...(value.config || {}), buckets } });
  }

  function removeBucket(bIndex: number) {
    const buckets: any[] = Array.isArray(value.config?.buckets) ? [...value.config.buckets] : [];
    buckets.splice(bIndex, 1);
    onChange({ ...value, config: { ...(value.config || {}), buckets } });
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: 6,
        padding: '0.75rem',
        background: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          <span style={{ display: 'block', fontSize: 12, color: '#666' }}>Type</span>
          <select
            value={value.type}
            onChange={(e) => updateField('type', e.target.value as RuleTypeUI)}
          >
            <option value="TIME">TIME</option>
            <option value="DEVICE">DEVICE</option>
            <option value="COUNTRY">COUNTRY</option>
            <option value="AB">AB</option>
          </select>
        </label>

        <label>
          <span style={{ display: 'block', fontSize: 12, color: '#666' }}>Priority</span>
          <input
            type="number"
            value={typeof value.priority === 'number' ? value.priority : 100}
            onChange={(e) => updateField('priority', parseInt(e.target.value, 10) || 0)}
            style={{ width: 100 }}
          />
        </label>

        <label style={{ flex: 1, minWidth: 240 }}>
          <span style={{ display: 'block', fontSize: 12, color: '#666' }}>Target URL</span>
          <input
            type="url"
            value={value.targetUrl || ''}
            onChange={(e) => updateField('targetUrl', e.target.value)}
            placeholder="https://destination.example.com"
            style={{ width: '100%' }}
          />
        </label>

        <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={value.active !== false}
            onChange={(e) => updateField('active', e.target.checked)}
          />
          Active
        </label>

        <button type="button" className="btn btn-cta" onClick={onRemove}>
          Remove
        </button>
      </div>

      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #ddd' }}>
        {value.type === 'TIME' && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label>
              <span style={{ display: 'block', fontSize: 12, color: '#666' }}>Start</span>
              <input
                type="datetime-local"
                value={isoToLocal(value.config?.startIso)}
                onChange={(e) => setTime('startIso', e.target.value)}
              />
            </label>
            <label>
              <span style={{ display: 'block', fontSize: 12, color: '#666' }}>End</span>
              <input
                type="datetime-local"
                value={isoToLocal(value.config?.endIso)}
                onChange={(e) => setTime('endIso', e.target.value)}
              />
            </label>
          </div>
        )}

        {value.type === 'DEVICE' && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {['MOBILE', 'DESKTOP', 'TABLET', 'BOT'].map((dv) => {
              const has = Array.isArray(value.config?.devices) && value.config.devices.includes(dv);
              return (
                <label key={dv} style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!has}
                    onChange={(e) => toggleDevice(dv, e.target.checked)}
                  />
                  {dv}
                </label>
              );
            })}
          </div>
        )}

        {value.type === 'COUNTRY' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <label style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 12, color: '#666' }}>Countries (comma-separated ISO codes)</span>
              <input
                type="text"
                value={joinCountries(value.config?.countries)}
                onChange={(e) => setCountriesText(e.target.value)}
                placeholder="US,IN,FR"
                style={{ width: '100%' }}
              />
            </label>
          </div>
        )}

        {value.type === 'AB' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <button type="button" className="btn btn-cta" onClick={addBucket}>
                Add bucket
              </button>
              <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                Buckets should sum to 100; remainder is ignored.
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(Array.isArray(value.config?.buckets) ? value.config.buckets : []).map((b: any, bIndex: number) => (
                <div key={bIndex} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label>
                    <span style={{ display: 'block', fontSize: 12, color: '#666' }}>%</span>
                    <input
                      type="number"
                      value={typeof b?.pct === 'number' ? b.pct : 0}
                      onChange={(e) => updateBucket(bIndex, 'pct', e.target.value)}
                      style={{ width: 80 }}
                    />
                  </label>
                  <label style={{ flex: 1, minWidth: 240 }}>
                    <span style={{ display: 'block', fontSize: 12, color: '#666' }}>URL</span>
                    <input
                      type="url"
                      value={b?.url || ''}
                      onChange={(e) => updateBucket(bIndex, 'url', e.target.value)}
                      placeholder="https://variant.example.com"
                      style={{ width: '100%' }}
                    />
                  </label>
                  <button type="button" className="btn btn-cta" onClick={() => removeBucket(bIndex)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}