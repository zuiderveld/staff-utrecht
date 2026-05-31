const { verifyGuildMember } = require('../discord-staff');
const { readChannelsConfig } = require('../support-queue');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/** Supportkanalen (geen wachtkamer/wachtrij meer) */
module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = req.body?.action || req.query?.action || 'config';
    if (action !== 'config') {
      return res.status(400).json({ error: 'Wachtkamer is verwijderd. Alleen supportkanalen (config) zijn beschikbaar.' });
    }

    const accessToken = req.body?.accessToken || req.query?.accessToken;
    if (!accessToken) return res.status(401).json({ error: 'Log in met Discord' });

    const member = await verifyGuildMember(accessToken);
    const cfg = readChannelsConfig();
    const channels = member.canUseSupport
      ? (cfg.channels || []).filter((c) => !c.staffOnly || member.isStaff)
      : member.isStaff
        ? (cfg.channels || []).filter((c) => c.staffOnly)
        : [];

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
