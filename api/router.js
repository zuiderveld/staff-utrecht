/**
 * Enige Serverless Function voor alle /api/* routes (Vercel Hobby: max 12).
 * Handlers staan in /server/lib (buiten /api → telt niet mee).
 */
const routes = {
  'staff-auth': require('../server/lib/routes/staff-auth'),
  'site-data': require('../server/lib/routes/site-data'),
  'staff-team': require('../server/lib/routes/staff-team'),
  'discord-role-names': require('../server/lib/routes/discord-role-names'),
  'staff-dossiers': require('../server/lib/routes/staff-dossiers'),
  'staff-weapons': require('../server/lib/routes/staff-weapons'),
  'staff-maintenance': require('../server/lib/routes/staff-maintenance'),
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
