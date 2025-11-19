import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../images/logo.svg'


export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()


  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" to="/">
          <img src={logo} alt="Shortly logo" />
        </Link>
        <div className="header-actions">
          {user ? (
            <>
              <span style={{ color: 'var(--muted)', marginRight: 12 }}>
                Hi, {user.username}
              </span>
              <button type="button" className="btn btn--ghost" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn--ghost" to="/login">Login</Link>
              <Link className="btn btn--primary" to="/signup">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
