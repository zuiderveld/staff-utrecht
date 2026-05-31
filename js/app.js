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

function setSession(data) {
    sessionStorage.setItem('urpStaffUser', data.username || 'Staff');
    sessionStorage.setItem('urpStaffAccessToken', data.accessToken || '');
    sessionStorage.setItem('urpStaffBeheer', data.isBeheer ? 'true' : 'false');
    if (data.rankNaam) sessionStorage.setItem('urpStaffRankNaam', data.rankNaam);
    else sessionStorage.removeItem('urpStaffRankNaam');
}

function logout() {
    sessionStorage.removeItem('urpStaffUser');
    sessionStorage.removeItem('urpStaffAccessToken');
    sessionStorage.removeItem('urpStaffBeheer');
    sessionStorage.removeItem('urpStaffRankNaam');
    sessionStorage.removeItem('urpStaffRedirect');
    window.location.replace('/');
}

function requireLogin() {
    if (!isLoggedIn()) {
        sessionStorage.setItem('urpStaffRedirect', window.location.pathname);
        window.location.replace('/');
        return false;
    }
    return true;
}

function requireBeheer() {
    if (!isBeheer()) {
        alert('Geen toegang tot beheer. Vereist Founder, Beheer Team of Bestuur Team.');
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

async function fetchSite() {
    const res = await fetch(SITE_API + '/api/site-data', { cache: 'no-store' });
    return res.json();
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
        '<a href="/informatie.html"' + (active === 'info' ? ' class="active"' : '') + '>Informatie</a>' +
        '<a href="/team.html"' + (active === 'team' ? ' class="active"' : '') + '>Staff team</a>' +
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
                          return (
                              '<div class="staff-member">' +
                              escapeHtml(m.naam) +
                              (m.discord ? '<small>' + escapeHtml(m.discord) + '</small>' : '') +
                              '</div>'
                          );
                      })
                      .join('') +
                  '</div>'
                : '<p class="staff-empty">Nog geen leden toegevoegd.</p>';
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
