import React, { lazy, Suspense, useState } from 'react'
import Login from './components/Login'
const PlayerCard = lazy(() => import('./components/PlayerCard'))
const HostDashboard = lazy(() => import('./components/HostDashboard'))
const GameBriefing = lazy(() => import('./components/GameBriefing'))

function briefingSeenKey(session) {
  if (!session?.player?.pin) return 'sapphire_briefing_seen_round'
  return `sapphire_briefing_seen_round_${session.player.pin}`
}

function readSeenRound(session) {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(briefingSeenKey(session))
  const num = Number(raw)
  return Number.isInteger(num) ? num : 0
}

function markSeenRound(session, roundVersion) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(briefingSeenKey(session), String(roundVersion))
}

export default function App() {
  const [session, setSession] = useState(null)
  const [started, setStarted] = useState(false)
  const [roundVersion, setRoundVersion] = useState(1)
  const [briefingPopupOpen, setBriefingPopupOpen] = useState(false)

  const onLogin = (nextSession) => {
    const nextRoundVersion = Number(nextSession.roundVersion) || 1
    setRoundVersion(nextRoundVersion)

    if (nextSession.role === 'host') {
      setSession(nextSession)
      setStarted(true)
      setBriefingPopupOpen(false)
      return
    }

    const seenRound = readSeenRound(nextSession)
    setSession(nextSession)
    setStarted(seenRound >= nextRoundVersion)
    setBriefingPopupOpen(false)
  }

  const finishBriefing = () => {
    if (session?.role === 'player') {
      markSeenRound(session, roundVersion)
    }
    setStarted(true)
    setBriefingPopupOpen(false)
  }

  if (!session) return <Login onLogin={onLogin} />

  const loadingFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#6e7a88', fontFamily: 'Inter, system-ui, sans-serif' }}>
      Loading...
    </div>
  )

  if (!started && session.role !== 'host') {
    return (
      <Suspense fallback={loadingFallback}>
        <GameBriefing
          session={session}
          onContinue={finishBriefing}
          onLogout={() => setSession(null)}
        />
      </Suspense>
    )
  }

  let content

  if (session.role === 'host') {
    content = <HostDashboard session={session} onLogout={() => setSession(null)} />
  } else {
    content = (
      <PlayerCard
        session={session}
        onLogout={() => setSession(null)}
        onOpenBriefing={() => setBriefingPopupOpen(true)}
        onRoundVersionChange={(nextRoundVersion) => {
          setRoundVersion(nextRoundVersion)
          setBriefingPopupOpen(true)
        }}
      />
    )
  }

  return (
    <Suspense fallback={loadingFallback}>
      {content}
      {session.role === 'player' && briefingPopupOpen && (
        <GameBriefing
          session={session}
          onContinue={finishBriefing}
          onLogout={() => setSession(null)}
          modal
          onClose={finishBriefing}
        />
      )}
    </Suspense>
  )
}
