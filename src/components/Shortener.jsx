import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import PulseLoader from "react-spinners/PulseLoader";
import { useAuth } from "../context/AuthContext.tsx";

const apiBase =
  (import.meta.env.VITE_API_BASE) ||
  (import.meta.env.DEV ? import.meta.env.VITE_API_URL : '/api');
const shortDomain = import.meta.env.VITE_SHORT_DOMAIN;
const aliasPattern = /^[a-z0-9][a-z0-9-_]{1,31}$/;
const aliasPartial = /^[a-z0-9][a-z0-9-_]*$/;

export default function Shortener() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // validation for empty input
  const [error, setError] = useState(false);
  // field-level error from server (e.g., invalid URL)
  const [fieldError, setFieldError] = useState("");
  // alias state + error
  const [alias, setAlias] = useState("");
  const [aliasError, setAliasError] = useState("");
  // expiration state + error
  const [expiresAt, setExpiresAt] = useState("");
  const [expiresError, setExpiresError] = useState("");
  // transient toast message for network/system errors
  const [toast, setToast] = useState(null);

  const [lastShortUrl, setLastShortUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const { user, loading: authLoading, apiFetch } = useAuth();
  const [authPrompt, setAuthPrompt] = useState(false);

  // track in-flight request to cancel on unmount or re-submit
  const requestController = useRef(null);
  const timeoutIdRef = useRef(null);

  function showToast(message, durationMs = 5000) {
    setToast({ message });
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    timeoutIdRef.current = setTimeout(() => setToast(null), durationMs);
  }

  function handleInputChange(e) {
    const { value } = e.target;
    setInput(value);
    if (error && value.trim() !== "") setError(false);
    if (fieldError) setFieldError("");
    if (authPrompt) setAuthPrompt(false);
  }

  function handleAliasChange(e) {
    const { value } = e.target;
    const v = (value || "").toLowerCase();
    setAlias(v);
    if (aliasError) setAliasError("");
    setLastShortUrl("");
  }

  function nowLocalForInput() {
    const d = new Date();
    d.setSeconds(0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function handleExpiresChange(e) {
    setExpiresAt(e.target.value || "");
    if (expiresError) setExpiresError("");
  }

  async function handleCopy() {
    try {
      if (!lastShortUrl) return;
      await navigator.clipboard.writeText(lastShortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore copy errors
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const value = input.trim();
    if (value === "") {
      setError(true);
      return;
    }

    if (authLoading) {
      return;
    }
    if (!user) {
      setAuthPrompt(true);
      return;
    }

    // validate alias client-side if provided
    if (alias && !aliasPattern.test(alias)) {
      setAliasError("Alias must be 2-32 chars: a-z, 0-9, '-' or '_'");
      return;
    }

    // abort any prior request
    if (requestController.current) {
      try {
        requestController.current.abort();
      } catch {
        // ignore
      }
    }

    const controller = new AbortController();
    requestController.current = controller;

    // timeout in 8s
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, 8000);

    setLoading(true);
    try {
      const payload = { originalUrl: value };
      if (alias) payload.customShortCode = alias;

      if (expiresAt) {
        const dt = new Date(expiresAt);
        const seconds = Math.floor((dt.getTime() - Date.now()) / 1000);
        if (!isFinite(seconds) || seconds <= 0) {
          setExpiresError("Expiration must be in the future.");
          setLoading(false);
          return;
        }
        payload.expiresInSeconds = seconds;
      }

      const response = await apiFetch(`${apiBase}/shorten`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let data = null;
      try {
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          // fallback text message if server didn't return JSON
          data = await response.text();
        }
      } catch {
        // ignore parse errors
      }

      if (!response.ok) {
        const message =
          (data &&
            typeof data === "object" &&
            (typeof data.error === "string"
              ? data.error
              : (data.error && typeof data.error === "object" && typeof data.error.message === "string"
                  ? data.error.message
                  : data.message))) ||
          (typeof data === "string" && data) ||
          `Request failed with status ${response.status}`;

        if (response.status === 400) {
          // validation error -> try alias first, otherwise URL
          if (typeof message === "string" && /alias|reserved/i.test(message)) {
            setAliasError(message);
          } else {
            setFieldError(message || "Please enter a valid URL.");
          }
        } else if (response.status === 401 || response.status === 403) {
          // auth error -> prompt for login/signup inline
          setAuthPrompt(true);
        } else if (response.status === 429) {
          showToast("Too many requests. Please wait a moment and try again.");
        } else if (response.status === 404) {
          showToast("Service unavailable. Please try again later.");
        } else if (response.status === 409) {
          setAliasError("Alias already taken. Try another one.");
        } else {
          showToast("Server error. Please try again.");
        }
        setLoading(false);
        return;
      }

      // success
      const shortCode =
        data && typeof data === "object" ? data.shortCode : undefined;
      const shortUrl = shortCode ? `${shortDomain}/l/${shortCode}` : "";
      setLastShortUrl(shortUrl);
      setCopied(false);
      // Persisting of created links is now server-side; view them on /links when logged in.
      setInput("");
      setAlias("");
      setAliasError("");
      setExpiresAt("");
      setExpiresError("");
      setError(false);
      setFieldError("");
      setLoading(false);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err?.name === "AbortError") {
        showToast("Request timed out. Please try again.");
      } else {
        showToast("Network error. Check your connection and try again.");
      }
      setLoading(false);
    }
  }

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (requestController.current) {
        try {
          requestController.current.abort();
        } catch {
          // ignore
        }
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const override = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  return (
    <div id="shorten" className="shorten-wrap">
      {/* Toast (simple, inline styles to avoid extra files) */}
      {toast && createPortal(
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#f44336",
            color: "white",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            maxWidth: "90vw",
            textAlign: "center",
          }}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "white",
              border: "none",
              cursor: "pointer",
              borderRadius: "4px",
              padding: "0.25rem 0.5rem",
            }}
          >
            ✕
          </button>
        </div>
      , document.body)}

      <div className="container">
        <div className="shorten-card">
          <form className="shorten-form" onSubmit={handleSubmit} noValidate>
            <div className="shorten-input">
              <div className="input-wrap">
                <div className="inputs-row">
                  <div className="url-col">
                    <input
                      type="url"
                      placeholder="Shorten a link here..."
                      id="input"
                      onChange={handleInputChange}
                      value={input}
                      className={error || fieldError ? "invalid" : ""}
                      aria-invalid={error || fieldError ? "true" : "false"}
                    />
                    <p className={`error-text ${error ? "show" : ""}`}>
                      Please add a link
                    </p>
                    {fieldError && (
                      <p className="error-text show" aria-live="polite">
                        {fieldError}
                      </p>
                    )}
                  </div>
                  <div className="alias-col">
                    <input
                      type="text"
                      placeholder="Custom alias (optional): a-z, 0-9, '-' or '_'"
                      id="alias"
                      onChange={handleAliasChange}
                      value={alias}
                      className={aliasError ? "invalid" : ""}
                      aria-invalid={aliasError ? "true" : "false"}
                    />
                    {aliasError && (
                      <p className="error-text show" aria-live="polite">
                        {aliasError}
                      </p>
                    )}
                  </div>
                  <div className="expires-col">
                    <input
                      type="datetime-local"
                      id="expiresAt"
                      min={nowLocalForInput()}
                      onChange={handleExpiresChange}
                      value={expiresAt}
                      className={expiresError ? "invalid" : ""}
                      aria-invalid={expiresError ? "true" : "false"}
                      title="Set expiry"
                      aria-label="Set expiry date"
                    />
                    {expiresError && (
                      <p className="error-text show" aria-live="polite">
                        {expiresError}
                      </p>
                    )}
                  </div>
                </div>
                <p className={`error-text ${authPrompt ? "show" : ""}`}>
                  Please log in or sign up to shorten links.{" "}
                  <Link to="/login">Login</Link> ·{" "}
                  <Link to="/signup">Sign up</Link>
                </p>
              </div>
              <button className="btn btn-cta" type="submit" disabled={loading}>
                {loading ? (
                  <PulseLoader
                    color={"white"}
                    cssOverride={override}
                    size={11}
                    aria-label="Loading Spinner"
                    data-testid="loader"
                  />
                ) : (
                  "Shorten it!"
                )}
              </button>
            </div>
          </form>
        </div>

        {lastShortUrl ? (
          <div className="short-link-result-wrap" aria-live="polite">
            <div className="short-link-result">
              <span className="label">Your short link:</span>
              <a
                className="value"
                href={lastShortUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {lastShortUrl}
              </a>
              <button
                type="button"
                className={`btn btn-copy ${copied ? "copied" : ""}`}
                onClick={handleCopy}
                aria-label="Copy short link"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          alias && aliasPartial.test(alias) && (
            <div className="short-link-preview-wrap">
              <p className={`short-link-preview ${alias.length < 2 ? "draft" : ""}`} aria-live="polite">
                <span className="label">Your potential short link:</span>
                <span className="value" aria-disabled="true">
                  {shortDomain}/l/{alias}
                </span>
                {alias.length < 2 && (
                  <span className="hint" aria-live="polite">min 2 chars</span>
                )}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}