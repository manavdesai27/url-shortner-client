import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../images/logo.svg'
import { useState } from 'react'


export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)


  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/')
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" to="/">
          <img src={logo} alt="Shortly logo" />
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-label="Toggle navigation"
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        >
          <span className="sr-only">Menu</span>
          <svg width="24" height="24" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <div id="primary-navigation" className={`header-actions ${menuOpen ? 'is-open' : ''}`}>
          {user ? (
            <>
              <span style={{ color: 'var(--muted)' }}>
                Hi, <span style={{ color: 'var(--brand)' }}>{user.username}</span>
              </span>
              <Link className="btn btn--primary" to="/links" onClick={() => setMenuOpen(false)}>My Links</Link>
              <button type="button" className="btn btn--ghost" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn--ghost" to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link className="btn btn--primary" to="/signup" onClick={() => setMenuOpen(false)}>Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
