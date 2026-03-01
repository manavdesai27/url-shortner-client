import { useState } from "react"

/**
 * @typedef {Object} UrlItem
 * @property {string} url
 * @property {string} shortUrl
 * @property {string} shortCode
 * @property {number} [clickCount]
 * @property {string} [createdAt]
 * @property {string|null} [expiresAt]
 */

/**
 * @param {{ urlList: UrlItem[], onRefresh?: (shortCode: string) => (Promise<void>|void) }} props
 */

export default function UrlList({ urlList = /** @type {UrlItem[]} */([]), onRefresh }) {
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [refreshingIndex, setRefreshingIndex] = useState(null)

  async function handleCopy(text, index) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    } catch (e) {
      // noop
    }
  }

  function formatDate(iso) {
    if (!iso) return "—"
    try {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return "—"
      return d.toLocaleString()
    } catch {
      return "—"
    }
  }

  function isExpired(expiresAt) {
    if (!expiresAt) return false
    const d = new Date(expiresAt)
    return !Number.isNaN(d.getTime()) && d <= new Date()
  }

  async function handleRefresh(index, shortCode) {
    if (!onRefresh) return
    try {
      setRefreshingIndex(index)
      await onRefresh(shortCode)
    } finally {
      setRefreshingIndex(null)
    }
  }

  return (
    <ul className="url-list">
      {urlList.map((element, index) => {
        const expired = isExpired(element.expiresAt)
        return (
          <li className="url-item" key={index} id={index}>
            <div className="links">
              <a
                href={element.url}
                className="full-url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {element.url.length > 100 ? element.url.slice(0, 100) + "…" : element.url}
              </a>
              <a
                href={element.shortUrl}
                className="short-url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {element.shortUrl}
              </a>
            </div>

            <div
              className="meta"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                alignItems: "center",
                marginTop: "0.5rem",
              }}
            >
              <span
                className="badge"
                style={{
                  background: "#eef",
                  color: "#223",
                  padding: "0.2rem 0.5rem",
                  borderRadius: 4,
                }}
              >
                Clicks: {element.clickCount ?? 0}
              </span>
              <span style={{ color: "#666" }}>
                Created: {formatDate(element.createdAt)}
              </span>
              <span style={{ color: expired ? "#b71c1c" : "#666" }}>
                {element.expiresAt
                  ? expired
                    ? `Expired: ${formatDate(element.expiresAt)}`
                    : `Expires: ${formatDate(element.expiresAt)}`
                  : "Never expires"}
              </span>
            </div>

            <div
              className="actions"
              style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}
            >
              <button
                type="button"
                className={`btn btn-cta btn-copy ${copiedIndex === index ? "copied" : ""}`}
                onClick={() => handleCopy(element.shortUrl, index)}
              >
                {copiedIndex === index ? "Copied!" : "Copy"}
              </button>
              {onRefresh && (
                <button
                  type="button"
                  className="btn btn-cta"
                  onClick={() => handleRefresh(index, element.shortCode)}
                  disabled={refreshingIndex === index}
                >
                  {refreshingIndex === index ? "Refreshing…" : "Refresh clicks"}
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}