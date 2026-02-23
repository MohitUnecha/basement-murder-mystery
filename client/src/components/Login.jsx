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
        <p className="eyebrow">Game Night Access</p>
        <h1 className="title">Basement at 6:17</h1>
        <p className="subtitle">Enter your game key to view your private briefing.</p>

        <form onSubmit={submit} className="card">
          <label className="label">Game Key</label>
          <input
            className="input"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter your key"
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Entering...' : 'Enter Briefing'}
          </button>
          {err && <div className="error">{err}</div>}
          <div className="hint">Use the private key shared by your game host.</div>
        </form>
      </div>
    </div>
  )
}
