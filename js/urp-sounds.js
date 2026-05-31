/**
 * Lokale UI-geluiden (alleen jij hoort ze, niet via de call).
 */
const URPSounds = (function () {
    let ctx = null;

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function tone(freq, duration, type, gain) {
        try {
            const ac = getCtx();
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            g.gain.setValueAtTime(gain || 0.12, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
            osc.connect(g);
            g.connect(ac.destination);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + duration);
        } catch (e) {
            /* geen geluid mogelijk */
        }
    }

    return {
        play: function (name) {
            if (name === 'mic-muted') {
                tone(380, 0.1, 'sine', 0.1);
                setTimeout(function () { tone(260, 0.12, 'sine', 0.08); }, 90);
            } else if (name === 'mic-unmuted') {
                tone(520, 0.08, 'sine', 0.09);
                setTimeout(function () { tone(680, 0.1, 'sine', 0.08); }, 70);
            } else if (name === 'leave-call') {
                tone(440, 0.1, 'sine', 0.1);
                setTimeout(function () { tone(330, 0.15, 'sine', 0.09); }, 100);
                setTimeout(function () { tone(220, 0.2, 'sine', 0.06); }, 220);
            }
        },
    };
})();
