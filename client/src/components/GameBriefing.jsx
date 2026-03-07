import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE !== undefined 
  ? import.meta.env.VITE_API_BASE.trim() 
  : 'http://localhost:4000'

export default function GameBriefing({ session, onContinue, onLogout, modal = false, onClose = null }) {
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
      <div className={modal ? 'briefing-modal-overlay' : 'screen'}>
        <div className="card">
          <h2>Loading Briefing...</h2>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    )
  }

  const wrapperClass = modal ? 'briefing-modal-overlay' : 'screen'
  const bodyClass = modal ? 'briefing-modal' : ''

  return (
    <div className={wrapperClass}>
      <div className={bodyClass}>
        <div className="topbar">
          <div>
            <div className="eyebrow">Case Briefing</div>
            <h2 className="title-sm">{briefing.title}</h2>
            <p className="subtitle">{briefing.crime}</p>
          </div>
          {modal ? (
            <button className="btn btn-ghost" onClick={onClose || onContinue}>Close</button>
          ) : (
            <button className="btn btn-ghost" onClick={onLogout}>Log Out</button>
          )}
        </div>

        <div className="briefing-grid stagger">
          <section className="card">
            <h3>The Story</h3>
            {briefing.story.map((line, i) => (
              <p key={i} style={{ color: '#b0b8c2' }}>{line}</p>
            ))}
          </section>

          <section className="card">
            <h3>Game Rules</h3>
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
                  <strong>{item.phase}</strong> <span style={{ color: '#8b95a0' }}>({item.time})</span> — {item.details}
                </li>
              ))}
            </ul>
          </section>

          <section className="card" style={{ display: 'grid', gap: '14px' }}>
            <h3>Opening Statement</h3>
            {briefing.readAloud.map((line, i) => (
              <p key={i} style={{ color: '#b0b8c2', fontStyle: 'italic' }}>{line}</p>
            ))}
            <button className="btn btn-primary" onClick={onContinue} style={{ marginTop: '8px' }}>
              {modal ? 'Back to Investigation' : 'Begin the Investigation'}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
