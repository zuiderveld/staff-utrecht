/**
 * Enige Serverless Function voor alle /api/* routes (Vercel Hobby: max 12).
 * Handlers staan in /server/lib (buiten /api → telt niet mee).
 */
const routes = {
  'staff-auth': require('../server/lib/routes/staff-auth'),
  'discord-auth': require('../server/lib/routes/discord-auth'),
  'site-data': require('../server/lib/routes/site-data'),
  'staff-team': require('../server/lib/routes/staff-team'),
  'discord-role-names': require('../server/lib/routes/discord-role-names'),
  'support-queue': require('../server/lib/routes/support-queue'),
  'support-admit': require('../server/lib/routes/support-admit'),
  'rtc-room': require('../server/lib/routes/rtc-room'),
};

module.exports = async function handler(req, res) {
  const route = req.query.route;
  if (!route || !routes[route]) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({
      error: 'API route niet gevonden',
      route: route || null,
    });
  }
  return routes[route](req, res);
};
