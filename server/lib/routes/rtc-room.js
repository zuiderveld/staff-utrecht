const { verifyGuildMember, assertSupportAccess } = require('../discord-staff');
const { loadRoom, updateRoom, pruneRoom } = require('../rtc-room');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function iceServersFromEnv() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ];
  const turnUrl = process.env.TURN_URL;
  const turnUser = process.env.TURN_USERNAME;
  const turnPass = process.env.TURN_CREDENTIAL;
  if (turnUrl && turnUser && turnPass) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnPass });
  } else {
    servers.push({
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    });
  }
  return servers;
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const accessToken = req.body?.accessToken || req.query?.accessToken;
  if (!accessToken) return res.status(401).json({ error: 'Log in met Discord' });

  try {
    const member = await verifyGuildMember(accessToken);
    const action = req.body?.action || req.query?.action;
    const roomId = req.body?.roomId || req.query?.roomId;
    if (!roomId) return res.status(400).json({ error: 'roomId ontbreekt' });

    if (action === 'config') {
      return res.status(200).json({ iceServers: iceServersFromEnv(), brand: 'URP Call' });
    }

    if (action === 'join' && req.method === 'POST') {
      if (!member.isStaff) assertSupportAccess(member);
      await updateRoom(roomId, (state) => {
        state.peers = state.peers || {};
        state.peers[member.discordId] = {
          id: member.discordId,
          name: member.username,
          avatarUrl: member.avatarUrl,
          discordUsername: member.discordUsername,
          isStaff: member.isStaff,
          joinedAt: state.peers[member.discordId]?.joinedAt || new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        };
      });
      return res.status(200).json({ ok: true, peerId: member.discordId });
    }

    if (action === 'leave' && req.method === 'POST') {
      await updateRoom(roomId, (state) => {
        if (state.peers) delete state.peers[member.discordId];
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'heartbeat' && req.method === 'POST') {
      await updateRoom(roomId, (state) => {
        if (state.peers?.[member.discordId]) {
          state.peers[member.discordId].lastSeen = new Date().toISOString();
        }
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'signal' && req.method === 'POST') {
      const { to, type, data } = req.body || {};
      if (!to || !type) return res.status(400).json({ error: 'to/type ontbreekt' });
      const sigId = 's-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      await updateRoom(roomId, (state) => {
        state.signals = state.signals || [];
        state.signals.push({
          id: sigId,
          from: member.discordId,
          to,
          type,
          data,
          at: new Date().toISOString(),
        });
        if (state.peers?.[member.discordId]) {
          state.peers[member.discordId].lastSeen = new Date().toISOString();
        }
      });
      return res.status(200).json({ ok: true, id: sigId });
    }

    if (action === 'poll') {
      const since = req.body?.since || req.query?.since || '';
      const state = pruneRoom(await loadRoom(roomId));
      const roster = Object.values(state.peers || {}).filter((p) => p.id !== member.discordId);
      const signals = (state.signals || []).filter(
        (s) => s.to === member.discordId && (!since || s.id > since)
      );
      if (state.peers?.[member.discordId]) {
        await updateRoom(roomId, (st) => {
          if (st.peers?.[member.discordId]) {
            st.peers[member.discordId].lastSeen = new Date().toISOString();
          }
        });
      }
      return res.status(200).json({ roster, signals, peerId: member.discordId });
    }

    return res.status(400).json({ error: 'Onbekende actie' });
  } catch (err) {
    console.error('rtc-room:', err);
    return res.status(403).json({ error: err.message || 'URP Call mislukt' });
  }
};
