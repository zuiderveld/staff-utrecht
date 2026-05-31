/* Support: kanalen + handmatig URP Call verbinden */

function getCallRoomId(channel) {
    return channel?.callRoom || channel?.jitsiRoom || channel?.id || 'URP-Support';
}

let supportConfig = null;
let connectedChannelId = null;

function applySupportAccessUI() {
    const noBurger = document.getElementById('supportNoBurger');
    const guestArea = document.getElementById('guestArea');
    const allowed = isStaff() || canUseSupport();
    if (noBurger) noBurger.hidden = allowed;
    if (guestArea) guestArea.hidden = !allowed;
}

async function initSupportPage() {
    const params = new URLSearchParams(location.search);
    const loginBox = document.getElementById('supportLogin');
    const mainBox = document.getElementById('supportMain');
    const errEl = document.getElementById('supportLoginError');

    async function showMain() {
        loginBox.hidden = true;
        mainBox.hidden = false;
        if (isStaff()) mountHeader('support');
        else document.getElementById('supportGuestBar').hidden = false;
        document.getElementById('guestDisplayName').textContent = userName();
        const gav = document.getElementById('guestAvatar');
        if (avatarUrl()) gav.src = avatarUrl();
        else gav.style.display = 'none';
        await refreshSupportUI();
        applySupportAccessUI();
    }

    if (params.get('code')) {
        try {
            await discordMemberAuthWithCode(params.get('code'), supportRedirectUri());
            history.replaceState(null, '', '/support.html');
            await showMain();
        } catch (e) {
            errEl.textContent = e.message;
            errEl.classList.add('show');
        }
        return;
    }

    if (!isLoggedIn()) {
        loginBox.hidden = false;
        mainBox.hidden = true;
        document.getElementById('btnSupportDiscord').onclick = function () {
            window.location.href = getDiscordAuthUrlForSupport();
        };
        return;
    }

    await showMain();
}

function getDiscordAuthUrlForSupport() {
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: supportRedirectUri(),
        response_type: 'code',
        scope: 'identify guilds',
    });
    return 'https://discord.com/api/oauth2/authorize?' + params.toString();
}

async function refreshSupportUI() {
    const cfg = await fetch(
        SITE_API + '/api/support-queue?action=config&accessToken=' + encodeURIComponent(accessToken())
    );
    supportConfig = await cfg.json();
    if (!cfg.ok) throw new Error(supportConfig.error || 'Config laden mislukt');

    if (typeof supportConfig.canUseSupport === 'boolean') {
        sessionStorage.setItem('urpStaffCanSupport', supportConfig.canUseSupport ? 'true' : 'false');
    }
    if (typeof supportConfig.isBurger === 'boolean') {
        sessionStorage.setItem('urpStaffIsBurger', supportConfig.isBurger ? 'true' : 'false');
    }
    applySupportAccessUI();

    if (!supportConfig.canUseSupport && !supportConfig.isStaff) {
        return;
    }

    renderChannelPicker(supportConfig.channels || []);
}

function renderChannelPicker(channels) {
    const el = document.getElementById('channelPicker');
    const callPanel = document.getElementById('callPanel');
    const pickerHint = document.getElementById('guestPickHint');

    if (!channels.length) {
        el.innerHTML = '<p class="staff-empty">Geen supportkanalen beschikbaar voor jouw rol.</p>';
        if (callPanel) callPanel.hidden = true;
        return;
    }

    el.innerHTML = channels
        .map(function (ch) {
            const isConnected = connectedChannelId === ch.id;
            return (
                '<div class="support-channel-card" data-channel="' +
                escapeHtml(ch.id) +
                '">' +
                '<div class="support-channel-card-body">' +
                '<strong>' +
                escapeHtml(ch.naam) +
                '</strong>' +
                '<span>' +
                escapeHtml(ch.beschrijving || '') +
                '</span></div>' +
                '<button type="button" class="staff-btn staff-btn-primary btn-connect-channel"' +
                (isConnected ? ' disabled' : '') +
                ' data-channel="' +
                escapeHtml(ch.id) +
                '">' +
                '<i class="fas fa-phone"></i> ' +
                (isConnected ? 'Verbonden' : 'Verbinden') +
                '</button></div>'
            );
        })
        .join('');

    el.querySelectorAll('.btn-connect-channel').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const id = btn.dataset.channel;
            const ch = (supportConfig.channels || []).find(function (c) {
                return c.id === id;
            });
            if (ch) connectToChannel(ch);
        });
    });

    if (pickerHint) pickerHint.hidden = !!connectedChannelId;
    if (callPanel) callPanel.hidden = !connectedChannelId;
}

function connectToChannel(channel) {
    if (!channel) return;
    connectedChannelId = channel.id;
    const nameEl = document.getElementById('connectedChannelName');
    if (nameEl) nameEl.textContent = channel.naam || channel.id;
    document.getElementById('callPanel').hidden = false;
    document.getElementById('guestPickHint').hidden = true;
    renderChannelPicker(supportConfig.channels || []);
    startURPCall('urpCallGuest', getCallRoomId(channel));
}

function disconnectFromChannel() {
    connectedChannelId = null;
    stopURPCall('urpCallGuest');
    const callPanel = document.getElementById('callPanel');
    if (callPanel) callPanel.hidden = true;
    const hint = document.getElementById('guestPickHint');
    if (hint) hint.hidden = false;
    renderChannelPicker(supportConfig?.channels || []);
}

document.addEventListener('DOMContentLoaded', function () {
    initSupportPage();
    const btnDisconnect = document.getElementById('btnDisconnect');
    if (btnDisconnect) btnDisconnect.addEventListener('click', disconnectFromChannel);
    const link = document.getElementById('linkStaffPortal');
    if (link) link.hidden = !isStaff();
});
