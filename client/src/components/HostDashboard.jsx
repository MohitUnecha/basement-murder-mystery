import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function HostDashboard() {
  const [clues, setClues] = useState([])
  const [revealed, setRevealed] = useState([])
  const [votes, setVotes] = useState([])
  const [results, setResults] = useState(null)

  useEffect(() => { fetchClues(); fetchRevealed(); fetchVotes(); }, [])

  const fetchClues = async () => {
    const res = await axios.get('http://localhost:4000/api/clues')
    setClues(res.data)
  }
  const fetchRevealed = async () => {
    const res = await axios.get('http://localhost:4000/api/revealed')
    setRevealed(res.data.revealed)
  }
  const fetchVotes = async () => {
    const res = await axios.get('http://localhost:4000/api/votes')
    setVotes(res.data.votes)
  }
  const reveal = async (n) => {
    await axios.post('http://localhost:4000/api/reveal-clue', { number: n })
    fetchRevealed()
  }
  const fetchResults = async () => {
    const res = await axios.get('http://localhost:4000/api/results')
    setResults(res.data)
  }

  return (
    <div className="container">
      <h2>Host Dashboard</h2>
      <div className="panel">
        <h3>All Clues</h3>
        <ul>
          {clues.map(c => (
            <li key={c.number}>
              #{c.number} — hidden: {c.hide}
              <button onClick={() => reveal(c.number)} style={{marginLeft:8}}>Reveal</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>Revealed Clues</h3>
        <ul>
          {revealed.map(r => <li key={r.number}>#{r.number}: {r.text}</li>)}
        </ul>
      </div>

      <div className="panel">
        <h3>Votes</h3>
        <button onClick={fetchVotes}>Refresh Votes</button>
        <button onClick={fetchResults} style={{marginLeft:8}}>Tally</button>
        <pre>{JSON.stringify(votes, null, 2)}</pre>
        {results && <pre>{JSON.stringify(results, null, 2)}</pre>}
      </div>
    </div>
  )
}
