import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').trim()
const STATE_POLL_MS = 4000

function formatVoteTime(ms) {
  if (!ms) return ''
  const date = new Date(ms)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function HostDashboard({ session, onLogout }) {
  const [clues, setClues] = useState([])
  const [revealed, setRevealed] = useState([])
  const [playerPins, setPlayerPins] = useState([])
  const [hostPin, setHostPin] = useState(null)
  const [votes, setVotes] = useState([])
  const [results, setResults] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [phaseLabel, setPhaseLabel] = useState('Pregame')
  const [customMessage, setCustomMessage] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const latestAnnouncementIdRef = useRef(0)

  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${session.token}` },
    }),
    [session.token],
  )

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
    const sorted = (res.data || []).slice().sort((a, b) => {
      if (a.pack !== b.pack) return a.pack.localeCompare(b.pack)
      return a.number - b.number
    })
    setClues(sorted)
  }

  const fetchVotes = async () => {
    const res = await axios.get(`${API_BASE}/api/votes`, authHeaders)
    setVotes(res.data.votes || [])
  }

  const fetchPins = async () => {
    const res = await axios.get(`${API_BASE}/api/player-pins`, authHeaders)
    setHostPin(res.data.hostPin)
    setPlayerPins(res.data.players || [])
  }

  const fetchGameState = async () => {
    const res = await axios.get(
      `${API_BASE}/api/game-state?sinceAnnouncementId=${latestAnnouncementIdRef.current}`,
      authHeaders,
    )
    const data = res.data
    setRevealed(data.revealed || [])
    setPhaseLabel(data.phaseLabel || 'Pregame')
    latestAnnouncementIdRef.current = data.latestAnnouncementId || latestAnnouncementIdRef.current
    if (data.announcements?.length) {
      setAnnouncements((prev) => [...data.announcements, ...prev].slice(0, 25))
    }
  }

  useEffect(() => {
    let active = true
    const loadInitial = async () => {
      setBusy(true)
      await withErrorHandling(async () => {
        await Promise.all([fetchClues(), fetchVotes(), fetchGameState(), fetchPins()])
      })
      if (active) setBusy(false)
    }
    loadInitial()

    const timer = setInterval(async () => {
      if (!active) return
      try {
        await fetchGameState()
      } catch (_err) {
        // Ignore transient polling errors.
      }
    }, STATE_POLL_MS)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const reveal = async (number) => {
    await withErrorHandling(async () => {
      setBusy(true)
      await axios.post(`${API_BASE}/api/reveal-clue`, { number }, authHeaders)
      await Promise.all([fetchClues(), fetchGameState()])
    })
    setBusy(false)
  }

  const setMeeting = async (meeting) => {
    await withErrorHandling(async () => {
      setBusy(true)
      await axios.post(`${API_BASE}/api/meeting`, { meeting }, authHeaders)
      await fetchGameState()
    })
    setBusy(false)
  }

  const sendAnnouncement = async (event) => {
    event.preventDefault()
    await withErrorHandling(async () => {
      const message = customMessage.trim()
      if (!message) return
      setBusy(true)
      await axios.post(`${API_BASE}/api/announce`, { message }, authHeaders)
      setCustomMessage('')
      await fetchGameState()
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
      setAnnouncements([])
      latestAnnouncementIdRef.current = 0
      await Promise.all([fetchVotes(), fetchGameState(), fetchClues(), fetchPins()])
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

  const rankedResults = results?.ranked || []
  const topSuspect = rankedResults[0]?.suspect || 'No tally yet'

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">Host Console</div>
          <h2 className="title-sm">Ravenswood Gala Control Room</h2>
          <p className="status-pill">{phaseLabel}</p>
        </div>
        <button className="btn btn-ghost" onClick={logout}>Log Out</button>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <h3>Game Keys</h3>
        <div className="key-grid">
          <div className="key-card">
            <strong>Host Key</strong>
            <div>{hostPin ?? '...'}</div>
          </div>
          {playerPins.map((entry) => (
            <div key={entry.pin} className="key-card">
              <strong>{entry.name}</strong>
              <div>{entry.pin}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="host-grid">
        <section className="panel">
          <h3>Meeting Controls</h3>
          <div className="stack-inline">
            <button className="btn btn-primary" disabled={busy} onClick={() => setMeeting(1)}>Meeting 1</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => setMeeting(2)}>Meeting 2</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => setMeeting(3)}>Meeting 3 / Final</button>
          </div>
          <form className="stack" onSubmit={sendAnnouncement}>
            <label className="label">Custom Announcement</label>
            <input
              className="input"
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              placeholder="Example: Meeting 2 starts in 2 minutes."
              maxLength={220}
            />
            <button className="btn btn-ghost" disabled={busy || !customMessage.trim()}>
              Broadcast Message
            </button>
          </form>
        </section>

        <section className="panel">
          <h3>Announcements Sent</h3>
          {announcements.length === 0 ? (
            <p className="hint">No announcements yet.</p>
          ) : (
            <ul className="announcement-list">
              {announcements.map((item) => (
                <li key={item.id}>
                  <strong>{item.type.toUpperCase()}:</strong> {item.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <h3>Clue Packs</h3>
        <ul>
          {clues.map((clue) => (
            <li key={clue.number}>
              <div>
                <strong>Pack {clue.pack} - Clue #{clue.number}: {clue.title}</strong>
                <div>{clue.text}</div>
              </div>
              <button
                className="btn btn-primary"
                disabled={busy || clue.revealed}
                onClick={() => reveal(clue.number)}
              >
                {clue.revealed ? 'Revealed' : 'Reveal'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Revealed Clues (Live)</h3>
        <ul className="clue-feed">
          {revealed.map((clue) => (
            <li key={clue.number}>
              <strong>Pack {clue.pack} - Clue #{clue.number}: {clue.title}</strong>
              <div>{clue.text}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Votes & Results</h3>
        <div className="stack-inline">
          <button className="btn btn-primary" disabled={busy} onClick={() => withErrorHandling(fetchVotes)}>Refresh Votes</button>
          <button className="btn btn-primary" disabled={busy} onClick={fetchResults}>Tally</button>
          <button className="btn btn-ghost" disabled={busy} onClick={resetGame}>Reset Round</button>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">Votes Submitted</div>
            <div className="stat-value">{votes.length} / {playerPins.length || 22}</div>
          </div>
          <div className="stat-card">
            <div className="label">Current Leader</div>
            <div className="stat-value">{topSuspect}</div>
          </div>
        </div>

        {votes.length === 0 ? (
          <p className="hint">No votes yet.</p>
        ) : (
          <ul className="vote-list">
            {votes.map((vote) => (
              <li key={vote.voter}>
                <strong>{vote.voter}</strong>
                <span>voted for</span>
                <strong>{vote.suspect}</strong>
                <span>{formatVoteTime(vote.time)}</span>
              </li>
            ))}
          </ul>
        )}

        {results && (
          <div className="results-panel">
            <h4>Ranked Results</h4>
            <ol className="rank-list">
              {rankedResults.map((row) => (
                <li key={row.suspect}>
                  <strong>{row.suspect}</strong>
                  <span>{row.count} vote points</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  )
}
