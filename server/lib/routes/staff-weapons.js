const { verifyWeaponsAccess } = require('../discord-staff');

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
    if (!accessToken) return res.status(400).json({ error: 'Geen access token' });
    const info = await verifyWeaponsAccess(accessToken);
    return res.status(200).json({
      ok: true,
      username: info.username,
      canViewWeapons: true,
    });
  } catch (err) {
    console.error('staff-weapons:', err);
    return res.status(403).json({ error: err.message || 'Geen toegang' });
  }
};
