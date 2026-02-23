import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').trim()
const CLUE_POLL_MS = 4000

function getRoleTitle(type) {
  if (type === 'murderer') return 'Murderer Briefing'
  if (type === 'detective') return 'Detective Briefing'
  return 'Civilian Briefing'
}

export default function PlayerCard({ session, onLogout }) {
  const player = session.player
  const addon = player.privateAddonData || null
  const roleType = addon?.type || 'civilian'

  const [suspects, setSuspects] = useState([])
  const [suspectName, setSuspectName] = useState('')
  const [revealedClues, setRevealedClues] = useState([])
  const [voteMessage, setVoteMessage] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  const [toast, setToast] = useState(null)

  const seenClueNumbersRef = useRef(new Set())
  const cluesLoadedRef = useRef(false)
  const toastTimerRef = useRef(null)
  const alertsEnabledRef = useRef(alertsEnabled)

  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${session.token}` },
    }),
    [session.token],
  )

  const showToast = (text) => {
    setToast(text)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 5000)
  }

  const maybeNotifyBrowser = (text, tag) => {
    if (!alertsEnabledRef.current || typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    new Notification('Basement at 6:17', { body: text, tag })
  }

  const broadcastUpdate = (text, tag) => {
    showToast(text)
    maybeNotifyBrowser(text, tag)
  }

  const enableAlerts = async () => {
    if (typeof Notification === 'undefined') {
      showToast('Browser notifications are not supported on this device.')
      return
    }

    if (Notification.permission === 'granted') {
      setAlertsEnabled(true)
      showToast('Alerts are already enabled.')
      return
    }

    if (Notification.permission === 'denied') {
      showToast('Notifications are blocked in this browser. Enable them in site settings.')
      return
    }

    const permission = await Notification.requestPermission()
    const enabled = permission === 'granted'
    setAlertsEnabled(enabled)
    showToast(enabled ? 'Clue alerts enabled.' : 'Clue alerts were not enabled.')
  }

  const fetchRevealedClues = async (announceChanges = true) => {
    const res = await axios.get(`${API_BASE}/api/revealed`)
    const next = (res.data.revealed || []).slice().sort((a, b) => a.number - b.number)
    const nextSet = new Set(next.map((clue) => clue.number))

    if (announceChanges && cluesLoadedRef.current) {
      const previousSet = seenClueNumbersRef.current
      if (nextSet.size < previousSet.size) {
        broadcastUpdate('Round reset: all clues were hidden again.', 'round-reset')
      } else {
        const newClues = next.filter((clue) => !previousSet.has(clue.number))
        newClues.forEach((clue) => {
          broadcastUpdate(`New clue #${clue.number}: ${clue.text}`, `clue-${clue.number}`)
        })
      }
    }

    seenClueNumbersRef.current = nextSet
    cluesLoadedRef.current = true
    setRevealedClues(next)
  }

  useEffect(() => {
    alertsEnabledRef.current = alertsEnabled
  }, [alertsEnabled])

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

    const loadInitial = async () => {
      try {
        await Promise.all([loadPlayers(), fetchRevealedClues(false)])
      } catch (err) {
        if (active) setError(err.response?.data?.error || err.message)
      }
    }

    loadInitial()

    const intervalId = setInterval(async () => {
      if (!active) return
      try {
        await fetchRevealedClues(true)
      } catch (_err) {
        // Ignore transient polling errors.
      }
    }, CLUE_POLL_MS)

    return () => {
      active = false
      clearInterval(intervalId)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
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

      <div className="layout-grid player-layout">
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

        <div className="stack">
          <section className={`card role-card role-${roleType}`}>
            <h3>{getRoleTitle(roleType)}</h3>
            {roleType === 'detective' && addon && (
              <>
                <p><strong>Power:</strong> {addon.power}</p>
                <p><strong>Secret lead:</strong> {addon.seed}</p>
                <p><strong>Mission:</strong> {addon.mission}</p>
              </>
            )}
            {roleType === 'murderer' && addon && (
              <>
                <p><strong>What really happened:</strong> {addon.whatReallyHappened}</p>
                <p><strong>Public approach:</strong> {addon.publicApproach}</p>
                <p><strong>Deflect to:</strong> {addon.deflect}</p>
                <p><strong>Avoid discussing:</strong> {addon.avoid}</p>
              </>
            )}
            {roleType === 'civilian' && (
              <p>Trust your memory, challenge inconsistencies, and vote carefully.</p>
            )}
          </section>

          <section className="card">
            <h3>Live Clue Feed</h3>
            <p className="hint">When host reveals clues, all players see them here automatically.</p>
            {revealedClues.length === 0 ? (
              <p className="hint">No clues revealed yet.</p>
            ) : (
              <ul className="clue-feed">
                {revealedClues.map((clue) => (
                  <li key={clue.number}>
                    <strong>Clue #{clue.number}:</strong> {clue.text}
                  </li>
                ))}
              </ul>
            )}
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
              <div className="stack-inline">
                <button className="btn btn-primary" disabled={!suspectName || busy}>
                  {busy ? 'Submitting...' : 'Submit Vote'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={enableAlerts}>
                  {alertsEnabled ? 'Alerts Enabled' : 'Enable Alerts'}
                </button>
              </div>
            </form>
            {voteMessage && <p className="success">{voteMessage}</p>}
            {error && <p className="error">{error}</p>}
          </section>
        </div>
      </div>

      {toast && <div className="floating-toast">{toast}</div>}
    </div>
  )
}
