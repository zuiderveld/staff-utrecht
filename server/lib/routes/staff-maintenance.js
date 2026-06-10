const fs = require('fs');
const path = require('path');
const checkBeheer = require('../beheer-check');

const DEFAULT_STATE = {
  global: false,
  onderwereld: false,
  message: 'Het staff portaal is momenteel in onderhoud. Probeer het later opnieuw.',
  onderwereldMessage:
    'De onderwereld store (gangshop prijzen) is tijdelijk gesloten voor onderhoud. Probeer het later opnieuw.',
  updatedAt: null,
};

const BLOB_PATHNAME = 'urp-staff-maintenance-state.json';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readDefaultFile() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'maintenance.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function loadFromBlob() {
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

async function saveToBlob(state) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error('Vercel Blob vereist (BLOB_READ_WRITE_TOKEN) om onderhoud op te slaan.');
  }
  const { put } = require('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(state), {
    access: 'public',
    token: blobToken,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}

async function getMaintenanceState() {
  if (process.env.MAINTENANCE_FORCE_OFF === 'true') {
    return { ...readDefaultFile(), global: false, _storage: 'force-off' };
  }
  const fromBlob = await loadFromBlob();
  if (fromBlob) return { ...fromBlob, _storage: 'blob' };
  const base = { ...readDefaultFile() };
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  return {
    ...base,
    _storage: hasBlobToken ? 'blob-empty' : 'default',
    _blobConfigured: hasBlobToken,
  };
}

function normalizeState(input) {
  const base = readDefaultFile();
  return {
    global: !!input.global,
    onderwereld: !!input.onderwereld,
    message: (input.message || base.message || DEFAULT_STATE.message).trim(),
    onderwereldMessage: (
      input.onderwereldMessage ||
      base.onderwereldMessage ||
      DEFAULT_STATE.onderwereldMessage
    ).trim(),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const state = await getMaintenanceState();
    return res.status(200).json(state);
  }

  if (req.method === 'POST') {
    const beheer = await checkBeheer(req.body?.accessToken);
    if (!beheer.ok) return res.status(403).json({ error: beheer.error });
    try {
      const state = normalizeState(req.body?.maintenance || {});
      await saveToBlob(state);
      return res.status(200).json({ ok: true, maintenance: { ...state, _storage: 'blob' } });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Opslaan mislukt' });
    }
  }

  return res.status(405).json({ error: 'Alleen GET of POST' });
};

module.exports.getMaintenanceState = getMaintenanceState;
