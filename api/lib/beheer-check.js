const { verifyAccessToken } = require('./discord-staff');

module.exports = async function checkBeheer(accessToken) {
  if (!accessToken) return { ok: false, error: 'Log opnieuw in met Discord' };
  try {
    const r = await verifyAccessToken(accessToken);
    if (!r.isBeheer) return { ok: false, error: 'Geen beheer-rechten (Founder / Co-Founder / Beheer / Bestuur Team)' };
    return { ok: true, username: r.username };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
