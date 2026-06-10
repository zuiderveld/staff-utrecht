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

function isOnderwereldCoordinator() {
    return sessionStorage.getItem('urpStaffOnderwereld') === 'true';
}

function staffLoginType() {
    return sessionStorage.getItem('urpStaffLoginType') || 'staff';
}

function canViewDossiers() {
    return sessionStorage.getItem('urpStaffCanViewDossiers') === 'true';
}

function canViewWeapons() {
    return sessionStorage.getItem('urpStaffCanViewWeapons') === 'true';
}

function isSuperUser() {
    return sessionStorage.getItem('urpStaffSuperUser') === 'true';
}

function setSession(data) {
    sessionStorage.setItem('urpStaffUser', data.username || 'Gebruiker');
    sessionStorage.setItem('urpStaffAccessToken', data.accessToken || '');
    sessionStorage.setItem('urpStaffBeheer', data.isBeheer ? 'true' : 'false');
    sessionStorage.setItem('urpStaffIsStaff', data.isStaff ? 'true' : 'false');
    sessionStorage.setItem('urpStaffCanViewDossiers', data.canViewDossiers ? 'true' : 'false');
    sessionStorage.setItem('urpStaffCanViewWeapons', data.canViewWeapons ? 'true' : 'false');
    sessionStorage.setItem('urpStaffSuperUser', data.isSuperUser ? 'true' : 'false');
    sessionStorage.setItem('urpStaffOnderwereld', data.isOnderwereldCoordinator ? 'true' : 'false');
    if (data.loginType) sessionStorage.setItem('urpStaffLoginType', data.loginType);
    else sessionStorage.removeItem('urpStaffLoginType');
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
    sessionStorage.removeItem('urpStaffCanViewDossiers');
    sessionStorage.removeItem('urpStaffCanViewWeapons');
    sessionStorage.removeItem('urpStaffSuperUser');
    sessionStorage.removeItem('urpStaffOnderwereld');
    sessionStorage.removeItem('urpStaffLoginType');
    sessionStorage.removeItem('urpStaffRedirect');
    sessionStorage.removeItem('urpStaffGewenstePortaal');
    window.location.replace('/');
}

function requireDossiersAccess() {
    if (!requireLogin()) return false;
    if (isSuperUser() || canViewDossiers()) return true;
    alert('Geen toegang tot staff dossiers. Alleen Lead Coördinator, Beheer Team en Founder.');
    window.location.replace('/dashboard.html');
    return false;
}

function requireWeaponsAccess() {
    if (!requireLogin()) return false;
    if (isSuperUser() || canViewWeapons()) return true;
    alert('Geen toegang tot wapens. Alleen Beheer Team heeft toegang tot dit onderdeel.');
    window.location.replace('/dashboard.html');
    return false;
}

function requireOnderwereldAccess() {
    if (!isLoggedIn()) {
        sessionStorage.setItem('urpStaffGewenstePortaal', 'onderwereld');
        sessionStorage.setItem('urpStaffRedirect', '/onderwereld.html');
        window.location.replace('/');
        return false;
    }
    if (!isOnderwereldCoordinator() && !isSuperUser()) {
        alert('Geen toegang. Alleen Onderwereld Coordinator heeft toegang tot deze pagina.');
        window.location.replace(isStaff() ? '/dashboard.html' : '/');
        return false;
    }
    return true;
}

/** Staff-portaal pagina's (dashboard, regels, …) */
function requireLogin() {
    if (!isLoggedIn()) {
        sessionStorage.setItem('urpStaffRedirect', window.location.pathname);
        window.location.replace('/');
        return false;
    }
    if (!isStaff()) {
        alert('Alleen staff met een URP Discord-staffrol heeft toegang tot dit portaal.');
        logout();
        return false;
    }
    return true;
}

function requireBeheer() {
    if (isSuperUser()) return true;
    if (!isBeheer()) {
        alert('Geen toegang tot beheer. Alleen Founder of Co-Founder.');
        window.location.replace('/dashboard.html');
        return false;
    }
    return true;
}

async function discordAuthWithCode(code, loginTypeArg) {
    const type = loginTypeArg || sessionStorage.getItem('urpStaffGewenstePortaal') || 'staff';
    const res = await fetch(SITE_API + '/api/staff-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: code,
            redirectUri: discordRedirectUri(),
            loginType: type === 'onderwereld' ? 'onderwereld' : 'staff',
        }),
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
    const rankLabel = rank ? escapeHtml(rank) : '';
    const beheerItem =
        isBeheer() || isSuperUser()
            ? '<a href="/admin/" class="staff-user-menu-item"><i class="fas fa-cog"></i> Beheer</a>'
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
        (canViewDossiers() || isSuperUser()
            ? '<a href="/dossiers.html"' + (active === 'dossiers' ? ' class="active"' : '') + '>Dossiers</a>'
            : '') +
        (canViewWeapons() || isSuperUser()
            ? '<a href="/wapens.html"' + (active === 'wapens' ? ' class="active"' : '') + '>Wapens</a>'
            : '') +
        (isOnderwereldCoordinator() || isSuperUser()
            ? '<a href="/onderwereld.html"' + (active === 'onderwereld' ? ' class="active"' : '') + '>Onderwereld</a>'
            : '') +
        '</nav>' +
        '<div class="staff-actions">' +
        '<div class="staff-user-menu" id="staffUserMenu">' +
        '<button type="button" class="staff-user-menu-toggle" id="staffUserMenuToggle" aria-expanded="false" aria-haspopup="true">' +
        '<i class="fas fa-user"></i>' +
        '<span class="staff-user-menu-label">' +
        escapeHtml(userName()) +
        (rankLabel ? ' · ' + rankLabel : '') +
        '</span>' +
        '<i class="fas fa-chevron-down staff-user-menu-chevron" aria-hidden="true"></i>' +
        '</button>' +
        '<div class="staff-user-menu-dropdown" id="staffUserMenuDropdown" hidden>' +
        '<div class="staff-user-menu-header">' +
        '<strong>' +
        escapeHtml(userName()) +
        '</strong>' +
        (rankLabel ? '<span>' + rankLabel + '</span>' : '') +
        '</div>' +
        beheerItem +
        '<button type="button" class="staff-user-menu-item staff-user-menu-danger" onclick="logout()">' +
        '<i class="fas fa-sign-out-alt"></i> Uitloggen</button>' +
        '</div></div></div></div></div></header>'
    );
}

function bindUserMenu() {
    const menu = document.getElementById('staffUserMenu');
    const toggle = document.getElementById('staffUserMenuToggle');
    const dropdown = document.getElementById('staffUserMenuDropdown');
    if (!menu || !toggle || !dropdown) return;

    function closeMenu() {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        dropdown.hidden = true;
    }

    function openMenu() {
        menu.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        dropdown.hidden = false;
    }

    toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        if (menu.classList.contains('open')) closeMenu();
        else openMenu();
    });

    document.addEventListener('click', function (e) {
        if (!menu.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
    });
}

function mountHeader(active) {
    const el = document.getElementById('siteHeader');
    if (el) {
        el.innerHTML = renderHeader(active);
        bindUserMenu();
    }
}

function renderRegelItem(item) {
    if (typeof item === 'string') {
        return '<li><i class="fas fa-check-circle"></i> ' + escapeHtml(item) + '</li>';
    }
    var html =
        '<li class="staff-rule-item">' +
        '<div class="staff-rule-head">' +
        '<span class="staff-rule-num">' + escapeHtml(String(item.nummer || '')) + '</span>' +
        '<strong>' + escapeHtml(item.titel || '') + '</strong>' +
        '</div>';
    if (item.tekst) {
        html += '<p class="staff-rule-text">' + escapeHtml(item.tekst) + '</p>';
    }
    if (item.voorbeeld) {
        html += '<pre class="staff-rule-example">' + escapeHtml(item.voorbeeld) + '</pre>';
    }
    if (item.info) {
        html += '<p class="staff-rule-info"><i class="fas fa-info-circle"></i> ' + escapeHtml(item.info) + '</p>';
    }
    html += '</li>';
    return html;
}

function renderSanctieladder(ladder) {
    if (!ladder) return '';

    var sanctiesHtml = (ladder.sancties || [])
        .map(function (s) {
            return (
                '<div class="staff-sanctie-badge staff-sanctie-badge--' +
                escapeHtml(s.code.toLowerCase()) +
                '"><span class="staff-sanctie-code">' +
                escapeHtml(s.code) +
                '</span> ' +
                escapeHtml(s.naam) +
                '</div>'
            );
        })
        .join('');

    function listBlock(title, items, icon) {
        if (!items || !items.length) return '';
        return (
            '<div class="staff-sanctie-block">' +
            '<h4><i class="fas fa-' +
            icon +
            '"></i> ' +
            escapeHtml(title) +
            '</h4>' +
            '<ul class="staff-list">' +
            items
                .map(function (item) {
                    return '<li><i class="fas fa-angle-right"></i> ' + escapeHtml(item) + '</li>';
                })
                .join('') +
            '</ul></div>'
        );
    }

    return (
        '<div class="staff-rank-block staff-sanctieladder">' +
        '<div class="staff-rank-head"><h3>' +
        escapeHtml(ladder.titel || 'Sanctieladder') +
        '</h3></div>' +
        '<div class="staff-sanctie-badges">' +
        sanctiesHtml +
        '</div>' +
        listBlock('Belangrijke informatie', ladder.belangrijk, 'circle-info') +
        listBlock('W1 — Waarschuwing', ladder.w1, 'exclamation') +
        listBlock('W2 — Demote', ladder.w2, 'arrow-down') +
        listBlock('W3 — Ontslag', ladder.w3, 'ban') +
        listBlock('Staff Blacklist', ladder.blacklist, 'skull-crossbones') +
        (ladder.footer
            ? '<p class="staff-rule-footer"><i class="fas fa-check"></i> ' +
              escapeHtml(ladder.footer) +
              ' <a class="staff-rule-link" href="https://staff.utrechtroleplay.eu/" target="_blank" rel="noopener">Staffwebsite</a></p>'
            : '') +
        '</div>'
    );
}

function renderRegels(site, container) {
    var regels = site && site.regels ? site.regels : site;
    if (!regels || !regels.length) {
        container.innerHTML = '<p class="staff-empty">Nog geen regels ingesteld.</p>';
        return;
    }
    var html = regels
        .map(function (cat) {
            var items = (cat.items || []).map(renderRegelItem).join('');
            return (
                '<div class="staff-rank-block">' +
                '<div class="staff-rank-head"><h3>' +
                escapeHtml(cat.titel || 'Regels') +
                '</h3></div>' +
                '<ul class="staff-list staff-rule-list">' +
                items +
                '</ul></div>'
            );
        })
        .join('');

    html +=
        '<p class="staff-rule-footer"><i class="fas fa-check"></i> Aub vinkje zetten als je dit hebt gelezen. ' +
        '<a class="staff-rule-link" href="https://staff.utrechtroleplay.eu/" target="_blank" rel="noopener">Staffwebsite</a></p>';

    if (site && site.sanctieladder) {
        html += renderSanctieladder(site.sanctieladder);
    }

    container.innerHTML = html;
}

async function fetchDossiers() {
    const res = await fetch(SITE_API + '/api/staff-dossiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: accessToken() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Dossiers laden mislukt');
    return data;
}

async function saveDossiers(dossiers) {
    const res = await fetch(SITE_API + '/api/staff-dossiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: accessToken(), dossiers: dossiers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');
    return data.dossiers;
}

function dossierTypeLabel(type) {
    if (type === 'warn') return 'Staffwarn';
    if (type === 'ontslag') return 'Ontslag';
    if (type === 'bericht') return 'Bericht';
    return 'Notitie';
}

function dossierTypeClass(type) {
    return 'staff-dossier-entry--' + (type || 'notitie');
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

function functiePermList(items, label) {
    if (!items || !items.length) return '';
    var list = items
        .map(function (item) {
            return '<li><i class="fas fa-angle-right"></i> ' + escapeHtml(item) + '</li>';
        })
        .join('');
    return (
        (label ? '<p class="staff-functie-vanaf-label">' + escapeHtml(label) + '</p>' : '') +
        '<ul class="staff-list staff-functie-perms">' +
        list +
        '</ul>'
    );
}

function functieSectieLabel(sectie) {
    if (sectie.naam && sectie.nummer) {
        return sectie.nummer + '. ' + sectie.naam;
    }
    return sectie.naam || sectie.beschrijving || 'Sectie';
}

function renderFunctieExtraPanel(item, roleMap) {
    var html = roleIdList(item.rollen, roleMap);
    if (item.functie && item.functie.length) {
        html += functiePermList(item.functie, 'Functie:');
    }
    if (item.permissies && item.permissies.length) {
        html += functiePermList(item.permissies, 'Permissies:');
    }
    if (item.uitleg) {
        html += '<p class="staff-functie-uitleg">' + escapeHtml(item.uitleg) + '</p>';
    }
    if (item.vanaf && item.vanaf.length) {
        html +=
            '<p class="staff-functie-vanaf-label">Vereiste rang:</p>' +
            roleIdList(item.vanaf, roleMap);
    }
    if (item.vereiste) {
        html += '<p class="staff-functie-uitleg"><strong>Vereiste:</strong> ' + escapeHtml(item.vereiste) + '</p>';
    }
    return html;
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
        let panelInner = roleIdList(sectie.rollen, roleMap);
        if (sectie.permissies && sectie.permissies.length) {
            panelInner += functiePermList(sectie.permissies, 'Permissies:');
        }
        html +=
            '<div class="staff-functie-sectie">' +
            functieToggleHtml(functieSectieLabel(sectie), panelId, startOpen) +
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
            const toggleLabel = item.naam || item.uitleg || 'Extra rol';
            const panelInner = renderFunctieExtraPanel(item, roleMap);
            html +=
                '<div class="staff-functie-extra">' +
                functieToggleHtml(toggleLabel, panelId, false) +
                functiePanelHtml(panelId, panelInner, false) +
                '</div>';
        });
        if (data.extra.footer) {
            html +=
                '<p class="staff-rule-footer">' +
                '<a class="staff-rule-link" href="https://staff.utrechtroleplay.eu/" target="_blank" rel="noopener">Staffsite</a>' +
                '</p>';
        }
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
