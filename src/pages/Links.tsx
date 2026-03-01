import { useEffect, useMemo, useState } from 'react';
import UrlList from '../components/UrlList.jsx';
import { useAuth } from '../context/AuthContext.tsx';

const apiUrl = import.meta.env.VITE_API_URL as string;

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

export default function Links() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canFetch = useMemo(() => !!user && !authLoading, [user, authLoading]);

  async function fetchPage(p: number) {
    if (!canFetch || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${apiUrl}/links?page=${p}&size=${size}&includeExpired=false`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        setErrorMsg(`Failed to load links (status ${res.status})`);
        setLoading(false);
        return;
      }
      const data: PageResponse = await res.json();
      const mapped: Item[] = (data.content || []).map((row) => ({
        url: row.originalUrl,
        shortUrl: `${apiUrl}/${row.shortCode}`,
        shortCode: row.shortCode,
        clickCount: row.clickCount,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      }));
      setItems((prev) => (p === 0 ? mapped : prev.concat(mapped)));
      setHasMore(!data.last);
      setPage(data.number);
    } catch {
      setErrorMsg('Network error while loading links.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canFetch) {
      // initial load
      fetchPage(0);
    } else {
      // reset when logged out
      setItems([]);
      setPage(0);
      setHasMore(true);
      setErrorMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch]);

  function loadMore() {
    if (hasMore && !loading) {
      fetchPage(page + 1);
    }
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>My Shortened Links</h2>
      {errorMsg && (
        <div role="alert" style={{
          background: '#fdecea',
          color: '#b71c1c',
          padding: '0.75rem 1rem',
          borderRadius: 6,
          marginBottom: '1rem',
          border: '1px solid #f5c6cb'
        }}>
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
            <UrlList urlList={items} />
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
        </>
      )}
    </div>
  );
}