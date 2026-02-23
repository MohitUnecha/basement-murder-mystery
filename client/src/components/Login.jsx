import React, { useState } from 'react'
import axios from 'axios'

export default function Login({ onLogin }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post('http://localhost:4000/api/auth', { pin: Number(pin) })
      onLogin(res.data)
    } catch (e) {
      setErr(e.response?.data?.error || e.message)
    }
  }

  return (
    <div className="center">
      <h1>Basement at 6:17</h1>
      <form onSubmit={submit} className="card">
        <label>Enter PIN</label>
        <input value={pin} onChange={e => setPin(e.target.value)} />
        <button type="submit">Enter</button>
        {err && <div className="error">{err}</div>}
        <div className="hint">Host PIN: 9000 — Player PINs 1001–1022</div>
      </form>
    </div>
  )
}
