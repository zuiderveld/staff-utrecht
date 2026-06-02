const SITE_API = window.location.origin;
const DISCORD_CLIENT_ID = '1105558581304098867';
const OVERHEID_URL = 'https://overheid.utrechtroleplay.eu/';

function discordRedirectUri() {
    return window.location.origin + '/';
}

function getDiscordAuthUrl() {
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: discordRedirectUri(),
        response_type: 'code',
        scope: 'identify guilds',
    });
    return 'https://discord.com/api/oauth2/authorize?' + params.toString();
}
