import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').trim()

export default function HostDashboard({ session, onLogout }) {
  const [clues, setClues] = useState([])
  const [revealed, setRevealed] = useState([])
  const [votes, setVotes] = useState([])
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const authHeaders = {
    headers: { Authorization: `Bearer ${session.token}` },
  }

  const withErrorHandling = async (fn) => {
    try {
      setError(null)
      await fn()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  const fetchClues = async () => {
    const res = await axios.get(`${API_BASE}/api/clues`, authHeaders)
    setClues(res.data)
  }

  const fetchRevealed = async () => {
    const res = await axios.get(`${API_BASE}/api/revealed`)
    setRevealed(res.data.revealed)
  }

  const fetchVotes = async () => {
    const res = await axios.get(`${API_BASE}/api/votes`, authHeaders)
    setVotes(res.data.votes)
  }

  useEffect(() => {
    let active = true

    const loadInitialData = async () => {
      setBusy(true)
      await withErrorHandling(async () => {
        await Promise.all([fetchClues(), fetchRevealed(), fetchVotes()])
      })
      if (active) setBusy(false)
    }

    loadInitialData()

    return () => {
      active = false
    }
  }, [])

  const reveal = async (n) => {
    await withErrorHandling(async () => {
      setBusy(true)
      await axios.post(`${API_BASE}/api/reveal-clue`, { number: n }, authHeaders)
      await Promise.all([fetchRevealed(), fetchClues()])
    })
    setBusy(false)
  }

  const fetchResults = async () => {
    await withErrorHandling(async () => {
      const res = await axios.get(`${API_BASE}/api/results`, authHeaders)
      setResults(res.data)
    })
  }

  const resetGame = async () => {
    await withErrorHandling(async () => {
      setBusy(true)
      await axios.post(`${API_BASE}/api/reset`, {}, authHeaders)
      setResults(null)
      await Promise.all([fetchRevealed(), fetchVotes(), fetchClues()])
    })
    setBusy(false)
  }

  const logout = async () => {
    try {
      await axios.post(`${API_BASE}/api/logout`, {}, authHeaders)
    } catch (_err) {
      // Ignore logout network failures and still clear local session.
    } finally {
      onLogout()
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">Host Controls</div>
          <h2 className="title-sm">Game Master Dashboard</h2>
        </div>
        <button className="btn btn-ghost" onClick={logout}>Log Out</button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="panel">
        <h3>All Clues</h3>
        <ul>
          {clues.map(c => (
            <li key={c.number}>
              <span>#{c.number} {c.revealed ? '(revealed)' : ''} - hidden: {c.hide}</span>
              <button className="btn btn-primary" disabled={busy || c.revealed} onClick={() => reveal(c.number)}>
                {c.revealed ? 'Revealed' : 'Reveal'}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>Revealed Clues</h3>
        <ul>
          {revealed.map(r => <li key={r.number}>#{r.number}: {r.text}</li>)}
        </ul>
      </div>

      <div className="panel">
        <h3>Votes</h3>
        <div className="stack-inline">
          <button className="btn btn-primary" disabled={busy} onClick={() => withErrorHandling(fetchVotes)}>Refresh Votes</button>
          <button className="btn btn-primary" disabled={busy} onClick={fetchResults}>Tally</button>
          <button className="btn btn-ghost" disabled={busy} onClick={resetGame}>Reset Round</button>
        </div>
        <pre>{JSON.stringify(votes, null, 2)}</pre>
        {results && <pre>{JSON.stringify(results, null, 2)}</pre>}
      </div>
    </div>
  )
}
