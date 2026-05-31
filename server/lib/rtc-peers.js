/**
 * Per gebruiker een eigen blob — geen overschrijven meer bij meerdere spelers in 1 kamer.
 */
const PEER_PREFIX = 'urp-rtc-peer-';
const PEER_TTL_MS = 5 * 60_000;

function getToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN vereist voor URP Call.');
  return token;
}

function safeRoom(roomId) {
  return String(roomId).replace(/[^a-zA-Z0-9_-]/g, '');
}

function peerPath(roomId, peerId) {
  return `${PEER_PREFIX}${safeRoom(roomId)}-${String(peerId)}.json`;
}

function peerFromMember(member) {
  return {
    id: String(member.discordId),
    name: member.username,
    avatarUrl: member.avatarUrl || null,
    discordUsername: member.discordUsername || null,
    isStaff: !!member.isStaff,
  };
}

async function upsertPeer(roomId, peer, opts) {
  const { put, head } = require('@vercel/blob');
  const token = getToken();
  const id = String(peer.id);
  const path = peerPath(roomId, id);
  let joinedAt = peer.joinedAt;
  if (!joinedAt) {
    try {
      const meta = await head(path, { token });
      if (meta?.url) {
        const res = await fetch(meta.url, { cache: 'no-store' });
        if (res.ok) joinedAt = (await res.json()).joinedAt;
      }
    } catch {
      /* nieuw */
    }
  }
  const data = {
    id,
    name: peer.name || 'Onbekend',
    avatarUrl: peer.avatarUrl || null,
    discordUsername: peer.discordUsername || null,
    isStaff: !!peer.isStaff,
    joinedAt: joinedAt || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
  await put(path, JSON.stringify(data), {
    access: 'public',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return data;
}

async function removePeer(roomId, peerId) {
  try {
    const { del } = require('@vercel/blob');
    await del(peerPath(roomId, peerId), { token: getToken() });
  } catch {
    /* bestaat niet */
  }
}

async function listPeersInRoom(roomId) {
  const token = getToken();
  try {
    const { list } = require('@vercel/blob');
    const prefix = `${PEER_PREFIX}${safeRoom(roomId)}-`;
    const result = await list({ prefix, token });
    const now = Date.now();
    const peers = [];
    for (const blob of result.blobs || []) {
      try {
        const res = await fetch(blob.url, { cache: 'no-store' });
        if (!res.ok) continue;
        const p = await res.json();
        const last = new Date(p.lastSeen || p.joinedAt || 0).getTime();
        if (!p.id || now - last > PEER_TTL_MS) {
          removePeer(roomId, p.id).catch(() => {});
          continue;
        }
        peers.push({
          id: String(p.id),
          name: p.name || 'Onbekend',
          avatarUrl: p.avatarUrl || null,
          discordUsername: p.discordUsername || null,
          isStaff: !!p.isStaff,
          joinedAt: p.joinedAt,
          lastSeen: p.lastSeen,
        });
      } catch {
        /* skip corrupt */
      }
    }
    return peers;
  } catch (err) {
    console.error('listPeersInRoom:', err);
    return [];
  }
}

module.exports = {
  upsertPeer,
  removePeer,
  listPeersInRoom,
  peerFromMember,
};
