/**
 * URP Call — custom WebRTC audio (geen Jitsi)
 */
function URPCall(options) {
    this.roomId = options.roomId;
    this.container = options.container;
    this.peerId = options.peerId || discordId();
    this.displayName = options.displayName || userName();
    this.avatarUrl = options.avatarUrl || avatarUrl();
    this.accessToken = options.accessToken || accessToken();
    this.isStaff = options.isStaff || isStaff();
    this.connections = new Map();
    this.localStream = null;
    this.lastSignalId = '';
    this.pollTimer = null;
    this.heartbeatTimer = null;
    this.muted = false;
    this.active = false;
    this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
}

URPCall.prototype.api = async function (action, body) {
    if (action === 'poll') {
        const q = new URLSearchParams({
            accessToken: this.accessToken,
            action: 'poll',
            roomId: this.roomId,
            since: this.lastSignalId,
        });
        const r = await fetch(SITE_API + '/api/rtc-room?' + q.toString());
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Poll mislukt');
        return data;
    }
    const res = await fetch(SITE_API + '/api/rtc-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
            Object.assign({ accessToken: this.accessToken, action: action, roomId: this.roomId }, body || {})
        ),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'URP Call API mislukt');
    return data;
};

URPCall.prototype.renderShell = function () {
    this.container.innerHTML =
        '<div class="urp-call">' +
        '<div class="urp-call-header">' +
        '<div class="urp-call-brand"><i class="fas fa-broadcast-tower"></i> URP Call</div>' +
        '<span class="urp-call-room" id="urpCallRoomLabel"></span></div>' +
        '<div class="urp-call-participants" id="urpCallParticipants"></div>' +
        '<div class="urp-call-controls">' +
        '<button type="button" class="urp-call-btn" id="urpBtnMute" title="Microfoon"><i class="fas fa-microphone"></i></button>' +
        '<button type="button" class="urp-call-btn urp-call-btn-leave" id="urpBtnLeave" title="Gesprek verlaten"><i class="fas fa-phone-slash"></i></button>' +
        '</div>' +
        '<p class="urp-call-status" id="urpCallStatus">Verbinden…</p></div>';
    this.container.querySelector('#urpCallRoomLabel').textContent = this.roomId;
    const self = this;
    this.container.querySelector('#urpBtnMute').onclick = function () {
        self.toggleMute();
    };
    this.container.querySelector('#urpBtnLeave').onclick = function () {
        self.stop();
    };
};

URPCall.prototype.updateParticipants = function (roster) {
    const el = this.container.querySelector('#urpCallParticipants');
    const local = renderParticipantTile({
        id: this.peerId,
        name: this.displayName + (this.isStaff ? ' (Staff)' : ''),
        avatarUrl: this.avatarUrl,
        local: true,
        muted: this.muted,
    });
    const remote = (roster || [])
        .map(function (p) {
            return renderParticipantTile({
                id: p.id,
                name: p.name + (p.isStaff ? ' (Staff)' : ''),
                avatarUrl: p.avatarUrl,
                local: false,
            });
        })
        .join('');
    el.innerHTML = local + remote;
};

function renderParticipantTile(p) {
    const av = p.avatarUrl
        ? '<img src="' + escapeHtml(p.avatarUrl) + '" alt="">'
        : '<span class="urp-call-av-ph"><i class="fas fa-user"></i></span>';
    return (
        '<div class="urp-call-tile' +
        (p.local ? ' urp-call-tile-local' : '') +
        '" data-id="' +
        escapeHtml(p.id) +
        '">' +
        av +
        '<span class="urp-call-tile-name">' +
        escapeHtml(p.name) +
        '</span>' +
        (p.muted ? '<span class="urp-call-muted-badge"><i class="fas fa-microphone-slash"></i></span>' : '') +
        '</div>'
    );
}

URPCall.prototype.setStatus = function (text) {
    const el = this.container.querySelector('#urpCallStatus');
    if (el) el.textContent = text;
};

URPCall.prototype.toggleMute = function () {
    this.muted = !this.muted;
    if (typeof URPSounds !== 'undefined') {
        URPSounds.play(this.muted ? 'mic-muted' : 'mic-unmuted');
    }
    if (this.localStream) {
        this.localStream.getAudioTracks().forEach(function (t) {
            t.enabled = !this.muted;
        }, this);
    }
    this.updateParticipants(this._lastRoster || []);
    const btn = this.container.querySelector('#urpBtnMute');
    if (btn) {
        btn.classList.toggle('urp-call-btn-muted', this.muted);
        btn.innerHTML = this.muted
            ? '<i class="fas fa-microphone-slash"></i>'
            : '<i class="fas fa-microphone"></i>';
    }
};

URPCall.prototype.sendSignal = async function (to, type, data) {
    await this.api('signal', { to: to, type: type, data: data });
};

URPCall.prototype.createPeerConnection = function (remoteId) {
    const self = this;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    if (this.localStream) {
        this.localStream.getTracks().forEach(function (t) {
            pc.addTrack(t, self.localStream);
        });
    }
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.playsInline = true;
    pc.ontrack = function (e) {
        audio.srcObject = e.streams[0];
    };
    pc.onicecandidate = function (e) {
        if (e.candidate) self.sendSignal(remoteId, 'ice', e.candidate);
    };
    const polite = self.peerId > remoteId;
    pc.onnegotiationneeded = async function () {
        try {
            if (!polite) return;
            await pc.setLocalDescription(await pc.createOffer());
            await self.sendSignal(remoteId, 'offer', pc.localDescription);
        } catch (err) {
            console.warn('negotiation', err);
        }
    };
    this.connections.set(remoteId, { pc: pc, audio: audio, polite: polite, makingOffer: false });
    return pc;
};

URPCall.prototype.handleSignal = async function (sig) {
    const remoteId = sig.from;
    let conn = this.connections.get(remoteId);
    if (!conn) {
        this.createPeerConnection(remoteId);
        conn = this.connections.get(remoteId);
    }
    const pc = conn.pc;
    try {
        if (sig.type === 'offer') {
            const polite = this.peerId > remoteId;
            if (pc.signalingState !== 'stable' && !polite) return;
            await pc.setRemoteDescription(sig.data);
            await pc.setLocalDescription(await pc.createAnswer());
            await this.sendSignal(remoteId, 'answer', pc.localDescription);
        } else if (sig.type === 'answer') {
            await pc.setRemoteDescription(sig.data);
        } else if (sig.type === 'ice' && sig.data) {
            try {
                await pc.addIceCandidate(sig.data);
            } catch (e) {
                /* ignore stale ice */
            }
        }
    } catch (err) {
        console.warn('signal handle', sig.type, err);
    }
};

URPCall.prototype.syncRoster = async function (roster) {
    const self = this;
    const ids = new Set((roster || []).map(function (p) {
        return p.id;
    }));
    roster.forEach(function (p) {
        if (p.id === self.peerId) return;
        if (!self.connections.has(p.id)) self.createPeerConnection(p.id);
    });
    self.connections.forEach(function (_conn, id) {
        if (!ids.has(id)) {
            _conn.pc.close();
            self.connections.delete(id);
        }
    });
    self._lastRoster = roster;
    self.updateParticipants(roster);
};

URPCall.prototype.poll = async function () {
    if (!this.active) return;
    try {
        const data = await this.api('poll');
        for (const sig of data.signals || []) {
            if (sig.id > this.lastSignalId) this.lastSignalId = sig.id;
            await this.handleSignal(sig);
        }
        await this.syncRoster(data.roster || []);
        const n = (data.roster || []).length;
        this.setStatus(n ? 'Verbonden met ' + n + ' andere(n) in URP Call' : 'Wachten op anderen in de kamer…');
    } catch (e) {
        this.setStatus(e.message);
    }
};

URPCall.prototype.start = async function () {
    if (this.active) return;
    this.active = true;
    this.renderShell();
    try {
        const cfg = await fetch(
            SITE_API +
                '/api/rtc-room?action=config&accessToken=' +
                encodeURIComponent(this.accessToken) +
                '&roomId=' +
                encodeURIComponent(this.roomId)
        ).then(function (r) {
            return r.json();
        });
        if (cfg.iceServers) this.iceServers = cfg.iceServers;
    } catch (e) {
        /* default stun */
    }
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    await this.api('join', {
        peer: {
            id: this.peerId,
            name: this.displayName,
            avatarUrl: this.avatarUrl,
            isStaff: this.isStaff,
        },
    });
    this.setStatus('URP Call actief — microfoon aan');
    const self = this;
    this.pollTimer = setInterval(function () {
        self.poll();
    }, 900);
    this.heartbeatTimer = setInterval(function () {
        self.api('heartbeat').catch(function () {});
    }, 15000);
    await this.poll();
};

URPCall.prototype.stop = async function () {
    if (typeof URPSounds !== 'undefined') {
        URPSounds.play('leave-call');
    }
    this.active = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.connections.forEach(function (c) {
        c.pc.close();
    });
    this.connections.clear();
    if (this.localStream) {
        this.localStream.getTracks().forEach(function (t) {
            t.stop();
        });
        this.localStream = null;
    }
    try {
        await this.api('leave');
    } catch (e) {
        /* ignore */
    }
    if (this.container) {
        this.container.innerHTML = '<p class="staff-empty">Gesprek beëindigd.</p>';
    }
};

const activeCalls = {};

function startURPCall(containerId, roomId) {
    if (activeCalls[containerId]) {
        activeCalls[containerId].stop();
    }
    const el = document.getElementById(containerId);
    if (!el) return null;
    const call = new URPCall({ roomId: roomId, container: el });
    activeCalls[containerId] = call;
    call.start().catch(function (err) {
        el.innerHTML = '<p class="staff-empty">' + escapeHtml(err.message) + '</p>';
    });
    return call;
}

function stopURPCall(containerId) {
    if (activeCalls[containerId]) {
        activeCalls[containerId].stop();
        delete activeCalls[containerId];
    }
}
