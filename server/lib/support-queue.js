const fs = require('fs');
const path = require('path');

const BLOB_PATHNAME = 'urp-support-queue.json';
const MAX_WAIT_MS = 2 * 60 * 60 * 1000;

function readChannelsConfig() {
  try {
    const p = path.join(process.cwd(), 'data', 'support-channels.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {
      channels: [
        {
          id: 'speler-support',
          naam: 'Support 1',
          beschrijving: 'Bel met staff — klik zelf op Verbinden',
          callRoom: 'URP-Support-Spelers',
          staffOnly: false,
        },
        {
          id: 'moderator-overleg',
          naam: 'Support 2',
          beschrijving: 'Alleen staff — handmatig verbinden',
          callRoom: 'URP-Support-Moderators',
          staffOnly: true,
        },
      ],
    };
  }
}

async function loadBlob() {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return { waiting: [], admitted: [], updatedAt: null };
  try {
    const { head } = require('@vercel/blob');
    const meta = await head(BLOB_PATHNAME, { token: blobToken });
    if (!meta?.url) return { waiting: [], admitted: [], updatedAt: null };
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) return { waiting: [], admitted: [], updatedAt: null };
    return await res.json();
  } catch {
    return { waiting: [], admitted: [], updatedAt: null };
  }
}

async function saveBlob(data) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error('BLOB_READ_WRITE_TOKEN vereist voor de support-wachtkamer.');
  }
  const { put } = require('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(data), {
    access: 'public',
    token: blobToken,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function pruneQueue(state) {
  const now = Date.now();
  state.waiting = (state.waiting || []).filter((e) => now - new Date(e.joinedAt).getTime() < MAX_WAIT_MS);
  state.admitted = (state.admitted || []).filter((e) => now - new Date(e.admittedAt).getTime() < 30 * 60 * 1000);
  return state;
}

async function getQueue() {
  const state = pruneQueue(await loadBlob());
  return state;
}

async function updateQueue(mutator) {
  const state = pruneQueue(await loadBlob());
  mutator(state);
  state.updatedAt = new Date().toISOString();
  await saveBlob(state);
  return state;
}

function findChannel(channelId) {
  const cfg = readChannelsConfig();
  return (cfg.channels || []).find((c) => c.id === channelId) || null;
}

module.exports = {
  readChannelsConfig,
  getQueue,
  updateQueue,
  findChannel,
};
