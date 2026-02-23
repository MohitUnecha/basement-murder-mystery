import React, { useState } from 'react'
import Login from './components/Login'
import PlayerCard from './components/PlayerCard'
import HostDashboard from './components/HostDashboard'
import GameBriefing from './components/GameBriefing'

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

  if (!started && session.role !== 'host') {
    return (
      <GameBriefing
        session={session}
        onContinue={finishBriefing}
        onLogout={() => setSession(null)}
      />
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
    <>
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
    </>
  )
}
