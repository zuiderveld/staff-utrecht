const { exchangeCode, verifyAccessToken } = require('../discord-staff');

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
    let accessToken = req.body?.accessToken;

    if (req.body?.code) {
      const redirectUri = req.body.redirectUri;
      if (!redirectUri) return res.status(400).json({ error: 'redirectUri ontbreekt' });
      accessToken = await exchangeCode(req.body.code, redirectUri);
    }

    if (!accessToken) return res.status(400).json({ error: 'Geen Discord code of token' });

    const result = await verifyAccessToken(accessToken);
    return res.status(200).json(result);
  } catch (err) {
    console.error('staff-auth:', err);
    return res.status(403).json({ error: err.message || 'Inloggen mislukt' });
  }
};
