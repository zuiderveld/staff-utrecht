/**
 * Eén Vercel Serverless Function voor alle /api/* routes (Hobby-plan limiet).
 * Routes via vercel.json rewrites → ?route=naam
 */
const routes = {
  'staff-auth': require('./lib/routes/staff-auth'),
  'discord-auth': require('./lib/routes/discord-auth'),
  'site-data': require('./lib/routes/site-data'),
  'staff-team': require('./lib/routes/staff-team'),
  'discord-role-names': require('./lib/routes/discord-role-names'),
  'support-queue': require('./lib/routes/support-queue'),
  'support-admit': require('./lib/routes/support-admit'),
  'rtc-room': require('./lib/routes/rtc-room'),
};

module.exports = async function handler(req, res) {
  const route = req.query.route;
  if (!route || !routes[route]) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({
      error: 'API route niet gevonden',
      hint: 'Gebruik /api/staff-auth enz. na redeploy met router.',
      route: route || null,
    });
  }
  return routes[route](req, res);
};
