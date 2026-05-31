const { verifyGuildMember, assertSupportAccess } = require('../discord-staff');
const { loadRoom, updateRoom } = require('../rtc-room');
const { upsertPeer, removePeer, listPeersInRoom, peerFromMember } = require('../rtc-peers');

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

function rosterForMember(roomId, member) {
  const pid = String(member.discordId);
  return listPeersInRoom(roomId).then((all) =>
    all.filter((p) => p.id !== pid).map((p) => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      isStaff: p.isStaff,
    }))
  );
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

    if (action === 'peers') {
      await upsertPeer(roomId, peerFromMember(member));
      const all = await listPeersInRoom(roomId);
      return res.status(200).json({
        peers: all.map((p) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          isStaff: p.isStaff,
        })),
      });
    }

    if (action === 'join' && req.method === 'POST') {
      if (!member.isStaff) assertSupportAccess(member);
      const bodyPeer = req.body?.peer;
      await upsertPeer(roomId, {
        ...peerFromMember(member),
        name: bodyPeer?.name || member.username,
        avatarUrl: bodyPeer?.avatarUrl || member.avatarUrl,
        isStaff: bodyPeer?.isStaff ?? member.isStaff,
      });
      const roster = await rosterForMember(roomId, member);
      return res.status(200).json({ ok: true, peerId: member.discordId, roster });
    }

    if (action === 'leave' && req.method === 'POST') {
      await removePeer(roomId, member.discordId);
      return res.status(200).json({ ok: true });
    }

    if (action === 'heartbeat' && req.method === 'POST') {
      await upsertPeer(roomId, peerFromMember(member));
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
      });
      await upsertPeer(roomId, peerFromMember(member));
      return res.status(200).json({ ok: true, id: sigId });
    }

    if (action === 'poll') {
      const since = req.body?.since || req.query?.since || '';
      await upsertPeer(roomId, peerFromMember(member));
      const roster = await rosterForMember(roomId, member);
      const state = await loadRoom(roomId);
      const signals = (state.signals || []).filter(
        (s) => s.to === member.discordId && (!since || s.id > since)
      );
      return res.status(200).json({ roster, signals, peerId: member.discordId });
    }

    return res.status(400).json({ error: 'Onbekende actie' });
  } catch (err) {
    console.error('rtc-room:', err);
    return res.status(403).json({ error: err.message || 'URP Call mislukt' });
  }
};
