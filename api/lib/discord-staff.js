const rolesFile = require('../discord-roles');

function getRoleId(rank) {
  const key = `DISCORD_STAFF_ROLE_${rank.id.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] || rank.discordRoleId || null;
}

function getBeheerRoleIds() {
  const fromEnv = process.env.DISCORD_STAFF_BEHEER_ROLES;
  if (fromEnv) return fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
  return rolesFile.beheerRoleIds || [];
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

  return { rank, isBeheer };
}

async function verifyAccessToken(accessToken) {
  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) throw new Error('Discord sessie verlopen. Log opnieuw in.');
  const user = await userRes.json();

  const member = await getGuildMember(user.id);
  const userRoles = member.roles || [];
  const username = member.nick || user.global_name || user.username;
  const { rank, isBeheer } = resolveAccess(userRoles);

  if (!rank && !isBeheer) {
    throw new Error('Geen staff Discord-rol gevonden op deze server.');
  }

  return {
    username,
    accessToken,
    isBeheer,
    rankId: rank?.rankId || null,
    rankNaam: rank?.rankNaam || (isBeheer ? 'Beheer' : null),
  };
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

module.exports = {
  exchangeCode,
  verifyAccessToken,
  getBeheerRoleIds,
  getStaffTeamLive,
};
