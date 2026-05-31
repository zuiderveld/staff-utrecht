/* Support: wachtkamer + URP Call (custom WebRTC) */

function getCallRoomId(channel) {
    return channel?.callRoom || channel?.jitsiRoom || channel?.id || 'URP-Support';
}

let publicPollTimer = null;

function renderPublicQueueEntry(entry) {
    const av = entry.avatarUrl
        ? '<img src="' + escapeHtml(entry.avatarUrl) + '" alt="" class="support-user-avatar">'
        : '<span class="support-user-avatar support-user-avatar-ph"><i class="fas fa-user"></i></span>';
    const joined = entry.joinedAt
        ? new Date(entry.joinedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
        : '';
    return (
        '<div class="support-public-entry">' +
        av +
        '<div class="support-user-meta">' +
        '<strong>#' +
        escapeHtml(String(entry.position)) +
        ' ' +
        escapeHtml(entry.username || 'Speler') +
        '</strong>' +
        '<span class="support-queue-meta">' +
        '<i class="fas fa-headset"></i> ' +
        escapeHtml(entry.channelNaam || 'Support') +
        (joined ? ' · <i class="fas fa-clock"></i> ' + joined : '') +
        '</span></div></div>'
    );
}

async function refreshPublicQueue() {
    const list = document.getElementById('publicQueueList');
    if (!list) return;
    try {
        const res = await fetch(SITE_API + '/api/support-queue?action=public-queue');
        const d = await res.json();
        if (!res.ok) {
            list.innerHTML = '<p class="staff-empty">Wachtkamer tijdelijk niet bereikbaar.</p>';
            return;
        }
        if (!d.waiting || d.waiting.length === 0) {
            list.innerHTML =
                '<p class="staff-empty"><i class="fas fa-check-circle"></i> Niemand in de wachtkamer.</p>';
            return;
        }
        list.innerHTML = d.waiting.map(renderPublicQueueEntry).join('');
    } catch (e) {
        list.innerHTML = '<p class="staff-empty">Kon wachtkamer niet laden.</p>';
    }
}

function startPublicQueuePoll() {
    refreshPublicQueue();
    if (publicPollTimer) clearInterval(publicPollTimer);
    publicPollTimer = setInterval(refreshPublicQueue, 8000);
}

function renderDiscordUserCard(entry, extraHtml) {
    const av = entry.avatarUrl
        ? '<img src="' + escapeHtml(entry.avatarUrl) + '" alt="" class="support-user-avatar">'
        : '<span class="support-user-avatar support-user-avatar-ph"><i class="fas fa-user"></i></span>';
    return (
        '<div class="support-user-card">' +
        av +
        '<div class="support-user-meta">' +
        '<strong>' + escapeHtml(entry.username || entry.naam || 'Onbekend') + '</strong>' +
        '<span>@' + escapeHtml(entry.discordUsername || entry.discordId || '') + '</span>' +
        '<code class="support-user-id">ID: ' + escapeHtml(entry.discordId || '') + '</code>' +
        (extraHtml || '') +
        '</div></div>'
    );
}

function startWaitingMusic(src) {
    const audio = document.getElementById('waitingMusic');
    if (!audio) return;
    audio.volume = 0.35;
    audio.src = src || '/assets/audio/waiting-ambient.mp3';
    audio.play().catch(function () {
        audio.src = 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3';
        audio.play().catch(function () {});
    });
}

function stopWaitingMusic() {
    const audio = document.getElementById('waitingMusic');
    if (audio) {
        audio.pause();
        audio.src = '';
    }
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

let pollTimer = null;
let supportConfig = null;
let guestCallStarted = false;

async function refreshSupportUI() {
    const cfg = await fetch(
        SITE_API + '/api/support-queue?action=config&accessToken=' + encodeURIComponent(accessToken())
    );
    supportConfig = await cfg.json();
    if (!cfg.ok) throw new Error(supportConfig.error || 'Config laden mislukt');

    document.getElementById('waitingMusic').src =
        supportConfig.waitingMusic || '/assets/audio/waiting-ambient.mp3';

    if (supportConfig.isStaff) renderStaffPanel();
    else document.getElementById('staffPanel').hidden = true;

    renderChannelPicker(supportConfig.channels);
    await pollSupportStatus();

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollSupportStatus, 3000);
}

function renderChannelPicker(channels) {
    const el = document.getElementById('channelPicker');
    const publicChannels = (channels || []).filter(function (c) {
        return c.wachtkamer && !c.staffOnly;
    });
    if (!publicChannels.length) {
        el.innerHTML = '<p class="staff-empty">Geen wachtkamer-kanalen beschikbaar.</p>';
        return;
    }
    el.innerHTML = publicChannels
        .map(function (ch) {
            return (
                '<button type="button" class="support-channel-btn" data-channel="' +
                escapeHtml(ch.id) +
                '">' +
                '<strong>' +
                escapeHtml(ch.naam) +
                '</strong>' +
                '<span>' +
                escapeHtml(ch.beschrijving || '') +
                '</span></button>'
            );
        })
        .join('');
    el.querySelectorAll('.support-channel-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            joinWaitingRoom(btn.dataset.channel);
        });
    });
}

async function joinWaitingRoom(channelId) {
    guestCallStarted = false;
    stopURPCall('urpCallGuest');
    const res = await fetch(SITE_API + '/api/support-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            accessToken: accessToken(),
            action: 'join',
            channelId: channelId,
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Join mislukt');
    await pollSupportStatus();
}

async function leaveWaitingRoom() {
    stopURPCall('urpCallGuest');
    guestCallStarted = false;
    await fetch(
        SITE_API + '/api/support-queue?action=leave&accessToken=' + encodeURIComponent(accessToken()),
        { method: 'DELETE' }
    );
    stopWaitingMusic();
    await pollSupportStatus();
}

async function pollSupportStatus() {
    const res = await fetch(
        SITE_API + '/api/support-queue?action=status&accessToken=' + encodeURIComponent(accessToken())
    );
    const data = await res.json();
    if (!res.ok) return;

    const guestView = document.getElementById('guestWaitingView');
    const admittedView = document.getElementById('guestAdmittedView');
    const picker = document.getElementById('channelPicker');

    if (data.status === 'waiting') {
        guestCallStarted = false;
        stopURPCall('urpCallGuest');
        guestView.hidden = false;
        admittedView.hidden = true;
        picker.hidden = true;
        document.getElementById('waitPosition').textContent = data.position || '?';
        document.getElementById('waitChannel').textContent = data.entry?.channelNaam || '';
        document.getElementById('waitUserCard').innerHTML = renderDiscordUserCard({
            username: userName(),
            discordUsername: discordTag(),
            discordId: discordId(),
            avatarUrl: avatarUrl(),
        });
        startWaitingMusic(supportConfig?.waitingMusic);
        document.getElementById('waitHint').textContent =
            'Je kunt nog niet praten. Staff ziet je Discord-naam en haalt je binnen wanneer het jouw beurt is.';
    } else if (data.status === 'admitted') {
        stopWaitingMusic();
        guestView.hidden = true;
        admittedView.hidden = false;
        picker.hidden = true;
        document.getElementById('admittedChannelName').textContent = data.channel?.naam || '';
        const roomId = getCallRoomId(data.channel);
        if (!guestCallStarted) {
            guestCallStarted = true;
            startURPCall('urpCallGuest', roomId);
        }
    } else {
        stopWaitingMusic();
        guestCallStarted = false;
        stopURPCall('urpCallGuest');
        guestView.hidden = true;
        admittedView.hidden = true;
        picker.hidden = false;
        if (!supportConfig?.isStaff) document.getElementById('guestPickHint').hidden = false;
    }

    if (supportConfig?.isStaff) await refreshStaffQueue();
}

async function refreshStaffQueue() {
    const res = await fetch(
        SITE_API + '/api/support-queue?action=list&accessToken=' + encodeURIComponent(accessToken())
    );
    const data = await res.json();
    if (!res.ok) return;

    const list = document.getElementById('staffQueueList');
    const waiting = data.waiting || [];
    if (!waiting.length) {
        list.innerHTML = '<p class="staff-empty">Niemand in de wachtkamer.</p>';
        return;
    }

    list.innerHTML = waiting
        .map(function (entry) {
            return (
                '<div class="support-queue-item" data-discord-id="' +
                escapeHtml(entry.discordId) +
                '">' +
                renderDiscordUserCard(
                    entry,
                    '<span class="support-queue-meta"><i class="fas fa-clock"></i> ' +
                        escapeHtml(entry.channelNaam || '') +
                        ' · sinds ' +
                        new Date(entry.joinedAt).toLocaleTimeString('nl-NL', {
                            hour: '2-digit',
                            minute: '2-digit',
                        }) +
                        '</span>'
                ) +
                '<div class="support-queue-actions">' +
                '<button type="button" class="staff-btn staff-btn-primary btn-admit">' +
                '<i class="fas fa-hand-point-right"></i> Binnenhalen</button>' +
                '<button type="button" class="staff-btn btn-kick-queue"><i class="fas fa-times"></i></button></div></div>'
            );
        })
        .join('');

    list.querySelectorAll('.btn-admit').forEach(function (btn) {
        btn.addEventListener('click', async function () {
            const id = btn.closest('[data-discord-id]').dataset.discordId;
            try {
                const admitRes = await supportAdmit(id);
                await pollSupportStatus();
                const ch = admitRes.channel || (supportConfig.channels || []).find(function (c) {
                    return c.id === 'speler-support';
                });
                joinStaffCall(ch);
            } catch (e) {
                alert(e.message);
            }
        });
    });

    list.querySelectorAll('.btn-kick-queue').forEach(function (btn) {
        btn.addEventListener('click', async function () {
            const id = btn.closest('[data-discord-id]').dataset.discordId;
            if (!confirm('Uit wachtkamer halen?')) return;
            const res = await fetch(SITE_API + '/api/support-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: accessToken(), action: 'kick', discordId: id }),
            });
            const d = await res.json();
            if (!res.ok) alert(d.error || 'Mislukt');
            await refreshStaffQueue();
        });
    });
}

function joinStaffCall(channel) {
    if (!channel) return;
    const roomId = getCallRoomId(channel);
    document.getElementById('staffCallWrap').hidden = false;
    startURPCall('urpCallStaff', roomId);
}

async function renderStaffPanel() {
    document.getElementById('staffPanel').hidden = false;
    const sel = document.getElementById('staffChannelSelect');
    sel.innerHTML = (supportConfig?.channels || [])
        .map(function (c) {
            return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.naam) + '</option>';
        })
        .join('');
    document.getElementById('btnStaffJoinCall').onclick = function () {
        const ch = (supportConfig.channels || []).find(function (c) {
            return c.id === sel.value;
        });
        joinStaffCall(ch);
    };
    await refreshStaffQueue();
}

document.addEventListener('DOMContentLoaded', function () {
    startPublicQueuePoll();
    initSupportPage();
    const btnLeave = document.getElementById('btnLeaveWait');
    if (btnLeave) btnLeave.addEventListener('click', leaveWaitingRoom);
    const link = document.getElementById('linkStaffPortal');
    if (link) link.hidden = !isStaff();
});
