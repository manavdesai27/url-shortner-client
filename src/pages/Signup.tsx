import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const apiBase =
  (import.meta.env.VITE_API_BASE as string) ||
  (import.meta.env.DEV ? (import.meta.env.VITE_API_URL as string) : '/api')

export default function Signup() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const navigate = useNavigate()
  const { refresh, setAccessToken } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!username || !password || !confirm) {
      setError('All fields are required')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      // Register
      const reg = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      if (!reg.ok) {
        let msg = 'Registration failed'
        try {
          const data = await reg.json()
          msg = (data?.error as string) || (data as string) || msg
        } catch {
          // ignore
        }
        throw new Error(msg)
      }

      // Auto-login to receive HttpOnly cookie
      const login = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })
      if (!login.ok) {
        // fallback: navigate to login page if auto-login fails
        navigate('/login')
        return
      }
      // read access token JSON and store in memory
      const loginData = await login.json().catch(() => ({} as any))
      const loginToken = typeof (loginData as any)?.accessToken === 'string' ? (loginData as any).accessToken : null
      if (loginToken) setAccessToken(loginToken)

      // Optional UI flag
      localStorage.setItem('auth', '1')
      await refresh()
      navigate('/')
    } catch (err: any) {
      setError(err?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="container">
        <div className="auth-card">
          <h2 style={{ marginBottom: '12px' }}>Create account</h2>
          <p style={{ color: 'var(--muted)' }}>Sign up to start shortening links.</p>

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
                placeholder="Choose a username"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
              />
            </div>

            <div className="field">
              <label htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm your password"
              />
            </div>

            <button className="btn btn--primary" type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Sign up'}
            </button>
          </form>

          <p style={{ marginTop: '16px', color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--brand)' }}>
              Login
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
