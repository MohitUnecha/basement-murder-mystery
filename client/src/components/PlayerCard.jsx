import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').trim()
const POLL_MS = 3000
const CHAT_POLL_MS = 2000

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

function formatChatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function PlayerCard({ session, onLogout, onOpenBriefing, onRoundVersionChange }) {
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

  // Chat state
  const [chatMessages, setChatMessages] = useState([])
  const [chatText, setChatText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const latestChatIdRef = useRef(0)
  const chatEndRef = useRef(null)

  const latestAnnouncementIdRef = useRef(0)
  const roundVersionRef = useRef(Number(session.roundVersion) || 1)
  const browserAlertsEnabledRef = useRef(browserAlertsEnabled)
  const toastTimerRef = useRef(null)
  const titleTimerRef = useRef(null)
  const originalTitleRef = useRef(
    typeof document !== 'undefined' ? document.title : 'The Sapphire of Shadows',
  )

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${session.token}` } }),
    [session.token],
  )

  /* ── Notification helpers ── */

  const showToast = useCallback((text) => {
    setToast(text)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 6000)
  }, [])

  const dismissToast = useCallback(() => {
    setToast(null)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const flashTitle = useCallback((text) => {
    if (typeof document === 'undefined' || !document.hidden) return
    if (titleTimerRef.current) clearInterval(titleTimerRef.current)
    let on = false, ticks = 0
    titleTimerRef.current = setInterval(() => {
      on = !on
      document.title = on ? text : originalTitleRef.current
      if (++ticks > 10 && titleTimerRef.current) {
        clearInterval(titleTimerRef.current)
        titleTimerRef.current = null
        document.title = originalTitleRef.current
      }
    }, 500)
  }, [])

  const tryBrowserNotification = useCallback((text, tag) => {
    if (!browserAlertsEnabledRef.current || typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    try { new Notification('The Sapphire of Shadows', { body: text, tag }) } catch (_e) {}
  }, [])

  const tryVibrate = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([120, 60, 120]) } catch (_e) {}
    }
  }, [])

  const notify = useCallback((text, tag) => {
    showToast(text)
    flashTitle('\u{1F514} New Update!')
    tryBrowserNotification(text, tag)
    tryVibrate()
  }, [showToast, flashTitle, tryBrowserNotification, tryVibrate])

  const enableBrowserAlerts = async () => {
    if (typeof Notification === 'undefined') { showToast('Not supported.'); return }
    if (Notification.permission === 'granted') {
      setBrowserAlertsEnabled(true)
      browserAlertsEnabledRef.current = true
      notify('Notifications already active!', 'alerts-on')
      return
    }
    if (Notification.permission === 'denied') {
      showToast('Notifications blocked \u2014 enable in browser settings.')
      return
    }
    const perm = await Notification.requestPermission()
    const ok = perm === 'granted'
    setBrowserAlertsEnabled(ok)
    browserAlertsEnabledRef.current = ok
    if (ok) notify('Notifications enabled!', 'alerts-result')
    else showToast('Notifications not enabled.')
  }

  const testAlert = () => notify('Test alert \u2014 working!', 'test-alert')

  /* ── Polling (game state) ── */

  const pollGameState = useCallback(async () => {
    const res = await axios.get(
      `${API_BASE}/api/game-state?sinceAnnouncementId=${latestAnnouncementIdRef.current}`,
      authHeaders,
    )
    const data = res.data
    if ((data.roundVersion || 1) > roundVersionRef.current) {
      roundVersionRef.current = data.roundVersion
      if (onRoundVersionChange) onRoundVersionChange(data.roundVersion)
    }
    setRevealedClues(data.revealed || [])
    setMeetingLabel(data.phaseLabel || 'Pregame')
    latestAnnouncementIdRef.current = data.latestAnnouncementId || latestAnnouncementIdRef.current
    if (data.announcements?.length) {
      setAnnouncements((prev) => [...data.announcements, ...prev].slice(0, 20))
      data.announcements.forEach((item) => notify(item.message, `announcement-${item.id}`))
    }
  }, [authHeaders, onRoundVersionChange, notify])

  /* ── Polling (chat) ── */

  const pollChat = useCallback(async () => {
    const res = await axios.get(
      `${API_BASE}/api/chat?sinceChatId=${latestChatIdRef.current}`,
      authHeaders,
    )
    const data = res.data
    if (data.messages?.length) {
      setChatMessages((prev) => [...prev, ...data.messages].slice(-200))
      latestChatIdRef.current = data.latestChatId || latestChatIdRef.current
      // Auto scroll
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [authHeaders])

  useEffect(() => { browserAlertsEnabledRef.current = browserAlertsEnabled }, [browserAlertsEnabled])

  useEffect(() => {
    let active = true

    const loadPlayers = async () => {
      const res = await axios.get(`${API_BASE}/api/players`)
      const names = (res.data.players || [])
        .map((e) => e.name)
        .filter((n) => n && n !== player.name)
        .sort((a, b) => a.localeCompare(b))
      if (active) {
        setSuspects(names)
        setSuspectName((c) => c || names[0] || '')
      }
    }

    const init = async () => {
      try { await Promise.all([loadPlayers(), pollGameState(), pollChat()]) }
      catch (err) { if (active) setError(err.response?.data?.error || err.message) }
    }
    init()

    const gameTimer = setInterval(() => {
      if (active) pollGameState().catch(() => {})
    }, POLL_MS)

    const chatTimer = setInterval(() => {
      if (active) pollChat().catch(() => {})
    }, CHAT_POLL_MS)

    return () => {
      active = false
      clearInterval(gameTimer)
      clearInterval(chatTimer)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (titleTimerRef.current) clearInterval(titleTimerRef.current)
      if (typeof document !== 'undefined') document.title = originalTitleRef.current
    }
  }, [player.name, pollGameState, pollChat])

  /* ── Chat send ── */

  const sendChat = async (e) => {
    e.preventDefault()
    const text = chatText.trim()
    if (!text) return
    setChatSending(true)
    try {
      await axios.post(`${API_BASE}/api/chat`, { text }, authHeaders)
      setChatText('')
      await pollChat()
    } catch (_err) {}
    setChatSending(false)
  }

  /* ── Vote ── */

  const submitVote = async (event) => {
    event.preventDefault()
    if (!suspectName) return
    try {
      setBusy(true); setError(null); setVoteMessage(null)
      await axios.post(`${API_BASE}/api/vote`, { suspectName }, authHeaders)
      setVoteMessage(`Vote locked for ${suspectName}. You can change it before final tally.`)
    } catch (err) { setError(err.response?.data?.error || err.message) }
    finally { setBusy(false) }
  }

  const logout = async () => {
    try { await axios.post(`${API_BASE}/api/logout`, {}, authHeaders) } catch (_e) {}
    onLogout()
  }

  /* ── Render ── */

  return (
    <div className="screen">
      {/* Sticky topbar */}
      <div className="topbar">
        <div>
          <div className="eyebrow">Investigation Live</div>
          <h2 className="title-sm">{player.name} &mdash; {player.title}</h2>
          <p className="status-pill">{meetingLabel}</p>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={onOpenBriefing}>Briefing</button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Log Out</button>
        </div>
      </div>

      {/* Alert Control Bar */}
      <div className={`alert-bar ${browserAlertsEnabled ? 'alert-bar-on' : 'alert-bar-off'}`}>
        <span className="alert-icon">{browserAlertsEnabled ? '\u{1F514}' : '\u{1F515}'}</span>
        <div className="alert-bar-text">
          <strong>{browserAlertsEnabled ? 'Alerts Active' : 'Enable Alerts'}</strong>
          {browserAlertsEnabled
            ? "You'll be notified when clues drop, meetings start, or the host broadcasts."
            : 'Turn on alerts so you never miss a clue reveal or meeting call.'}
        </div>
        {!browserAlertsEnabled ? (
          <button className="btn-alert-enable" onClick={enableBrowserAlerts}>Enable Now</button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={testAlert}>Test</button>
        )}
      </div>

      <div className="layout-grid player-layout">
        {/* Left: Character Card */}
        <section className="card briefing">
          <h3>Your Card</h3>
          <div className="card-field">
            <div className="card-field-label">Who You Are</div>
            <p>{player.whoYouAre}</p>
          </div>
          <div className="card-field">
            <div className="card-field-label">Tonight</div>
            <p>{player.tonight}</p>
          </div>
          <div className="card-field">
            <div className="card-field-label">8:47 Alibi</div>
            <p>{player.alibi}</p>
          </div>
          <div className="card-field must-talk">
            <div className="card-field-label">Must Talk To</div>
            <div className="must-talk-tags">
              {player.mustTalkTo?.map((name) => (
                <span key={name} className="talk-tag">{name}</span>
              ))}
            </div>
          </div>
          <div className="card-field secret-field">
            <div className="card-field-label">Your Secret</div>
            <p>{player.secret}</p>
          </div>
          <div className="card-field">
            <div className="card-field-label">Your Role in the Game</div>
            <p>{player.roleInGame || player.suspicionHook}</p>
          </div>
          <div className="card-field">
            <div className="card-field-label">Witness Memory</div>
            <p>{player.witnessMemory}</p>
          </div>
        </section>

        {/* Right column */}
        <div className="stack stagger">
          <section className={`card role-card role-${roleType}`}>
            <h3>{getRoleTitle(roleType)}</h3>
            <ul className="simple-list">
              {buildRoleDescription(roleType, addon).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          {/* ── CHAT ── */}
          <section className="card chat-card">
            <h3>Investigation Chat</h3>
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <p className="hint" style={{ textAlign: 'center', padding: '20px 0' }}>
                  No messages yet. Start the discussion!
                </p>
              )}
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-bubble ${msg.sender === player.name ? 'chat-mine' : ''} ${msg.sender === 'Host' ? 'chat-host' : ''}`}
                >
                  <div className="chat-meta">
                    <strong>{msg.sender}</strong>
                    <span>{formatChatTime(msg.createdAt)}</span>
                  </div>
                  <div className="chat-text">{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-input-row" onSubmit={sendChat}>
              <input
                className="input chat-input"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Type a message..."
                maxLength={300}
                disabled={chatSending}
              />
              <button className="btn btn-primary chat-send" type="submit" disabled={!chatText.trim() || chatSending}>
                Send
              </button>
            </form>
          </section>

          <section className="card">
            <h3>Live Clue Feed</h3>
            {revealedClues.length === 0 ? (
              <p className="hint">No clues revealed yet &mdash; stay tuned.</p>
            ) : (
              <ul className="clue-feed">
                {revealedClues.map((clue) => (
                  <li key={clue.number}>
                    <strong>Pack {clue.pack} &mdash; Clue #{clue.number}: {clue.title}</strong>
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
              <label className="label">Who do you think did it?</label>
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
      </div>

      {/* Toast */}
      {toast && (
        <div className="floating-toast">
          <span className="toast-icon">{'\u{1F514}'}</span>
          <div style={{ flex: 1 }}>{toast}</div>
          <button className="toast-close" onClick={dismissToast}>{'\u00D7'}</button>
        </div>
      )}
    </div>
  )
}
