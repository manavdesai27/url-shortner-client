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