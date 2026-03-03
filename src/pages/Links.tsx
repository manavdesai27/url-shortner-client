import { useEffect, useMemo, useRef, useState } from 'react';
import UrlList from '../components/UrlList.jsx';
import { useAuth } from '../context/AuthContext.tsx';
import RulesEditor from '../components/rules/RulesEditor';

const apiBase =
  (import.meta.env.VITE_API_BASE as string) ||
  (import.meta.env.DEV ? (import.meta.env.VITE_API_URL as string) : '/api');
const shortDomain = import.meta.env.VITE_SHORT_DOMAIN as string;

type Item = {
  url: string;
  shortUrl: string;
  shortCode: string;
  clickCount?: number;
  createdAt?: string;
  expiresAt?: string | null;
};

type PageResponse = {
  content: Array<{
    shortCode: string;
    originalUrl: string;
    clickCount: number;
    createdAt: string;
    expiresAt: string | null;
  }>;
  number: number;        // current page index
  size: number;          // page size
  totalElements: number; // total items
  totalPages: number;    // total pages
  last: boolean;         // is last page
};

type SortField = 'createdAt' | 'clickCount';
type SortDir = 'asc' | 'desc';

type RuleTypeUI = 'TIME' | 'DEVICE' | 'COUNTRY' | 'AB';

type RuleDto = {
  id?: number;
  type: RuleTypeUI;
  priority?: number;
  targetUrl: string;
  active?: boolean;
  // Pass-through config object; structure depends on type
  // TIME: { startIso?: string, endIso?: string }
  // DEVICE: { devices?: string[] }
  // COUNTRY: { countries?: string[] }
  // AB: { buckets?: Array<{ pct: number, url: string }> }
  config?: any;
};

type RuleSetDto = {
  enabled?: boolean;
  version?: number;
  rules: RuleDto[];
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
    // Normalize to actual UTC ISO string
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

export default function Links() {
  const { user, loading: authLoading, apiFetch } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Rules editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingShortCode, setEditingShortCode] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [form, setForm] = useState<RuleSetDto>({ enabled: false, rules: [] });

  // Analytics controls
  const [includeExpired, setIncludeExpired] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const canFetch = useMemo(() => !!user && !authLoading, [user, authLoading]);

  async function fetchPage(p: number) {
    if (!canFetch || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const url =
        `${apiBase}/links?page=${p}&size=${size}` +
        `&includeExpired=${includeExpired}` +
        `&sort=${encodeURIComponent(`${sortField},${sortDir}`)}`;

      const res = await apiFetch(url);
      if (!res.ok) {
        setErrorMsg(`Failed to load links (status ${res.status})`);
        setLoading(false);
        return;
      }
      const data: PageResponse = await res.json();
      const mapped: Item[] = (data.content || []).map((row) => ({
        url: row.originalUrl,
        shortUrl: `${shortDomain}/${row.shortCode}`,
        shortCode: row.shortCode,
        clickCount: row.clickCount,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      }));
      setItems((prev: Item[]) => (p === 0 ? mapped : prev.concat(mapped)));
      setHasMore(!data.last);
      setPage(data.number);
    } catch {
      setErrorMsg('Network error while loading links.');
    } finally {
      setLoading(false);
    }
  }

  const lastQueryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canFetch) {
      // logged out or auth not ready: reset and clear query key
      setItems([] as Item[]);
      setPage(0);
      setHasMore(true);
      setErrorMsg(null);
      lastQueryKeyRef.current = null;
      return;
    }

    // Build a stable key for current controls
    const key = `${includeExpired}|${sortField}|${sortDir}`;

    // Only fetch when controls effectively change (dedupe StrictMode double-invoke)
    if (lastQueryKeyRef.current === key) {
      return;
    }
    lastQueryKeyRef.current = key;

    // reset then fetch first page for new controls
    setItems([] as Item[]);
    setPage(0);
    setHasMore(true);
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch, includeExpired, sortField, sortDir]);


  function loadMore() {
    if (hasMore && !loading) {
      fetchPage(page + 1);
    }
  }

  async function refreshClicks(shortCode: string) {
    try {
      const res = await apiFetch(`${apiBase}/analytics/${shortCode}`);
      if (!res.ok) {
        // Non-owner or missing - surface a soft error
        setErrorMsg(`Failed to refresh clicks for ${shortCode} (status ${res.status})`);
        return;
      }
      const data = await res.json();
      const newCount = typeof data.clickCount === 'number' ? data.clickCount : undefined;
      if (typeof newCount === 'number') {
        setItems((prev: Item[]) =>
          prev.map((it) =>
            it.shortCode === shortCode ? { ...it, clickCount: newCount } : it
          )
        );
      }
    } catch {
      setErrorMsg('Network error while refreshing clicks.');
    }
  }

  // ===== Rules Editor Handlers =====
  function openRulesEditor(sc: string) {
    setEditingShortCode(sc);
    setEditorOpen(true);
  }

  function closeRulesEditor() {
    setEditorOpen(false);
    setEditingShortCode(null);
    setRulesError(null);
  }

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

  function updateRuleField(idx: number, field: keyof RuleDto, value: any) {
    setForm((prev) => {
      const rules = [...(prev.rules || [])];
      rules[idx] = { ...rules[idx], [field]: value };
      if (field === 'type') {
        rules[idx].config = {};
      }
      return { ...prev, rules };
    });
  }

  // Config updaters
  function toggleDevice(idx: number, device: string, checked: boolean) {
    setForm((prev) => {
      const rules = [...(prev.rules || [])];
      const cur: string[] = Array.isArray(rules[idx].config?.devices) ? [...rules[idx].config.devices] : [];
      const next = checked ? Array.from(new Set([...cur, device])) : cur.filter((d) => d !== device);
      rules[idx] = { ...rules[idx], config: { ...(rules[idx].config || {}), devices: next } };
      return { ...prev, rules };
    });
  }

  function setCountries(idx: number, text: string) {
    const arr = splitCountries(text);
    setForm((prev) => {
      const rules = [...(prev.rules || [])];
      rules[idx] = { ...rules[idx], config: { ...(rules[idx].config || {}), countries: arr } };
      return { ...prev, rules };
    });
  }

  function setTime(idx: number, key: 'startIso' | 'endIso', localVal: string) {
    const iso = localToIso(localVal);
    setForm((prev) => {
      const rules = [...(prev.rules || [])];
      const cfg = { ...(rules[idx].config || {}) } as any;
      if (iso) cfg[key] = iso;
      else delete cfg[key];
      rules[idx] = { ...rules[idx], config: cfg };
      return { ...prev, rules };
    });
  }

  function addBucket(idx: number) {
    setForm((prev) => {
      const rules = [...(prev.rules || [])];
      const buckets: any[] = Array.isArray(rules[idx].config?.buckets) ? [...rules[idx].config.buckets] : [];
      buckets.push({ pct: 50, url: '' });
      rules[idx] = { ...rules[idx], config: { ...(rules[idx].config || {}), buckets } };
      return { ...prev, rules };
    });
  }

  function updateBucket(idx: number, bIndex: number, field: 'pct' | 'url', value: any) {
    setForm((prev) => {
      const rules = [...(prev.rules || [])];
      const buckets: any[] = Array.isArray(rules[idx].config?.buckets) ? [...rules[idx].config.buckets] : [];
      const b = { ...(buckets[bIndex] || { pct: 0, url: '' }) };
      b[field] = field === 'pct' ? (parseInt(value, 10) || 0) : value;
      buckets[bIndex] = b;
      rules[idx] = { ...rules[idx], config: { ...(rules[idx].config || {}), buckets } };
      return { ...prev, rules };
    });
  }

  function removeBucket(idx: number, bIndex: number) {
    setForm((prev) => {
      const rules = [...(prev.rules || [])];
      const buckets: any[] = Array.isArray(rules[idx].config?.buckets) ? [...rules[idx].config.buckets] : [];
      buckets.splice(bIndex, 1);
      rules[idx] = { ...rules[idx], config: { ...(rules[idx].config || {}), buckets } };
      return { ...prev, rules };
    });
  }

  async function saveRules() {
    if (!editingShortCode) return;
    setRulesSaving(true);
    setRulesError(null);
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
      const res = await apiFetch(`${apiBase}/links/${editingShortCode}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setRulesError(`Failed to save (status ${res.status})`);
        return;
      }
      closeRulesEditor();
    } catch {
      setRulesError('Network error while saving rules.');
    } finally {
      setRulesSaving(false);
    }
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>My Shortened Links</h2>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={includeExpired}
            onChange={(e) => setIncludeExpired(e.target.checked)}
          />
          Include expired
        </label>

        <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
          Sort by
          <select
            value={`${sortField},${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(',') as [SortField, SortDir];
              setSortField(field);
              setSortDir(dir);
            }}
          >
            <option value="createdAt,desc">Newest</option>
            <option value="createdAt,asc">Oldest</option>
            <option value="clickCount,desc">Most clicks</option>
            <option value="clickCount,asc">Least clicks</option>
          </select>
        </label>
      </div>

      {errorMsg && (
        <div
          role="alert"
          style={{
            background: '#fdecea',
            color: '#b71c1c',
            padding: '0.75rem 1rem',
            borderRadius: 6,
            marginBottom: '1rem',
            border: '1px solid #f5c6cb',
          }}
        >
          {errorMsg}
        </div>
      )}
      {authLoading ? (
        <p>Loading…</p>
      ) : !user ? (
        <p>You must be logged in to view your links.</p>
      ) : (
        <>
          {items.length === 0 && !loading ? (
            <p>No links yet. Shorten a URL on the home page to get started.</p>
          ) : (
            <UrlList urlList={items} onRefresh={refreshClicks} onManageRules={openRulesEditor} />
          )}
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            {hasMore && (
              <button
                type="button"
                className="btn btn-cta"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>

          {editorOpen && (
            <RulesEditor
              isOpen={editorOpen}
              shortCode={editingShortCode}
              apiBase={apiBase}
              apiFetch={apiFetch}
              onClose={closeRulesEditor}
            />
          )}
        </>
      )}
    </div>
  );
}