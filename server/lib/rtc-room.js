const BLOB_PREFIX = 'urp-rtc-room-';
const MAX_SIGNALS = 200;
const SIGNAL_TTL_MS = 120_000;
const PEER_TTL_MS = 30 * 60_000;
const PEER_IDLE_MS = 120_000;

function blobPath(roomId) {
  return BLOB_PREFIX + roomId.replace(/[^a-zA-Z0-9_-]/g, '') + '.json';
}

async function loadRoom(roomId) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) throw new Error('BLOB_READ_WRITE_TOKEN vereist voor URP Call.');
  try {
    const { head } = require('@vercel/blob');
    const pathname = blobPath(roomId);
    const meta = await head(pathname, { token: blobToken });
    if (!meta?.url) return { peers: {}, signals: [] };
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) return { peers: {}, signals: [] };
    return await res.json();
  } catch {
    return { peers: {}, signals: [] };
  }
}

async function saveRoom(roomId, data) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const { put } = require('@vercel/blob');
  await put(blobPath(roomId), JSON.stringify(data), {
    access: 'public',
    token: blobToken,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function pruneRoom(state) {
  const now = Date.now();
  const peers = state.peers || {};
  Object.keys(peers).forEach((id) => {
    const last = new Date(peers[id].lastSeen || peers[id].joinedAt).getTime();
    if (now - last > PEER_TTL_MS) {
      delete peers[id];
    } else if (peers[id].lastSeen && now - last > PEER_IDLE_MS) {
      delete peers[id];
    }
  });
  state.signals = (state.signals || []).filter(
    (s) => now - new Date(s.at).getTime() < SIGNAL_TTL_MS
  );
  if (state.signals.length > MAX_SIGNALS) {
    state.signals = state.signals.slice(-MAX_SIGNALS);
  }
  state.peers = peers;
  return state;
}

async function updateRoom(roomId, mutator) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const state = pruneRoom(await loadRoom(roomId));
    mutator(state);
    state.updatedAt = new Date().toISOString();
    try {
      await saveRoom(roomId, state);
      return state;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Kamer opslaan mislukt');
}

module.exports = { loadRoom, updateRoom, pruneRoom };
