const { verifyGuildMember } = require('../discord-staff');
const { readChannelsConfig } = require('../support-queue');
const { listPeersInRoom } = require('../rtc-peers');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function channelsForMember(member, cfg) {
  const all = cfg.channels || [];
  if (member.canUseSupport) {
    return all.filter((c) => !c.staffOnly || member.isStaff);
  }
  if (member.isStaff) return all.filter((c) => c.staffOnly);
  return [];
}

function roomIdForChannel(ch) {
  return ch.callRoom || ch.jitsiRoom || ch.id;
}

async function buildPresence(channels) {
  const presence = {};
  for (const ch of channels) {
    const all = await listPeersInRoom(roomIdForChannel(ch));
    presence[ch.id] = all.map((p) => ({
      id: String(p.id),
      name: p.name || 'Onbekend',
      avatarUrl: p.avatarUrl || null,
      isStaff: !!p.isStaff,
    }));
  }
  return presence;
}

/** Supportkanalen + wie er in elke call zit */
module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = req.body?.action || req.query?.action || 'config';
    if (action !== 'config' && action !== 'presence') {
      return res.status(400).json({ error: 'Onbekende actie. Gebruik config of presence.' });
    }

    const accessToken = req.body?.accessToken || req.query?.accessToken;
    if (!accessToken) return res.status(401).json({ error: 'Log in met Discord' });

    const member = await verifyGuildMember(accessToken);
    const cfg = readChannelsConfig();
    const channels = channelsForMember(member, cfg);

    if (action === 'presence') {
      const presence = await buildPresence(channels);
      return res.status(200).json({ presence, updatedAt: new Date().toISOString() });
    }

    return res.status(200).json({
      channels,
      isStaff: member.isStaff,
      isModerator: member.isStaff,
      isBurger: member.isBurger,
      canUseSupport: member.canUseSupport,
      callBrand: 'URP Call',
      user: {
        username: member.username,
        discordId: member.discordId,
        avatarUrl: member.avatarUrl,
        discordUsername: member.discordUsername,
      },
    });
  } catch (err) {
    console.error('support-queue:', err);
    return res.status(403).json({ error: err.message || 'Mislukt' });
  }
};
