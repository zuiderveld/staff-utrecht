const rolesFile = require('./discord-roles');

function getRoleId(rank) {
  const key = `DISCORD_STAFF_ROLE_${rank.id.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] || rank.discordRoleId || null;
}

function getBeheerRoleIds() {
  const fromEnv = process.env.DISCORD_STAFF_BEHEER_ROLES;
  if (fromEnv) return fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
  return rolesFile.beheerRoleIds || [];
}

function getDossierViewRoleIds() {
  const fromEnv = process.env.DISCORD_DOSSIER_VIEW_ROLES;
  if (fromEnv) return fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
  return rolesFile.dossierViewRoleIds || [];
}

function getOnderwereldRoleId() {
  return process.env.DISCORD_ROLE_ONDERWERELD || rolesFile.onderwereldCoordinatorRoleId || null;
}

function isOnderwereldCoordinator(userRoles) {
  const id = getOnderwereldRoleId();
  return !!(id && userRoles.includes(id));
}

function canViewDossiers(userRoles) {
  const ids = getDossierViewRoleIds();
  return ids.some((id) => userRoles.includes(id));
}

function getRanks() {
  return (rolesFile.ranks || []).map((r) => ({
    ...r,
    discordRoleId: getRoleId(r),
  }));
}

async function exchangeCode(code, redirectUri) {
  const clientId = process.env.DISCORD_CLIENT_ID || rolesFile.clientId;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error('DISCORD_CLIENT_SECRET ontbreekt in Vercel Environment Variables.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Discord code exchange mislukt');
  }
  return data.access_token;
}

async function getGuildMember(userId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error('DISCORD_BOT_TOKEN en DISCORD_GUILD_ID zijn verplicht in Vercel.');
  }

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!res.ok) {
    throw new Error('Je zit niet op de URP Discord server, of de bot mist rechten (Server Members Intent).');
  }
  return res.json();
}

function resolveAccess(userRoles) {
  const ranks = [...getRanks()].sort((a, b) => a.volgorde - b.volgorde);
  const beheerIds = getBeheerRoleIds();

  let rank = null;
  for (const r of ranks) {
    if (r.discordRoleId && userRoles.includes(r.discordRoleId)) {
      rank = { rankId: r.id, rankNaam: r.naam };
      break;
    }
  }

  const isBeheer = beheerIds.some((id) => userRoles.includes(id));
  const dossiers = canViewDossiers(userRoles);
  const onderwereld = isOnderwereldCoordinator(userRoles);

  return { rank, isBeheer, canViewDossiers: dossiers, isOnderwereldCoordinator: onderwereld };
}

function avatarUrlFromUser(user) {
  if (!user?.id) return null;
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }
  const disc = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${disc}.png`;
}

async function verifyGuildMember(accessToken) {
  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) throw new Error('Discord sessie verlopen. Log opnieuw in.');
  const user = await userRes.json();

  const member = await getGuildMember(user.id);
  const userRoles = member.roles || [];
  const displayName = member.nick || user.global_name || user.username;
  const { rank, isBeheer, canViewDossiers: mayViewDossiers, isOnderwereldCoordinator: onderwereld } =
    resolveAccess(userRoles);
  const isStaff = !!(rank || isBeheer);

  return {
    username: displayName,
    discordUsername: user.username,
    discordId: user.id,
    avatarUrl: avatarUrlFromUser(user),
    accessToken,
    isStaff,
    isBeheer,
    isModerator: isStaff,
    isOnderwereldCoordinator: onderwereld,
    rankId: rank?.rankId || null,
    rankNaam: rank?.rankNaam || (isBeheer ? 'Beheer' : onderwereld ? 'Onderwereld Coordinator' : null),
    canViewDossiers: !!mayViewDossiers,
  };
}

async function verifyDossiersAccess(accessToken) {
  const info = await verifyAccessToken(accessToken);
  if (!info.canViewDossiers) {
    throw new Error(
      'Geen toegang tot staff dossiers. Alleen Lead Coördinator, Beheer Team en Founder.'
    );
  }
  return info;
}

async function verifyAccessToken(accessToken) {
  const info = await verifyGuildMember(accessToken);
  if (!info.isStaff) {
    throw new Error('Geen staff Discord-rol gevonden op deze server.');
  }
  return info;
}

async function verifyOnderwereldAccess(accessToken) {
  const info = await verifyGuildMember(accessToken);
  if (!info.isOnderwereldCoordinator) {
    throw new Error('Geen toegang. Alleen Onderwereld Coordinator heeft toegang tot dit onderdeel.');
  }
  return info;
}

async function fetchAllGuildMembers() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error('DISCORD_BOT_TOKEN en DISCORD_GUILD_ID zijn verplicht in Vercel.');
  }

  const all = [];
  let after = '0';

  while (true) {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`;
    const res = await fetch(url, { headers: { Authorization: `Bot ${token}` } });
    if (!res.ok) {
      throw new Error(
        'Kon serverleden niet ophalen. Bot op de server? Server Members Intent aan?'
      );
    }
    const chunk = await res.json();
    if (!chunk.length) break;
    all.push(...chunk);
    after = chunk[chunk.length - 1].user.id;
    if (chunk.length < 1000) break;
  }

  return all;
}

function buildStaffTeam(members) {
  const ranks = [...getRanks()].sort((a, b) => a.volgorde - b.volgorde);
  const buckets = ranks.map((r) => ({
    id: r.id,
    naam: r.naam,
    kleur: r.kleur,
    volgorde: r.volgorde,
    leden: [],
  }));

  for (const m of members) {
    const roles = m.roles || [];
    let assigned = null;
    for (const r of ranks) {
      if (r.discordRoleId && roles.includes(r.discordRoleId)) {
        assigned = r;
        break;
      }
    }
    if (!assigned) continue;

    const bucket = buckets.find((b) => b.id === assigned.id);
    const user = m.user || {};
    const display = (m.nick || user.global_name || user.username || 'Onbekend').trim();
    const username = user.username ? `@${user.username}` : '';
    let avatarUrl = null;
    if (user.id && user.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
    } else if (user.id) {
      const disc = (BigInt(user.id) >> 22n) % 6n;
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${disc}.png`;
    }

    bucket.leden.push({
      naam: display,
      discord: username,
      avatarUrl,
    });
  }

  for (const b of buckets) {
    b.leden.sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  }

  return {
    ranks: buckets,
    updatedAt: new Date().toISOString(),
    source: 'discord',
  };
}

let teamCache = { at: 0, data: null };
const TEAM_CACHE_MS = 45_000;

async function getStaffTeamLive() {
  if (teamCache.data && Date.now() - teamCache.at < TEAM_CACHE_MS) {
    return { ...teamCache.data, cached: true };
  }
  const members = await fetchAllGuildMembers();
  const data = buildStaffTeam(members);
  teamCache = { at: Date.now(), data };
  return { ...data, cached: false };
}

let guildRolesCache = { at: 0, map: null };
const GUILD_ROLES_CACHE_MS = 5 * 60_000;

function discordColorHex(color) {
  if (!color) return null;
  return '#' + color.toString(16).padStart(6, '0');
}

async function getGuildRolesMap() {
  if (guildRolesCache.map && Date.now() - guildRolesCache.at < GUILD_ROLES_CACHE_MS) {
    return guildRolesCache.map;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error('DISCORD_BOT_TOKEN en DISCORD_GUILD_ID zijn verplicht in Vercel.');
  }

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!res.ok) {
    throw new Error('Kon Discord-rollen niet ophalen. Staat de bot op de server?');
  }

  const roles = await res.json();
  const map = {};
  for (const r of roles) {
    map[r.id] = {
      name: r.name,
      color: discordColorHex(r.color),
    };
  }

  guildRolesCache = { at: Date.now(), map };
  return map;
}

module.exports = {
  exchangeCode,
  verifyAccessToken,
  verifyOnderwereldAccess,
  verifyDossiersAccess,
  verifyGuildMember,
  getBeheerRoleIds,
  getDossierViewRoleIds,
  canViewDossiers,
  getStaffTeamLive,
  getGuildRolesMap,
};
