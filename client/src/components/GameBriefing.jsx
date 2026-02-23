import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').trim()

export default function GameBriefing({ session, onContinue, onLogout }) {
  const [briefing, setBriefing] = useState(null)
  const [error, setError] = useState(null)

  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${session.token}` },
    }),
    [session.token],
  )

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/game-briefing`)
        if (active) setBriefing(res.data)
      } catch (err) {
        if (active) setError(err.response?.data?.error || err.message)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const logout = async () => {
    try {
      await axios.post(`${API_BASE}/api/logout`, {}, authHeaders)
    } catch (_err) {
      // Ignore logout network failures and still clear local session.
    } finally {
      onLogout()
    }
  }

  if (!briefing) {
    return (
      <div className="screen">
        <div className="card">
          <h2>Loading Briefing...</h2>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <div className="eyebrow">Case Briefing</div>
          <h2 className="title-sm">{briefing.title}</h2>
          <p className="subtitle">{briefing.crime}</p>
        </div>
        <button className="btn btn-ghost" onClick={logout}>Log Out</button>
      </div>

      <div className="briefing-grid">
        <section className="card">
          <h3>The Story</h3>
          {briefing.story.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>

        <section className="card">
          <h3>Main Rules</h3>
          <ul className="simple-list">
            {briefing.rules.map((rule) => (
              <li key={rule.id}>
                <strong>{rule.title}:</strong> {rule.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>Timeline</h3>
          <ul className="simple-list">
            {briefing.timeline.map((item) => (
              <li key={item.phase}>
                <strong>{item.phase}</strong> ({item.time}) - {item.details}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>Read Aloud</h3>
          {briefing.readAloud.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <button className="btn btn-primary" onClick={onContinue}>
            {session.role === 'host' ? 'Open Host Console' : 'Start Investigation'}
          </button>
        </section>
      </div>
    </div>
  )
}
