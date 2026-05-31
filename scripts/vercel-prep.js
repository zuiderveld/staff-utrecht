/**
 * Vercel build: max 1 serverless function (Hobby-plan).
 * Verwijdert per ongeluk geüploade api/*.js behalve router.js en api/lib/.
 */
const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'api');
const serverLib = path.join(__dirname, '..', 'server', 'lib');

if (!fs.existsSync(apiDir)) {
  console.log('vercel-prep: geen api/ map');
  process.exit(0);
}

let removed = 0;
for (const name of fs.readdirSync(apiDir)) {
  const full = path.join(apiDir, name);
  if (name === 'router.js') continue;
  if (fs.statSync(full).isDirectory()) {
    fs.rmSync(full, { recursive: true, force: true });
    removed++;
    console.log('vercel-prep: verwijderd map', name);
    continue;
  }
  if (name.endsWith('.js')) {
    fs.unlinkSync(full);
    removed++;
    console.log('vercel-prep: verwijderd', name);
  }
}

if (!fs.existsSync(serverLib)) {
  console.error('vercel-prep: FOUT — server/lib ontbreekt. Upload de volledige staff-portaal map.');
  process.exit(1);
}

console.log('vercel-prep: klaar. Alleen api/router.js blijft over.', removed ? `(${removed} weg)` : '');
