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
    this._speaking = new Set();
    this._localAnalyser = null;
    this._vadTimer = null;
    this._audioCtx = null;
    this._lastRosterKey = '';
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
        if (typeof disconnectFromChannel === 'function' && connectedChannelId) {
            disconnectFromChannel();
        }
    };
};

URPCall.prototype.isPeerSpeaking = function (peerId) {
    return this._speaking && this._speaking.has(peerId);
};

URPCall.prototype.updateParticipants = function (roster) {
    const el = this.container.querySelector('#urpCallParticipants');
    if (!el) return;
    const speaking = this._speaking || new Set();
    const local = renderParticipantTile({
        id: this.peerId,
        name: this.displayName + (this.isStaff ? ' (Staff)' : ''),
        avatarUrl: this.avatarUrl,
        local: true,
        muted: this.muted,
        speaking: speaking.has(this.peerId),
    });
    const remote = (roster || [])
        .map(function (p) {
            return renderParticipantTile({
                id: p.id,
                name: p.name + (p.isStaff ? ' (Staff)' : ''),
                avatarUrl: p.avatarUrl,
                local: false,
                speaking: speaking.has(p.id),
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
        (p.speaking ? ' urp-call-tile-speaking' : '') +
        '" data-id="' +
        escapeHtml(p.id) +
        '">' +
        av +
        '<span class="urp-call-tile-name">' +
        escapeHtml(p.name) +
        '</span>' +
        '<span class="urp-call-speaking-badge"><i class="fas fa-volume-high"></i> Spreekt</span>' +
        (p.muted ? '<span class="urp-call-muted-badge"><i class="fas fa-microphone-slash"></i></span>' : '') +
        '</div>'
    );
}

URPCall.prototype.getVolumeLevel = function (analyser) {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return sum / data.length / 255;
};

URPCall.prototype.ensureAudioContext = function () {
    if (this._audioCtx) return this._audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this._audioCtx = new AC();
    if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
    return this._audioCtx;
};

URPCall.prototype.attachStreamAnalyser = function (stream) {
    const ac = this.ensureAudioContext();
    if (!ac || !stream) return null;
    try {
        const source = ac.createMediaStreamSource(stream);
        const analyser = ac.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);
        return analyser;
    } catch (e) {
        return null;
    }
};

URPCall.prototype.attachRemoteAnalyser = function (remoteId, stream) {
    const conn = this.connections.get(remoteId);
    if (!conn || !stream) return;
    conn.analyser = this.attachStreamAnalyser(stream);
};

URPCall.prototype.startVoiceMonitoring = function () {
    const self = this;
    if (self._vadTimer) clearInterval(self._vadTimer);
    self._speaking = new Set();
    if (self.localStream) {
        self._localAnalyser = self.attachStreamAnalyser(self.localStream);
    }
    self._vadTimer = setInterval(function () {
        self.tickVoiceActivity();
    }, 80);
};

URPCall.prototype.tickVoiceActivity = function () {
    const threshold = 0.045;
    const next = new Set();
    if (this._localAnalyser && !this.muted) {
        if (this.getVolumeLevel(this._localAnalyser) > threshold) next.add(this.peerId);
    }
    const self = this;
    this.connections.forEach(function (conn, id) {
        if (conn.analyser && self.getVolumeLevel(conn.analyser) > threshold) next.add(id);
    });
    this._speaking = next;
    this.applySpeakingUI();
};

URPCall.prototype.applySpeakingUI = function () {
    const el = this.container.querySelector('#urpCallParticipants');
    if (!el) return;
    const speaking = this._speaking || new Set();
    el.querySelectorAll('.urp-call-tile').forEach(function (tile) {
        const id = tile.getAttribute('data-id');
        const isSpeaking = speaking.has(id);
        tile.classList.toggle('urp-call-tile-speaking', isSpeaking);
        const badge = tile.querySelector('.urp-call-speaking-badge');
        if (badge) badge.hidden = !isSpeaking;
    });
};

URPCall.prototype.stopVoiceMonitoring = function () {
    if (this._vadTimer) clearInterval(this._vadTimer);
    this._vadTimer = null;
    this._localAnalyser = null;
    this._speaking = new Set();
    if (this._audioCtx) {
        this._audioCtx.close().catch(function () {});
        this._audioCtx = null;
    }
};

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

function sessionToJson(desc) {
    if (!desc) return null;
    return { type: desc.type, sdp: desc.sdp };
}

function iceToJson(candidate) {
    return candidate && candidate.toJSON ? candidate.toJSON() : candidate;
}

URPCall.prototype.shouldInitiateOffer = function (remoteId) {
    return String(this.peerId) > String(remoteId);
};

URPCall.prototype.flushIceQueue = async function (conn) {
    const pc = conn.pc;
    const queue = conn.iceQueue || [];
    conn.iceQueue = [];
    for (let i = 0; i < queue.length; i++) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(queue[i]));
        } catch (e) {
            /* stale ice */
        }
    }
};

URPCall.prototype.queueIceCandidate = async function (conn, data) {
    if (!data) return;
    const pc = conn.pc;
    if (!pc.remoteDescription) {
        conn.iceQueue = conn.iceQueue || [];
        conn.iceQueue.push(data);
        return;
    }
    try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
    } catch (e) {
        /* ignore */
    }
};

URPCall.prototype.playRemoteAudio = function (audio) {
    if (!audio) return;
    audio.muted = false;
    audio.volume = 1;
    const p = audio.play();
    if (p && p.catch) {
        p.catch(function () {
            /* browser blokkeert soms tot interactie */
        });
    }
};

URPCall.prototype.initiateOffer = async function (remoteId) {
    const conn = this.connections.get(remoteId);
    if (!conn || !this.localStream) return;
    const pc = conn.pc;
    if (pc.signalingState !== 'stable' || conn.makingOffer) return;
    conn.makingOffer = true;
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.sendSignal(remoteId, 'offer', sessionToJson(pc.localDescription));
    } catch (err) {
        console.warn('offer', remoteId, err);
    } finally {
        conn.makingOffer = false;
    }
};

URPCall.prototype.createPeerConnection = function (remoteId) {
    const self = this;
    if (this.connections.has(remoteId)) return this.connections.get(remoteId).pc;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    if (this.localStream) {
        this.localStream.getTracks().forEach(function (t) {
            pc.addTrack(t, self.localStream);
        });
    }

    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.dataset.remotePeer = remoteId;
    audio.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
    if (this.container) this.container.appendChild(audio);

    pc.ontrack = function (e) {
        if (!e.streams[0]) return;
        audio.srcObject = e.streams[0];
        self.playRemoteAudio(audio);
        self.attachRemoteAnalyser(remoteId, e.streams[0]);
    };

    pc.onicecandidate = function (e) {
        if (e.candidate) {
            self.sendSignal(remoteId, 'ice', iceToJson(e.candidate)).catch(function () {});
        }
    };

    pc.onconnectionstatechange = function () {
        if (pc.connectionState === 'connected') {
            self.setStatus('Audio verbonden — je kunt praten');
        } else if (pc.connectionState === 'failed') {
            self.setStatus('Verbinding mislukt — probeer opnieuw te verbinden');
        }
    };

    const conn = { pc: pc, audio: audio, iceQueue: [], makingOffer: false };
    this.connections.set(remoteId, conn);

    if (this.shouldInitiateOffer(remoteId)) {
        setTimeout(function () {
            self.initiateOffer(remoteId);
        }, 80);
    }

    return pc;
};

URPCall.prototype.ensureConnection = function (remoteId) {
    if (!this.connections.has(remoteId)) {
        this.createPeerConnection(remoteId);
    }
    return this.connections.get(remoteId);
};

URPCall.prototype.handleSignal = async function (sig) {
    const remoteId = sig.from;
    const conn = this.ensureConnection(remoteId);
    const pc = conn.pc;

    try {
        if (sig.type === 'offer' && sig.data) {
            if (pc.signalingState === 'have-local-offer') {
                await pc.setLocalDescription({ type: 'rollback' });
            }
            await pc.setRemoteDescription(new RTCSessionDescription(sig.data));
            await this.flushIceQueue(conn);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this.sendSignal(remoteId, 'answer', sessionToJson(pc.localDescription));
        } else if (sig.type === 'answer' && sig.data) {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.data));
            await this.flushIceQueue(conn);
        } else if (sig.type === 'ice') {
            await this.queueIceCandidate(conn, sig.data);
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
        self.createPeerConnection(p.id);
    });
    self.connections.forEach(function (_conn, id) {
        if (!ids.has(id)) {
            _conn.pc.close();
            if (_conn.audio && _conn.audio.parentNode) _conn.audio.parentNode.removeChild(_conn.audio);
            self.connections.delete(id);
        }
    });
    self._lastRoster = roster;
    const rosterKey = (roster || [])
        .map(function (p) {
            return p.id;
        })
        .sort()
        .join(',');
    if (rosterKey !== self._lastRosterKey) {
        self._lastRosterKey = rosterKey;
        self.updateParticipants(roster);
        self.applySpeakingUI();
    }
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
    this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
        video: false,
    });
    if (this._audioCtx && this._audioCtx.state === 'suspended') {
        await this._audioCtx.resume();
    }
    this.startVoiceMonitoring();
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
    }, 450);
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
    this.stopVoiceMonitoring();
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.connections.forEach(function (c) {
        c.pc.close();
        if (c.audio && c.audio.parentNode) c.audio.parentNode.removeChild(c.audio);
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
