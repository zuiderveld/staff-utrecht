const { verifyAccessToken, getGuildRolesMap } = require('../discord-staff');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'private, max-age=60');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST' });

  try {
    const accessToken = req.body?.accessToken;
    if (!accessToken) return res.status(401).json({ error: 'Log opnieuw in met Discord' });
    await verifyAccessToken(accessToken);
    const roles = await getGuildRolesMap();
    return res.status(200).json({ roles });
  } catch (err) {
    console.error('discord-role-names:', err);
    return res.status(403).json({ error: err.message || 'Rollen laden mislukt' });
  }
};
