import { useState } from "react"

export default function UrlList(props) {
  const urlList = props.urlList || []
  const [copiedIndex, setCopiedIndex] = useState(null)

  async function handleCopy(text, index) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    } catch (e) {
      // noop
    }
  }

  return (
    <ul className="url-list">
      {urlList.map((element, index) => {
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
            <button
              type="button"
              className={`btn btn-cta btn-copy ${copiedIndex === index ? "copied" : ""}`}
              onClick={() => handleCopy(element.shortUrl, index)}
            >
              {copiedIndex === index ? "Copied!" : "Copy"}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
