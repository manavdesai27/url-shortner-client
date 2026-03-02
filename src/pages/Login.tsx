import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const api = import.meta.env.VITE_API_URL as string

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const navigate = useNavigate()
  const { refresh, setAccessToken } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('Username and password are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        let msg = 'Login failed'
        try {
          const data = await res.json()
          msg = (data?.message as string) || (data as string) || msg
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      // Read access token from JSON and store in memory
      const data = await res.json().catch(() => ({} as any))
      const token = typeof (data as any)?.accessToken === 'string' ? (data as any).accessToken : null
      if (token) setAccessToken(token)

      // Optionally mark basic UI auth flag
      localStorage.setItem('auth', '1')
      await refresh()
      navigate('/')
    } catch (err: any) {
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="container">
        <div className="auth-card">
          <h2 style={{ marginBottom: '12px' }}>Login</h2>
          <p style={{ color: 'var(--muted)' }}>Welcome back! Sign in to continue.</p>

          {error && (
            <div className="error-banner" role="alert" style={{ marginTop: '16px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            <button className="btn btn--primary" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <p style={{ marginTop: '16px', color: 'var(--muted)' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: 'var(--brand)' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
