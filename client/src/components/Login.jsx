import React, { useState } from 'react'
import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').trim()

export default function Login({ onLogin }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/api/auth`, { pin: Number(pin) })
      onLogin(res.data)
    } catch (error) {
      if (!error.response) {
        setErr('Cannot reach backend. Set VITE_API_BASE to your deployed server URL.')
      } else {
        setErr(error.response?.data?.error || error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen screen-login">
      <div className="hero-card">
        <div className="gem-decoration"></div>
        <p className="eyebrow">Ravenswood Gala &mdash; Classified</p>
        <h1 className="title">THE SAPPHIRE OF SHADOWS</h1>
        <p className="subtitle">A priceless gemstone has been stolen. Dr. Priya Mehta lies unconscious. Enter your private key to receive your briefing.</p>

        <form onSubmit={submit} className="card" style={{ display: 'grid', gap: '12px', padding: '20px' }}>
          <label className="label">Game Key</label>
          <input
            className="input"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter your 4-digit key"
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Entering...' : 'Enter the Gala'}
          </button>
          {err && <div className="error">{err}</div>}
          <div className="hint">Your host will give you your private key before the game begins.</div>
        </form>
      </div>
    </div>
  )
}
