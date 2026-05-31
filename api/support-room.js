const { verifyAccessToken } = require('./lib/discord-staff');

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
    if (!accessToken) return res.status(401).json({ error: 'Log opnieuw in met Discord' });

    const user = await verifyAccessToken(accessToken);
    const room = process.env.JITSI_ROOM_NAME || 'URP-Staff-Support';
    const password = process.env.JITSI_ROOM_PASSWORD || '';
    const discordVoiceUrl = process.env.DISCORD_SUPPORT_VOICE_URL || '';

    return res.status(200).json({
      jitsiServer: process.env.JITSI_SERVER || 'meet.jit.si',
      room,
      password: password || null,
      displayName: user.username,
      discordVoiceUrl: discordVoiceUrl || null,
    });
  } catch (err) {
    console.error('support-room:', err);
    return res.status(403).json({ error: err.message || 'Geen toegang tot support' });
  }
};
