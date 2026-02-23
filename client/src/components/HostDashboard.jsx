import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export default function HostDashboard({ session }) {
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

  return (
    <div className="container">
      <h2>Host Dashboard</h2>
      {error && <div className="error">{error}</div>}
      <div className="panel">
        <h3>All Clues</h3>
        <ul>
          {clues.map(c => (
            <li key={c.number}>
              #{c.number} {c.revealed ? ' (revealed)' : ''} - hidden: {c.hide}
              <button disabled={busy} onClick={() => reveal(c.number)} style={{ marginLeft: 8 }}>
                Reveal
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
        <button disabled={busy} onClick={() => withErrorHandling(fetchVotes)}>Refresh Votes</button>
        <button disabled={busy} onClick={fetchResults} style={{ marginLeft: 8 }}>Tally</button>
        <button disabled={busy} onClick={resetGame} style={{ marginLeft: 8 }}>Reset Round</button>
        <pre>{JSON.stringify(votes, null, 2)}</pre>
        {results && <pre>{JSON.stringify(results, null, 2)}</pre>}
      </div>
    </div>
  )
}
