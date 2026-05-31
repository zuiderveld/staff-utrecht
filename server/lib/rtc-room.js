const BLOB_PREFIX = 'urp-rtc-room-';
const MAX_SIGNALS = 200;
const SIGNAL_TTL_MS = 120_000;
const PEER_TTL_MS = 30 * 60_000;
const PEER_DISPLAY_MS = 5 * 60_000;

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

function pruneRoom(state, maxIdleMs) {
  const now = Date.now();
  const idleLimit = maxIdleMs || PEER_TTL_MS;
  const peers = state.peers || {};
  Object.keys(peers).forEach((id) => {
    const last = new Date(peers[id].lastSeen || peers[id].joinedAt).getTime();
    if (now - last > idleLimit) {
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

function mergePeerMaps(a, b) {
  const out = { ...(a || {}) };
  Object.keys(b || {}).forEach((id) => {
    if (!out[id]) {
      out[id] = b[id];
      return;
    }
    const tA = new Date(out[id].lastSeen || out[id].joinedAt || 0).getTime();
    const tB = new Date(b[id].lastSeen || b[id].joinedAt || 0).getTime();
    if (tB >= tA) out[id] = { ...out[id], ...b[id] };
  });
  return out;
}

async function updateRoom(roomId, mutator) {
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    const snapA = await loadRoom(roomId);
    if (attempt > 0) await new Promise((r) => setTimeout(r, 40 * attempt));
    const snapB = await loadRoom(roomId);
    const mergedPeers = mergePeerMaps(snapA.peers, snapB.peers);
    const state = pruneRoom({
      peers: mergedPeers,
      signals: [...(snapB.signals || snapA.signals || [])],
      updatedAt: snapB.updatedAt || snapA.updatedAt,
    });
    mutator(state);
    state.peers = mergePeerMaps(mergedPeers, state.peers);
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

function listPeersForDisplay(state) {
  return pruneRoom(
    { peers: { ...(state.peers || {}) }, signals: state.signals || [] },
    PEER_DISPLAY_MS
  ).peers;
}

module.exports = { loadRoom, updateRoom, pruneRoom, listPeersForDisplay, mergePeerMaps };
