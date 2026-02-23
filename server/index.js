const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const players = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'players.json')));
const clues = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'clues.json')));

// In-memory state
let revealedClues = [];
let votes = [];

app.get('/api/players', (req, res) => {
  res.json({ players: players.players.map(p => ({ name: p.name, title: p.title, witnessMemory: p.witnessMemory })) });
});

app.get('/api/clues', (req, res) => {
  res.json(clues);
});

app.get('/api/revealed', (req, res) => {
  res.json({ revealed: revealedClues });
});

app.post('/api/auth', (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'pin required' });

  if (parseInt(pin, 10) === players.hostPin) {
    return res.json({ role: 'host' });
  }

  const p = players.players.find(x => x.pin === Number(pin));
  if (p) {
    // include private addon if matches
    const addon = players.privateAddons.find(a => a.name === p.name);
    const result = { ...p };
    if (addon) result.privateAddonData = addon;
    return res.json({ role: 'player', player: result });
  }

  return res.status(404).json({ error: 'invalid pin' });
});

app.post('/api/reveal-clue', (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: 'clue number required' });
  const clue = clues.find(c => c.number === Number(number));
  if (!clue) return res.status(404).json({ error: 'not found' });
  if (!revealedClues.find(c => c.number === clue.number)) revealedClues.push(clue);
  res.json({ revealed: revealedClues });
});

app.post('/api/vote', (req, res) => {
  const { voterPin, suspectName } = req.body;
  if (!voterPin || !suspectName) return res.status(400).json({ error: 'voterPin and suspectName required' });
  const voter = players.players.find(x => x.pin === Number(voterPin));
  if (!voter) return res.status(404).json({ error: 'voter not found' });
  // record vote
  votes.push({ voter: voter.name, suspect: suspectName, time: Date.now() });
  res.json({ votes });
});

app.get('/api/votes', (req, res) => {
  res.json({ votes });
});

app.get('/api/results', (req, res) => {
  // simple tally
  const tally = {};
  for (const v of votes) {
    tally[v.suspect] = (tally[v.suspect] || 0) + 1;
  }
  // apply detectives double-vote if present in voters' private addon
  for (const v of votes) {
    const p = players.players.find(x => x.name === v.voter);
    const addon = players.privateAddons.find(a => a.name === p.name && a.type === 'detective');
    if (addon) {
      // detectives count as 2 total votes, so add 1 extra for each detective vote
      tally[v.suspect] = (tally[v.suspect] || 0) + 1;
    }
  }
  res.json({ tally, votes });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
