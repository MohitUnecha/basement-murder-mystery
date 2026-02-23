import React, { useState } from 'react'
import Login from './components/Login'
import PlayerCard from './components/PlayerCard'
import HostDashboard from './components/HostDashboard'
import GameBriefing from './components/GameBriefing'

export default function App() {
  const [session, setSession] = useState(null)
  const [started, setStarted] = useState(false)

  const onLogin = (nextSession) => {
    setSession(nextSession)
    setStarted(false)
  }

  if (!session) return <Login onLogin={onLogin} />

  if (!started && session.role !== 'host') {
    return (
      <GameBriefing
        session={session}
        onContinue={() => setStarted(true)}
        onLogout={() => setSession(null)}
      />
    )
  }

  if (session.role === 'host') {
    return <HostDashboard session={session} onLogout={() => setSession(null)} />
  }

  return <PlayerCard session={session} onLogout={() => setSession(null)} />
}
