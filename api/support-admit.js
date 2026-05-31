const { verifyAccessToken } = require('./lib/discord-staff');
const { getQueue, updateQueue, findChannel } = require('./lib/support-queue');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST' });

  try {
    const accessToken = req.body?.accessToken;
    const targetDiscordId = req.body?.discordId;
    if (!accessToken) return res.status(401).json({ error: 'Log in met Discord' });
    if (!targetDiscordId) return res.status(400).json({ error: 'discordId ontbreekt' });

    const staff = await verifyAccessToken(accessToken);
    if (!staff.isStaff) {
      return res.status(403).json({ error: 'Alleen staff/moderators kunnen binnenhalen' });
    }

    let admittedEntry = null;

    await updateQueue((state) => {
      const idx = (state.waiting || []).findIndex((e) => e.discordId === targetDiscordId);
      if (idx === -1) throw new Error('Persoon staat niet meer in de wachtkamer');
      const [entry] = state.waiting.splice(idx, 1);
      entry.status = 'admitted';
      entry.admittedAt = new Date().toISOString();
      entry.admittedBy = staff.username;
      state.admitted = state.admitted || [];
      state.admitted = state.admitted.filter((e) => e.discordId !== targetDiscordId);
      state.admitted.push(entry);
      admittedEntry = entry;
    });

    const channel = findChannel(admittedEntry.channelId);

    return res.status(200).json({
      ok: true,
      entry: admittedEntry,
      channel,
      callRoom: channel?.callRoom || channel?.jitsiRoom,
    });
  } catch (err) {
    console.error('support-admit:', err);
    return res.status(400).json({ error: err.message || 'Binnenhalen mislukt' });
  }
};
