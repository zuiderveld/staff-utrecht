/* Support: kanalen + handmatig URP Call + wie zit in welk kanaal */

function getCallRoomId(channel) {
    return channel?.callRoom || channel?.jitsiRoom || channel?.id || 'URP-Support';
}

let supportConfig = null;
let connectedChannelId = null;
let channelPresence = {};
let roomPeersCache = {};
let presenceTimer = null;

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
        startPresencePoll();
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

function stopPresencePoll() {
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = null;
}

function startPresencePoll() {
    stopPresencePoll();
    refreshChannelPresence();
    presenceTimer = setInterval(refreshChannelPresence, connectedChannelId ? 1500 : 3500);
}

function mergeMemberEntry(list, entry) {
    if (!entry || !entry.id) return list;
    const id = String(entry.id);
    if (list.some(function (p) { return String(p.id) === id; })) return list;
    return list.concat([
        {
            id: id,
            name: entry.name || 'Onbekend',
            avatarUrl: entry.avatarUrl || null,
            isStaff: !!entry.isStaff,
        },
    ]);
}

function getLiveRosterForChannel(ch) {
    const roomId = getCallRoomId(ch);
    if (getURPCallRoomId && getURPCallRoomId('urpCallGuest') === roomId) {
        return (getURPCallRoster('urpCallGuest') || []).map(function (p) {
            return {
                id: String(p.id),
                name: p.name || 'Onbekend',
                avatarUrl: p.avatarUrl || null,
                isStaff: !!p.isStaff,
            };
        });
    }
    return [];
}

async function fetchRoomPeers(roomId) {
    const res = await fetch(
        SITE_API +
            '/api/rtc-room?action=peers&roomId=' +
            encodeURIComponent(roomId) +
            '&accessToken=' +
            encodeURIComponent(accessToken())
    );
    const data = await res.json();
    if (!res.ok) return [];
    return (data.peers || []).map(function (p) {
        return {
            id: String(p.id),
            name: p.name || 'Onbekend',
            avatarUrl: p.avatarUrl || null,
            isStaff: !!p.isStaff,
        };
    });
}

async function refreshChannelPresence() {
    if (!isLoggedIn()) return;
    try {
        const res = await fetch(
            SITE_API +
                '/api/support-queue?action=presence&accessToken=' +
                encodeURIComponent(accessToken())
        );
        const data = await res.json();
        if (res.ok && data.presence) {
            channelPresence = data.presence;
        }
        if (connectedChannelId && supportConfig) {
            const ch = (supportConfig.channels || []).find(function (c) {
                return c.id === connectedChannelId;
            });
            if (ch) {
                const live = await fetchRoomPeers(getCallRoomId(ch));
                roomPeersCache[ch.id] = live;
                channelPresence[ch.id] = live;
            }
        }
        renderChannelPicker(supportConfig?.channels || []);
    } catch (e) {
        /* stil falen */
    }
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
        stopPresencePoll();
        return;
    }

    await refreshChannelPresence();
}

function getMembersInChannel(ch) {
    let list = (roomPeersCache[ch.id] || channelPresence[ch.id] || []).map(function (p) {
        return {
            id: String(p.id),
            name: p.name || 'Onbekend',
            avatarUrl: p.avatarUrl || null,
            isStaff: !!p.isStaff,
        };
    });
    getLiveRosterForChannel(ch).forEach(function (p) {
        list = mergeMemberEntry(list, p);
    });
    const myId = discordId();
    if (connectedChannelId === ch.id && myId) {
        list = mergeMemberEntry(list, {
            id: myId,
            name: userName(),
            avatarUrl: avatarUrl(),
            isStaff: isStaff(),
        });
    }
    return list;
}

function renderChannelMembers(ch) {
    const list = getMembersInChannel(ch);
    if (!list.length) {
        return (
            '<div class="support-channel-members">' +
            '<span class="support-channel-members-label">In dit kanaal</span>' +
            '<p class="support-channel-members-empty">Nog niemand verbonden</p></div>'
        );
    }
    const onlyMe =
        list.length === 1 && list[0].id === discordId() && connectedChannelId === ch.id;
    return (
        '<div class="support-channel-members">' +
        '<span class="support-channel-members-label">' +
        (onlyMe ? 'Jij bent verbonden (wacht op anderen)' : 'In dit kanaal (' + list.length + ')') +
        '</span>' +
        '<ul class="support-channel-member-list">' +
        list
            .map(function (p) {
                const av = p.avatarUrl
                    ? '<img src="' + escapeHtml(p.avatarUrl) + '" alt="" class="support-user-avatar">'
                    : '<span class="support-user-avatar support-user-avatar-ph"><i class="fas fa-user"></i></span>';
                const you =
                    p.id === discordId()
                        ? ' <span class="support-channel-member-you">(jij)</span>'
                        : '';
                return (
                    '<li class="support-channel-member">' +
                    av +
                    '<span>' +
                    escapeHtml(p.name || 'Onbekend') +
                    (p.isStaff ? ' <em class="support-member-staff">Staff</em>' : '') +
                    you +
                    '</span></li>'
                );
            })
            .join('') +
        '</ul></div>'
    );
}

function getCallPanel() {
    return document.getElementById('callPanel');
}

function updateChannelMemberLists(channels) {
    const el = document.getElementById('channelPicker');
    if (!el) return;
    channels.forEach(function (ch) {
        const card = el.querySelector('.support-channel-card[data-channel="' + ch.id + '"]');
        if (!card) return;
        const old = card.querySelector('.support-channel-members');
        const wrap = document.createElement('div');
        wrap.innerHTML = renderChannelMembers(ch);
        const next = wrap.firstElementChild;
        if (old && next) old.replaceWith(next);
    });
}

function setCallPanelVisible(visible) {
    const panel = getCallPanel();
    if (panel) panel.hidden = !visible;
}

function renderChannelPicker(channels) {
    const el = document.getElementById('channelPicker');
    const pickerHint = document.getElementById('guestPickHint');

    if (!channels.length) {
        el.innerHTML = '<p class="staff-empty">Geen supportkanalen beschikbaar voor jouw rol.</p>';
        setCallPanelVisible(false);
        return;
    }

    if (connectedChannelId) {
        updateChannelMemberLists(channels);
        if (pickerHint) pickerHint.hidden = true;
        setCallPanelVisible(true);
        return;
    }

    el.innerHTML = channels
        .map(function (ch) {
            const isConnected = connectedChannelId === ch.id;
            return (
                '<div class="support-channel-card' +
                (isConnected ? ' support-channel-card-connected' : '') +
                '" data-channel="' +
                escapeHtml(ch.id) +
                '">' +
                '<div class="support-channel-card-top">' +
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
                '</button></div>' +
                renderChannelMembers(ch) +
                '</div>'
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
    setCallPanelVisible(!!connectedChannelId);
}

function connectToChannel(channel) {
    if (!channel) return;
    connectedChannelId = channel.id;
    const nameEl = document.getElementById('connectedChannelName');
    if (nameEl) nameEl.textContent = channel.naam || channel.id;
    setCallPanelVisible(true);
    document.getElementById('guestPickHint').hidden = true;
    const call = startURPCall('urpCallGuest', getCallRoomId(channel));
    renderChannelPicker(supportConfig.channels || []);
    if (call && call.ensureAudioContext) {
        call.ensureAudioContext();
        if (call._audioCtx && call._audioCtx.state === 'suspended') {
            call._audioCtx.resume();
        }
    }
    startPresencePoll();
    setTimeout(refreshChannelPresence, 400);
    setTimeout(refreshChannelPresence, 1200);
}

function disconnectFromChannel() {
    if (connectedChannelId) delete roomPeersCache[connectedChannelId];
    connectedChannelId = null;
    stopPresencePoll();
    stopURPCall('urpCallGuest');
    setCallPanelVisible(false);
    const hint = document.getElementById('guestPickHint');
    if (hint) hint.hidden = false;
    renderChannelPicker(supportConfig?.channels || []);
    startPresencePoll();
}

window.onURPCallRosterChange = function (roomId, roster) {
    if (!connectedChannelId || !supportConfig) return;
    const ch = (supportConfig.channels || []).find(function (c) {
        return getCallRoomId(c) === roomId;
    });
    if (!ch) return;
    updateChannelMemberLists(supportConfig.channels || []);
    refreshChannelPresence();
};

document.addEventListener('DOMContentLoaded', function () {
    initSupportPage();
    const btnDisconnect = document.getElementById('btnDisconnect');
    if (btnDisconnect) btnDisconnect.addEventListener('click', disconnectFromChannel);
    const link = document.getElementById('linkStaffPortal');
    if (link) link.hidden = !isStaff();
});
