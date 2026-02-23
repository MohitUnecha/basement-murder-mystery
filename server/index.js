const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : true;

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '32kb' }));

const DATA_DIR = path.join(__dirname, 'data');
const playersData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'players.json'), 'utf8'));
const clues = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'clues.json'), 'utf8'));

const hostPin = Number(playersData.hostPin);
const players = playersData.players;
const privateAddons = playersData.privateAddons || [];

const playersByPin = new Map(players.map((player) => [Number(player.pin), player]));
const playersByName = new Map(players.map((player) => [player.name, player]));
const privateAddonsByName = new Map(privateAddons.map((addon) => [addon.name, addon]));
const detectiveNames = new Set(
  privateAddons.filter((addon) => addon.type === 'detective').map((addon) => addon.name),
);

const state = {
  revealedClues: new Set(),
  votesByVoter: new Map(),
  sessions: new Map(),
};

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function parsePin(value) {
  const pin = Number(value);
  if (!Number.isInteger(pin) || pin <= 0) return null;
  return pin;
}

function normalizeName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function sanitizePlayer(player) {
  const { pin, privateAddon, ...clean } = player;
  return clean;
}

function getTokenFromHeader(req) {
  const authHeader = req.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function requireSession(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: 'missing bearer token' });

  const session = state.sessions.get(token);
  if (!session) return res.status(401).json({ error: 'invalid or expired token' });

  req.session = session;
  req.sessionToken = token;
  return next();
}

function requireHost(req, res, next) {
  if (req.session.role !== 'host') return res.status(403).json({ error: 'host access required' });
  return next();
}

function votesAsArray() {
  return Array.from(state.votesByVoter.values()).sort((a, b) => a.time - b.time);
}

function computeResults() {
  const tally = {};

  for (const vote of state.votesByVoter.values()) {
    const weight = detectiveNames.has(vote.voter) ? 2 : 1;
    tally[vote.suspect] = (tally[vote.suspect] || 0) + weight;
  }

  const ranked = Object.entries(tally)
    .map(([suspect, count]) => ({ suspect, count }))
    .sort((a, b) => b.count - a.count);

  return { tally, ranked, votes: votesAsArray() };
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    players: players.length,
    clues: clues.length,
    revealedCount: state.revealedClues.size,
    voteCount: state.votesByVoter.size,
  });
});

app.get('/api/players', (_req, res) => {
  res.json({
    players: players.map((player) => ({
      name: player.name,
      title: player.title,
      witnessMemory: player.witnessMemory,
    })),
  });
});

app.post('/api/auth', (req, res) => {
  const pin = parsePin(req.body?.pin);
  if (!pin) return res.status(400).json({ error: 'valid pin required' });

  if (pin === hostPin) {
    const token = createToken();
    state.sessions.set(token, { role: 'host', createdAt: Date.now() });
    return res.json({ role: 'host', token });
  }

  const player = playersByPin.get(pin);
  if (!player) return res.status(404).json({ error: 'invalid pin' });

  const token = createToken();
  state.sessions.set(token, {
    role: 'player',
    playerName: player.name,
    pin,
    createdAt: Date.now(),
  });

  const result = sanitizePlayer(player);
  const addon = privateAddonsByName.get(player.name);
  if (addon) result.privateAddonData = addon;

  return res.json({ role: 'player', token, player: result });
});

app.post('/api/logout', requireSession, (req, res) => {
  state.sessions.delete(req.sessionToken);
  res.json({ ok: true });
});

app.get('/api/clues', requireSession, requireHost, (_req, res) => {
  res.json(
    clues.map((clue) => ({
      ...clue,
      revealed: state.revealedClues.has(clue.number),
    })),
  );
});

app.get('/api/revealed', (_req, res) => {
  const revealed = clues.filter((clue) => state.revealedClues.has(clue.number));
  res.json({ revealed });
});

app.post('/api/reveal-clue', requireSession, requireHost, (req, res) => {
  const number = Number(req.body?.number);
  if (!Number.isInteger(number) || number <= 0) {
    return res.status(400).json({ error: 'valid clue number required' });
  }

  const clue = clues.find((entry) => entry.number === number);
  if (!clue) return res.status(404).json({ error: 'clue not found' });

  state.revealedClues.add(clue.number);
  const revealed = clues.filter((entry) => state.revealedClues.has(entry.number));
  return res.json({ revealed });
});

app.post('/api/vote', requireSession, (req, res) => {
  const suspectName = normalizeName(req.body?.suspectName);
  if (!suspectName) return res.status(400).json({ error: 'suspectName required' });
  if (!playersByName.has(suspectName)) return res.status(400).json({ error: 'unknown suspect name' });

  let voterName;
  if (req.session.role === 'player') {
    voterName = req.session.playerName;
  } else if (req.session.role === 'host') {
    const voterPin = parsePin(req.body?.voterPin);
    if (!voterPin) return res.status(400).json({ error: 'voterPin required for host vote entry' });
    const voter = playersByPin.get(voterPin);
    if (!voter) return res.status(404).json({ error: 'voter not found' });
    voterName = voter.name;
  } else {
    return res.status(403).json({ error: 'unsupported role' });
  }

  state.votesByVoter.set(voterName, {
    voter: voterName,
    suspect: suspectName,
    time: Date.now(),
  });

  return res.json({ votes: votesAsArray() });
});

app.get('/api/votes', requireSession, requireHost, (_req, res) => {
  res.json({ votes: votesAsArray() });
});

app.get('/api/results', requireSession, requireHost, (_req, res) => {
  res.json(computeResults());
});

app.post('/api/reset', requireSession, requireHost, (_req, res) => {
  state.revealedClues.clear();
  state.votesByVoter.clear();
  res.json({ ok: true, message: 'game state reset' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
