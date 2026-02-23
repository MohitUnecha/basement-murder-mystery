import React from 'react'

export default function PlayerCard({ player }) {
  return (
    <div className="container">
      <div className="card">
        <h2>{player.name} — {player.title}</h2>
        <p><strong>Relationship:</strong> {player.relationship}</p>
        <p><strong>Personality:</strong> {player.personality}</p>
        <p><strong>What happened today:</strong> {player.whatHappened}</p>
        <p><strong>6:17 Alibi:</strong> {player.alibi} — Confirm: {player.confirm}</p>
        <p><strong>Secret:</strong> {player.secret}</p>
        <p><strong>Finger-point hook:</strong> {player.fingerPointHook}</p>
        <p><strong>WITNESS MEMORY:</strong> {player.witnessMemory}</p>

        {player.privateAddonData && (
          <div className="private">
            <h3>Private Add-On</h3>
            <pre>{JSON.stringify(player.privateAddonData, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
