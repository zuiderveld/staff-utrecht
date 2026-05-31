const { verifyGuildMember, verifyAccessToken } = require('../discord-staff');
const {
  readChannelsConfig,
  getQueue,
  updateQueue,
  findChannel,
} = require('../support-queue');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = req.body?.action || req.query?.action || 'status';

    /** Openbaar — geen login, alleen wie in wachtkamer zit */
    if (action === 'public-queue') {
      const state = await getQueue();
      const waiting = (state.waiting || []).map(function (e, idx) {
        return {
          username: e.username,
          avatarUrl: e.avatarUrl,
          channelNaam: e.channelNaam,
          joinedAt: e.joinedAt,
          position: idx + 1,
        };
      });
      return res.status(200).json({
        open: true,
        count: waiting.length,
        waiting: waiting,
        updatedAt: state.updatedAt,
      });
    }

    const accessToken = req.body?.accessToken || req.query?.accessToken;
    if (!accessToken) return res.status(401).json({ error: 'Log in met Discord' });

    if (action === 'config') {
      const member = await verifyGuildMember(accessToken);
      const cfg = readChannelsConfig();
      const channels = (cfg.channels || []).filter((c) => !c.staffOnly || member.isStaff);
      return res.status(200).json({
        channels,
        waitingMusic: cfg.waitingMusic,
        isStaff: member.isStaff,
        isModerator: member.isStaff,
        callBrand: 'URP Call',
        user: {
          username: member.username,
          discordId: member.discordId,
          avatarUrl: member.avatarUrl,
          discordUsername: member.discordUsername,
        },
      });
    }

    if (action === 'list') {
      await verifyAccessToken(accessToken);
      const state = await getQueue();
      return res.status(200).json({
        waiting: state.waiting || [],
        admitted: state.admitted || [],
        updatedAt: state.updatedAt,
      });
    }

    if (req.method === 'POST' && action === 'join') {
      const member = await verifyGuildMember(accessToken);
      const channelId = req.body?.channelId;
      const channel = findChannel(channelId);
      if (!channel) return res.status(400).json({ error: 'Onbekend supportkanaal' });
      if (channel.staffOnly && !member.isStaff) {
        return res.status(403).json({ error: 'Dit kanaal is alleen voor staff/moderators' });
      }
      if (!channel.wachtkamer) {
        return res.status(400).json({ error: 'Dit kanaal heeft geen wachtkamer' });
      }

      await updateQueue((state) => {
        state.waiting = (state.waiting || []).filter((e) => e.discordId !== member.discordId);
        state.waiting.push({
          id: 'w-' + member.discordId + '-' + Date.now(),
          discordId: member.discordId,
          username: member.username,
          discordUsername: member.discordUsername,
          avatarUrl: member.avatarUrl,
          channelId: channel.id,
          channelNaam: channel.naam,
          joinedAt: new Date().toISOString(),
          status: 'waiting',
        });
      });

      const state = await getQueue();
      const me = (state.waiting || []).find((e) => e.discordId === member.discordId);
      const position =
        (state.waiting || []).filter((e) => e.channelId === channelId).findIndex((e) => e.discordId === member.discordId) + 1;

      return res.status(200).json({ ok: true, entry: me, position, channel });
    }

    if (action === 'kick' && req.method === 'POST') {
      await verifyAccessToken(accessToken);
      const targetId = req.body?.discordId;
      if (!targetId) return res.status(400).json({ error: 'discordId ontbreekt' });
      await updateQueue((state) => {
        state.waiting = (state.waiting || []).filter((e) => e.discordId !== targetId);
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE' || action === 'leave') {
      const member = await verifyGuildMember(accessToken);
      await updateQueue((state) => {
        state.waiting = (state.waiting || []).filter((e) => e.discordId !== member.discordId);
        state.admitted = (state.admitted || []).filter((e) => e.discordId !== member.discordId);
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'status') {
      const member = await verifyGuildMember(accessToken);
      const state = await getQueue();
      const admitted = (state.admitted || []).find((e) => e.discordId === member.discordId);
      if (admitted) {
        const channel = findChannel(admitted.channelId);
        return res.status(200).json({
          status: 'admitted',
          channel,
          callRoom: channel?.callRoom || channel?.jitsiRoom,
          admittedAt: admitted.admittedAt,
        });
      }
      const waiting = (state.waiting || []).find((e) => e.discordId === member.discordId);
      if (waiting) {
        const position =
          (state.waiting || [])
            .filter((e) => e.channelId === waiting.channelId)
            .findIndex((e) => e.discordId === member.discordId) + 1;
        return res.status(200).json({ status: 'waiting', entry: waiting, position });
      }
      return res.status(200).json({ status: 'idle' });
    }

    return res.status(400).json({ error: 'Onbekende actie' });
  } catch (err) {
    console.error('support-queue:', err);
    return res.status(403).json({ error: err.message || 'Mislukt' });
  }
};
