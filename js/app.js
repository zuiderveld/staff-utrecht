function isLoggedIn() {
    return !!sessionStorage.getItem('urpStaffUser') && !!sessionStorage.getItem('urpStaffAccessToken');
}

function isBeheer() {
    return sessionStorage.getItem('urpStaffBeheer') === 'true';
}

function userName() {
    return sessionStorage.getItem('urpStaffUser') || 'Staff';
}

function staffRank() {
    return sessionStorage.getItem('urpStaffRankNaam') || '';
}

function accessToken() {
    return sessionStorage.getItem('urpStaffAccessToken') || '';
}

function isStaff() {
    return sessionStorage.getItem('urpStaffIsStaff') === 'true';
}

function discordId() {
    return sessionStorage.getItem('urpStaffDiscordId') || '';
}

function avatarUrl() {
    return sessionStorage.getItem('urpStaffAvatarUrl') || '';
}

function discordTag() {
    return sessionStorage.getItem('urpStaffDiscordTag') || '';
}

function setSession(data) {
    sessionStorage.setItem('urpStaffUser', data.username || 'Gebruiker');
    sessionStorage.setItem('urpStaffAccessToken', data.accessToken || '');
    sessionStorage.setItem('urpStaffBeheer', data.isBeheer ? 'true' : 'false');
    sessionStorage.setItem('urpStaffIsStaff', data.isStaff ? 'true' : 'false');
    if (data.discordId) sessionStorage.setItem('urpStaffDiscordId', data.discordId);
    else sessionStorage.removeItem('urpStaffDiscordId');
    if (data.avatarUrl) sessionStorage.setItem('urpStaffAvatarUrl', data.avatarUrl);
    else sessionStorage.removeItem('urpStaffAvatarUrl');
    if (data.discordUsername) sessionStorage.setItem('urpStaffDiscordTag', data.discordUsername);
    else sessionStorage.removeItem('urpStaffDiscordTag');
    if (data.rankNaam) sessionStorage.setItem('urpStaffRankNaam', data.rankNaam);
    else sessionStorage.removeItem('urpStaffRankNaam');
}

function logout() {
    sessionStorage.removeItem('urpStaffUser');
    sessionStorage.removeItem('urpStaffAccessToken');
    sessionStorage.removeItem('urpStaffBeheer');
    sessionStorage.removeItem('urpStaffRankNaam');
    sessionStorage.removeItem('urpStaffIsStaff');
    sessionStorage.removeItem('urpStaffDiscordId');
    sessionStorage.removeItem('urpStaffAvatarUrl');
    sessionStorage.removeItem('urpStaffDiscordTag');
    sessionStorage.removeItem('urpStaffRedirect');
    window.location.replace('/');
}

/** Staff-portaal pagina's (dashboard, regels, …) */
function requireLogin() {
    if (!isLoggedIn()) {
        sessionStorage.setItem('urpStaffRedirect', window.location.pathname);
        window.location.replace('/');
        return false;
    }
    if (!isStaff()) {
        alert('Alleen staff met Discord-rol heeft toegang tot het portaal. Gebruik Support voor hulp.');
        window.location.replace('/support.html');
        return false;
    }
    return true;
}

function requireBeheer() {
    if (!isBeheer()) {
        alert('Geen toegang tot beheer. Vereist Founder, Co-Founder, Beheer Team of Bestuur Team.');
        window.location.replace('/dashboard.html');
        return false;
    }
    return true;
}

async function discordAuthWithCode(code) {
    const res = await fetch(SITE_API + '/api/staff-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, redirectUri: discordRedirectUri() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Discord inloggen mislukt');
    setSession(data);
    return data;
}

/** Support / wachtkamer — elke URP Discord-lid */
async function discordMemberAuthWithCode(code, redirectUri) {
    const res = await fetch(SITE_API + '/api/discord-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, redirectUri: redirectUri || discordRedirectUri() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Discord inloggen mislukt');
    setSession(data);
    return data;
}

function supportRedirectUri() {
    return window.location.origin + '/support.html';
}

async function supportAdmit(discordIdTarget) {
    const res = await fetch(SITE_API + '/api/support-admit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: accessToken(), discordId: discordIdTarget }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Binnenhalen mislukt');
    return data;
}

async function fetchSite() {
    const res = await fetch(SITE_API + '/api/site-data', { cache: 'no-store' });
    return res.json();
}

async function fetchStaffTeam() {
    const res = await fetch(SITE_API + '/api/staff-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: accessToken() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Team laden mislukt');
    return data;
}

function formatLiveTime(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString('nl-NL', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

async function saveSite(siteData) {
    const res = await fetch(SITE_API + '/api/site-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: siteData, accessToken: accessToken() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');
    return data;
}

function renderHeader(active) {
    const rank = staffRank();
    const rankLabel = rank ? ' · ' + escapeHtml(rank) : '';
    const beheer = isBeheer()
        ? '<a href="/admin/" class="staff-btn staff-btn-primary"><i class="fas fa-cog"></i> Beheer</a>'
        : '';

    return (
        '<header class="staff-header">' +
        '<div class="staff-container">' +
        '<div class="staff-nav">' +
        '<a href="/dashboard.html" class="staff-logo">' +
        '<i class="fas fa-user-shield"></i><h1>URP <span>Staff</span></h1></a>' +
        '<nav class="staff-links">' +
        '<a href="/dashboard.html"' + (active === 'home' ? ' class="active"' : '') + '>Home</a>' +
        '<a href="/regels.html"' + (active === 'regels' ? ' class="active"' : '') + '>Regels</a>' +
        '<a href="/functies.html"' + (active === 'functies' ? ' class="active"' : '') + '>Staff functies</a>' +
        '<a href="/team.html"' + (active === 'team' ? ' class="active"' : '') + '>Staff team</a>' +
        '<a href="/support.html"' + (active === 'support' ? ' class="active"' : '') + '>Support</a>' +
        '</nav>' +
        '<div class="staff-actions">' +
        '<span class="staff-badge"><i class="fas fa-user"></i> ' + escapeHtml(userName()) + rankLabel + '</span>' +
        beheer +
        '<button type="button" class="staff-btn staff-btn-danger" onclick="logout()">' +
        '<i class="fas fa-sign-out-alt"></i> Uit</button></div></div></div></header>'
    );
}

function mountHeader(active) {
    const el = document.getElementById('siteHeader');
    if (el) el.innerHTML = renderHeader(active);
}

function renderRegels(regels, container) {
    if (!regels || !regels.length) {
        container.innerHTML = '<p class="staff-empty">Nog geen regels ingesteld.</p>';
        return;
    }
    container.innerHTML = regels
        .map(function (cat) {
            const items = (cat.items || [])
                .map(function (item) {
                    return '<li><i class="fas fa-check-circle"></i> ' + escapeHtml(item) + '</li>';
                })
                .join('');
            return (
                '<div class="staff-rank-block">' +
                '<div class="staff-rank-head"><h3>' + escapeHtml(cat.titel || 'Regels') + '</h3></div>' +
                '<ul class="staff-list">' + items + '</ul></div>'
            );
        })
        .join('');
}

async function fetchDiscordRoleNames() {
    const res = await fetch(SITE_API + '/api/discord-role-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: accessToken() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Discord-rollen laden mislukt');
    return data.roles || {};
}

function roleMeta(id, roleMap) {
    const m = roleMap && roleMap[id];
    return {
        id: id,
        name: (m && m.name) || 'Onbekende rol',
        color: (m && m.color) || '#6b7280',
        known: !!(m && m.name),
    };
}

function roleIdChip(id, roleMap) {
    const r = roleMeta(id, roleMap);
    const borderStyle = r.color ? ' style="border-color:' + escapeHtml(r.color) + '55"' : '';
    const dotStyle = r.color ? ' style="background:' + escapeHtml(r.color) + '"' : '';
    return (
        '<button type="button" class="staff-role-chip' +
        (r.known ? '' : ' staff-role-chip-unknown') +
        '" data-role-id="' +
        escapeHtml(id) +
        '"' +
        borderStyle +
        ' title="Klik om role-ID te kopiëren · ' +
        escapeHtml(id) +
        '">' +
        '<span class="staff-role-dot"' +
        dotStyle +
        '></span>' +
        '<span class="staff-role-chip-text">' +
        '<span class="staff-role-name">' +
        escapeHtml(r.name) +
        '</span>' +
        '<code class="staff-role-id-hint">' +
        escapeHtml(id) +
        '</code></span></button>'
    );
}

function roleIdList(ids, roleMap) {
    if (!ids || !ids.length) return '';
    return (
        '<div class="staff-role-list">' +
        ids.map(function (id) { return roleIdChip(id, roleMap); }).join('') +
        '</div>'
    );
}

function functieToggleHtml(label, panelId, startOpen) {
    const open = startOpen ? ' open' : '';
    const expanded = startOpen ? 'true' : 'false';
    return (
        '<button type="button" class="staff-functie-toggle' +
        open +
        '" aria-expanded="' +
        expanded +
        '" aria-controls="' +
        panelId +
        '">' +
        '<i class="fas fa-chevron-right staff-functie-chevron" aria-hidden="true"></i>' +
        '<span class="staff-functie-toggle-label">' +
        escapeHtml(label) +
        '</span></button>'
    );
}

function functiePanelHtml(panelId, innerHtml, startOpen) {
    return (
        '<div id="' +
        panelId +
        '" class="staff-functie-panel' +
        (startOpen ? ' open' : '') +
        '">' +
        innerHtml +
        '</div>'
    );
}

function bindRoleCopy(container) {
    container.querySelectorAll('.staff-role-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            const id = chip.getAttribute('data-role-id');
            if (!id || !navigator.clipboard) return;
            navigator.clipboard.writeText(id).then(function () {
                chip.classList.add('copied');
                setTimeout(function () { chip.classList.remove('copied'); }, 1200);
            });
        });
    });
}

function bindFunctieAccordions(container) {
    container.querySelectorAll('.staff-functie-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const panelId = btn.getAttribute('aria-controls');
            const panel = panelId ? document.getElementById(panelId) : null;
            const isOpen = btn.classList.toggle('open');
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (panel) panel.classList.toggle('open', isOpen);
        });
    });
}

function renderFuncties(data, container, roleMap) {
    roleMap = roleMap || {};
    if (!data || !data.secties) {
        container.innerHTML = '<p class="staff-empty">Geen functies gevonden.</p>';
        return;
    }

    let html =
        '<div class="staff-card staff-functies-card">' +
        '<div class="staff-card-title"><i class="fas fa-layer-group"></i> ' +
        escapeHtml(data.titel || 'Staffrangen & Functies') +
        '</div>';

    data.secties.forEach(function (sectie, i) {
        const panelId = 'functie-sectie-' + i;
        const startOpen = i === 0;
        const panelInner = roleIdList(sectie.rollen, roleMap);
        html +=
            '<div class="staff-functie-sectie">' +
            functieToggleHtml(sectie.beschrijving || 'Sectie', panelId, startOpen) +
            functiePanelHtml(panelId, panelInner, startOpen) +
            '</div>';
    });
    html += '</div>';

    if (data.extra && data.extra.items && data.extra.items.length) {
        html +=
            '<div class="staff-card staff-functies-card">' +
            '<div class="staff-card-title"><i class="fas fa-puzzle-piece"></i> ' +
            escapeHtml(data.extra.titel || 'Extra functies') +
            '</div>';
        data.extra.items.forEach(function (item, i) {
            const panelId = 'functie-extra-' + i;
            const firstRole = item.rollen && item.rollen[0] ? roleMeta(item.rollen[0], roleMap).name : '';
            const toggleLabel = firstRole
                ? firstRole + (item.uitleg ? ' — ' + item.uitleg.slice(0, 60) + (item.uitleg.length > 60 ? '…' : '') : '')
                : item.uitleg || 'Extra rol';
            let panelInner = roleIdList(item.rollen, roleMap);
            panelInner += '<p class="staff-functie-uitleg">' + escapeHtml(item.uitleg || '') + '</p>';
            if (item.vanaf && item.vanaf.length) {
                panelInner +=
                    '<p class="staff-functie-vanaf-label">Mogelijk vanaf:</p>' +
                    roleIdList(item.vanaf, roleMap);
            }
            html +=
                '<div class="staff-functie-extra">' +
                functieToggleHtml(toggleLabel, panelId, false) +
                functiePanelHtml(panelId, panelInner, false) +
                '</div>';
        });
        html += '</div>';
    }

    container.innerHTML = html;
    bindRoleCopy(container);
    bindFunctieAccordions(container);
}

function renderInfo(sections, container) {
    if (!sections || !sections.length) {
        container.innerHTML = '<p class="staff-empty">Nog geen informatie ingesteld.</p>';
        return;
    }
    container.innerHTML = sections
        .map(function (s) {
            return (
                '<div class="staff-card" style="margin-bottom:1rem">' +
                '<div class="staff-card-title"><i class="fas fa-info-circle"></i> ' +
                escapeHtml(s.titel || 'Info') + '</div>' +
                '<div class="staff-prose"><p>' + escapeHtml(s.inhoud || '') + '</p></div></div>'
            );
        })
        .join('');
}

function renderTeam(ranks, container) {
    const sorted = [...(ranks || [])].sort(function (a, b) {
        return (a.volgorde || 99) - (b.volgorde || 99);
    });
    if (!sorted.length) {
        container.innerHTML = '<p class="staff-empty">Nog geen ranks ingesteld.</p>';
        return;
    }
    container.innerHTML = sorted
        .map(function (rank) {
            const leden = rank.leden || [];
            const membersHtml = leden.length
                ? '<div class="staff-member-grid">' +
                  leden
                      .map(function (m) {
                          const av = m.avatarUrl
                              ? '<img class="staff-member-avatar" src="' +
                                escapeHtml(m.avatarUrl) +
                                '" alt="" width="40" height="40" loading="lazy">'
                              : '';
                          return (
                              '<div class="staff-member">' +
                              av +
                              '<div class="staff-member-text">' +
                              escapeHtml(m.naam) +
                              (m.discord ? '<small>' + escapeHtml(m.discord) + '</small>' : '') +
                              '</div></div>'
                          );
                      })
                      .join('') +
                  '</div>'
                : '<p class="staff-empty">Nog niemand met deze Discord-rol op de server.</p>';
            return (
                '<div class="staff-rank-block">' +
                '<div class="staff-rank-head">' +
                '<span class="staff-rank-dot" style="background:' + escapeHtml(rank.kleur || '#8b5cf6') + '"></span>' +
                '<h3>' + escapeHtml(rank.naam) + '</h3></div>' + membersHtml + '</div>'
            );
        })
        .join('');
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}
