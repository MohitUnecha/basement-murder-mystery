import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').trim()

export default function PlayerCard({ session, onLogout }) {
  const player = session.player
  const [suspects, setSuspects] = useState([])
  const [suspectName, setSuspectName] = useState('')
  const [voteMessage, setVoteMessage] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${session.token}` },
    }),
    [session.token],
  )

  useEffect(() => {
    let active = true

    const loadPlayers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/players`)
        const names = (res.data.players || [])
          .map((entry) => entry.name)
          .filter((name) => name && name !== player.name)
          .sort((a, b) => a.localeCompare(b))

        if (active) {
          setSuspects(names)
          setSuspectName((current) => current || names[0] || '')
        }
      } catch (err) {
        if (active) setError(err.response?.data?.error || err.message)
      }
    }

    loadPlayers()
    return () => {
      active = false
    }
  }, [player.name])

  const submitVote = async (event) => {
    event.preventDefault()
    if (!suspectName) return

    try {
      setBusy(true)
      setError(null)
      setVoteMessage(null)
      await axios.post(`${API_BASE}/api/vote`, { suspectName }, authHeaders)
      setVoteMessage(`Vote submitted for ${suspectName}. You can change it before tally.`)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setBusy(false)
    }
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
          <div className="eyebrow">Player Briefing</div>
          <h2 className="title-sm">{player.name} - {player.title}</h2>
        </div>
        <button className="btn btn-ghost" onClick={logout}>Log Out</button>
      </div>

      <div className="layout-grid">
        <section className="card briefing">
          <h3>Case Notes</h3>
          <p><strong>Relationship:</strong> {player.relationship}</p>
          <p><strong>Personality:</strong> {player.personality}</p>
          <p><strong>What happened today:</strong> {player.whatHappened}</p>
          <p><strong>6:17 Alibi:</strong> {player.alibi} - Confirm: {player.confirm || 'None'}</p>
          <p><strong>Secret:</strong> {player.secret}</p>
          <p><strong>Finger-point hook:</strong> {player.fingerPointHook}</p>
          <p><strong>Witness memory:</strong> {player.witnessMemory}</p>
        </section>

        <section className="card">
          <h3>Final Vote</h3>
          <p className="hint">Choose your suspect. Submitting again updates your vote.</p>
          <form onSubmit={submitVote} className="stack">
            <label className="label">Suspect</label>
            <select
              className="input"
              value={suspectName}
              onChange={(event) => setSuspectName(event.target.value)}
              disabled={!suspects.length || busy}
            >
              {suspects.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!suspectName || busy}>
              {busy ? 'Submitting...' : 'Submit Vote'}
            </button>
          </form>
          {voteMessage && <p className="success">{voteMessage}</p>}
          {error && <p className="error">{error}</p>}
        </section>
      </div>

      {player.privateAddonData && (
        <section className="card addon">
          <h3>Private Add-On</h3>
          <pre>{JSON.stringify(player.privateAddonData, null, 2)}</pre>
        </section>
      )}
    </div>
  )
}
