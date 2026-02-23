import React, { useState } from 'react'
import Login from './components/Login'
import PlayerCard from './components/PlayerCard'
import HostDashboard from './components/HostDashboard'

export default function App() {
  const [session, setSession] = useState(null)

  if (!session) return <Login onLogin={setSession} />

  if (session.role === 'host') return <HostDashboard session={session} onLogout={() => setSession(null)} />

  return <PlayerCard session={session} onLogout={() => setSession(null)} />
}
