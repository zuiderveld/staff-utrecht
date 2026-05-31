const fs = require('fs');
const path = require('path');
const checkBeheer = require('../beheer-check');
const { verifyAccessToken } = require('../discord-staff');

const BLOB_PATHNAME = 'urp-staff-dossiers.json';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readDefault() {
  try {
    const p = path.join(process.cwd(), 'data', 'dossiers.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { personen: [], updatedAt: null };
  }
}

async function loadBlob() {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return null;
  try {
    const { head } = require('@vercel/blob');
    const meta = await head(BLOB_PATHNAME, { token: blobToken });
    if (meta?.url) {
      const res = await fetch(meta.url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch {
    /* geen blob */
  }
  return null;
}

async function saveBlob(data) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error('Vercel Blob vereist (BLOB_READ_WRITE_TOKEN) om dossiers op te slaan.');
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

const ENTRY_TYPES = new Set(['warn', 'ontslag', 'notitie', 'bericht']);

function normalizeEntry(raw) {
  const type = ENTRY_TYPES.has(raw.type) ? raw.type : 'notitie';
  return {
    id: (raw.id || `e-${Date.now()}`).toString().trim(),
    type,
    datum: (raw.datum || '').toString().slice(0, 10),
    titel: (raw.titel || '').toString().trim().slice(0, 200),
    inhoud: (raw.inhoud || '').toString().trim().slice(0, 4000),
    door: (raw.door || '').toString().trim().slice(0, 120),
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function normalizePerson(raw) {
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(normalizeEntry).filter((e) => e.inhoud || e.titel)
    : [];
  entries.sort((a, b) => {
    const da = a.datum || a.createdAt || '';
    const db = b.datum || b.createdAt || '';
    return db.localeCompare(da);
  });
  return {
    id: (raw.id || `p-${Date.now()}`).toString().trim(),
    naam: (raw.naam || '').toString().trim().slice(0, 120),
    discord: (raw.discord || '').toString().trim().slice(0, 80),
    discordId: (raw.discordId || '').toString().trim().slice(0, 32),
    entries,
  };
}

function normalize(input) {
  const personen = Array.isArray(input.personen)
    ? input.personen.map(normalizePerson).filter((p) => p.naam)
    : [];
  personen.sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  return {
    personen,
    updatedAt: new Date().toISOString(),
  };
}

async function getData() {
  const fromBlob = await loadBlob();
  return fromBlob || readDefault();
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST' });

  const accessToken = req.body?.accessToken;
  if (!accessToken) return res.status(401).json({ error: 'Log opnieuw in met Discord' });

  if (req.body?.dossiers) {
    const beheer = await checkBeheer(accessToken);
    if (!beheer.ok) return res.status(403).json({ error: beheer.error });
    try {
      const data = normalize(req.body.dossiers);
      await saveBlob(data);
      return res.status(200).json({ ok: true, dossiers: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    await verifyAccessToken(accessToken);
    const data = await getData();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(403).json({ error: err.message || 'Geen toegang' });
  }
};

module.exports.getData = getData;
