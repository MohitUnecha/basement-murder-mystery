import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').trim()
const GAME_STATE_POLL_MS = 3500

function getRoleTitle(type) {
  if (type === 'murderer') return 'Murderer Briefing'
  if (type === 'detective') return 'Detective Briefing'
  return 'Player Briefing'
}

function buildRoleDescription(type, addon) {
  if (type === 'detective' && addon) {
    return [
      `Power: ${addon.power}`,
      `Mission: ${addon.mission}`,
      `Suspicion Seed: ${addon.seed}`,
      `Strategy: ${addon.strategy}`,
    ]
  }
  if (type === 'murderer' && addon) {
    return [
      `Truth: ${addon.whatReallyHappened}`,
      `Public Story: ${addon.publicApproach}`,
      `Known Cracks: ${addon.cracks}`,
      `Misdirection: ${addon.deflect}`,
      `Emotional Cover: ${addon.emotionalCover}`,
    ]
  }
  return ['Investigate hard, test alibis, and track contradictions.']
}

export default function PlayerCard({ session, onLogout }) {
  const player = session.player
  const addon = player.privateAddonData || null
  const roleType = addon?.type || 'civilian'

  const [suspects, setSuspects] = useState([])
  const [suspectName, setSuspectName] = useState('')
  const [revealedClues, setRevealedClues] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [meetingLabel, setMeetingLabel] = useState('Pregame')
  const [voteMessage, setVoteMessage] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )

  const latestAnnouncementIdRef = useRef(0)
  const browserAlertsEnabledRef = useRef(browserAlertsEnabled)
  const toastTimerRef = useRef(null)
  const titleTimerRef = useRef(null)
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : 'Basement at 6:17')

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

  const flashTitle = (text) => {
    if (typeof document === 'undefined') return
    if (!document.hidden) return

    if (titleTimerRef.current) clearInterval(titleTimerRef.current)
    let on = false
    let ticks = 0
    titleTimerRef.current = setInterval(() => {
      on = !on
      document.title = on ? text : originalTitleRef.current
      ticks += 1
      if (ticks > 8 && titleTimerRef.current) {
        clearInterval(titleTimerRef.current)
        titleTimerRef.current = null
        document.title = originalTitleRef.current
      }
    }, 550)
  }

  const tryBrowserNotification = (text, tag) => {
    if (!browserAlertsEnabledRef.current || typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    new Notification('Sapphire of Shadows', { body: text, tag })
  }

  const notify = (text, tag) => {
    showToast(text)
    flashTitle('New Game Update')
    tryBrowserNotification(text, tag)
  }

  const enableBrowserAlerts = async () => {
    if (typeof Notification === 'undefined') {
      showToast('Device notifications are not supported in this browser.')
      return
    }

    if (Notification.permission === 'granted') {
      setBrowserAlertsEnabled(true)
      notify('Device notifications are already enabled.', 'alerts-enabled')
      return
    }

    if (Notification.permission === 'denied') {
      notify('Notifications are blocked. Enable them in browser site settings.', 'alerts-blocked')
      return
    }

    const permission = await Notification.requestPermission()
    const enabled = permission === 'granted'
    setBrowserAlertsEnabled(enabled)
    notify(enabled ? 'Device notifications enabled.' : 'Device notifications not enabled.', 'alerts-result')
  }

  const testAlert = () => {
    notify('Test alert: your notifications are active for game updates.', 'test-alert')
  }

  const pollGameState = async () => {
    const res = await axios.get(
      `${API_BASE}/api/game-state?sinceAnnouncementId=${latestAnnouncementIdRef.current}`,
      authHeaders,
    )
    const data = res.data
    setRevealedClues(data.revealed || [])
    setMeetingLabel(data.phaseLabel || 'Pregame')
    latestAnnouncementIdRef.current = data.latestAnnouncementId || latestAnnouncementIdRef.current

    if (data.announcements?.length) {
      setAnnouncements((prev) => [...data.announcements, ...prev].slice(0, 18))
      data.announcements.forEach((item) => notify(item.message, `announcement-${item.id}`))
    }
  }

  useEffect(() => {
    browserAlertsEnabledRef.current = browserAlertsEnabled
  }, [browserAlertsEnabled])

  useEffect(() => {
    let active = true

    const loadPlayers = async () => {
      const res = await axios.get(`${API_BASE}/api/players`)
      const names = (res.data.players || [])
        .map((entry) => entry.name)
        .filter((name) => name && name !== player.name)
        .sort((a, b) => a.localeCompare(b))
      if (active) {
        setSuspects(names)
        setSuspectName((current) => current || names[0] || '')
      }
    }

    const loadInitial = async () => {
      try {
        await Promise.all([loadPlayers(), pollGameState()])
      } catch (err) {
        if (active) setError(err.response?.data?.error || err.message)
      }
    }

    loadInitial()

    const intervalId = setInterval(async () => {
      if (!active) return
      try {
        await pollGameState()
      } catch (_err) {
        // Ignore transient polling errors.
      }
    }, GAME_STATE_POLL_MS)

    return () => {
      active = false
      clearInterval(intervalId)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (titleTimerRef.current) clearInterval(titleTimerRef.current)
      if (typeof document !== 'undefined') document.title = originalTitleRef.current
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
      setVoteMessage(`Vote submitted for ${suspectName}. You can still update it before final tally.`)
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
          <div className="eyebrow">Investigation Live</div>
          <h2 className="title-sm">{player.name} - {player.title}</h2>
          <p className="status-pill">{meetingLabel}</p>
        </div>
        <button className="btn btn-ghost" onClick={logout}>Log Out</button>
      </div>

      <div className="layout-grid player-layout">
        <section className="card briefing">
          <h3>Your Card</h3>
          <p><strong>Who You Are:</strong> {player.whoYouAre}</p>
          <p><strong>Tonight:</strong> {player.tonight}</p>
          <p><strong>8:47 Alibi:</strong> {player.alibi}</p>
          <p><strong>Must Talk To:</strong> {player.mustTalkTo?.join(', ')}</p>
          <p><strong>Secret:</strong> {player.secret}</p>
          <p><strong>Suspicion Hook:</strong> {player.suspicionHook}</p>
          <p><strong>Witness Memory:</strong> {player.witnessMemory}</p>
        </section>

        <div className="stack">
          <section className={`card role-card role-${roleType}`}>
            <h3>{getRoleTitle(roleType)}</h3>
            <ul className="simple-list">
              {buildRoleDescription(roleType, addon).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Live Clue Feed</h3>
            <p className="hint">All revealed clues appear here in real time.</p>
            {revealedClues.length === 0 ? (
              <p className="hint">No clues revealed yet.</p>
            ) : (
              <ul className="clue-feed">
                {revealedClues.map((clue) => (
                  <li key={clue.number}>
                    <strong>Pack {clue.pack} - Clue #{clue.number}:</strong> {clue.title}
                    <div>{clue.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h3>Host Announcements</h3>
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

          <section className="card">
            <h3>Final Vote</h3>
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
                <button className="btn btn-ghost" type="button" onClick={enableBrowserAlerts}>
                  {browserAlertsEnabled ? 'Device Alerts On' : 'Enable Device Alerts'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={testAlert}>
                  Test Alert
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
