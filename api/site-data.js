const fs = require('fs');
const path = require('path');

const BLOB_PATHNAME = 'urp-staff-portaal-data.json';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readDefault() {
  try {
    const p = path.join(process.cwd(), 'data', 'site.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { regels: [], informatie: [], ranks: [], updatedAt: null };
  }
}

async function loadBlob() {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return null;
  try {
    const { head, list } = require('@vercel/blob');
    try {
      const meta = await head(BLOB_PATHNAME, { token: blobToken });
      if (meta?.url) {
        const res = await fetch(meta.url, { cache: 'no-store' });
        if (res.ok) return await res.json();
      }
    } catch {
      /* geen blob yet */
    }
    const { blobs } = await list({ prefix: BLOB_PATHNAME, token: blobToken });
    const match =
      blobs.find((b) => b.pathname === BLOB_PATHNAME) ||
      blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    if (!match?.url) return null;
    const res = await fetch(match.url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('blob load:', e);
    return null;
  }
}

async function saveBlob(data) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error('Vercel Blob vereist (BLOB_READ_WRITE_TOKEN) om op te slaan.');
  }
  const { put } = require('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(data), {
    access: 'public',
    token: blobToken,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}

async function getData() {
  const fromBlob = await loadBlob();
  return fromBlob || readDefault();
}

function normalize(input) {
  const base = readDefault();
  const ranks = (input.ranks || base.ranks || []).map((r, i) => ({
    id: (r.id || `rank-${i}`).toString().trim(),
    naam: (r.naam || 'Rank').trim(),
    kleur: r.kleur || '#8b5cf6',
    volgorde: Number(r.volgorde) || i + 1,
    leden: Array.isArray(r.leden)
      ? r.leden
          .map((l) => ({
            naam: (l.naam || '').trim(),
            discord: (l.discord || '').trim(),
          }))
          .filter((l) => l.naam)
      : [],
  }));

  return {
    regels: Array.isArray(input.regels) ? input.regels : base.regels,
    informatie: Array.isArray(input.informatie) ? input.informatie : base.informatie,
    ranks,
    updatedAt: new Date().toISOString(),
  };
}

async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(await getData());
  }

  if (req.method === 'POST') {
    try {
      const data = normalize(req.body?.site || {});
      await saveBlob(data);
      return res.status(200).json({ ok: true, site: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Alleen GET of POST' });
}

module.exports = handler;
module.exports.getData = getData;
