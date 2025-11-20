export class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.3; // Lower volume
        this.musicOscillators = [];
        this.isPlayingMusic = false;
    }

    playTone(freq, type, duration, startTime = 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    playCollect() {
        this.playTone(880, 'sine', 0.1);
        this.playTone(1760, 'sine', 0.1, 0.1);
    }

    playShoot() {
        this.playTone(400, 'sawtooth', 0.1);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playExplosion() {
        // White noise buffer for explosion
        const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        noise.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    }

    playNormalMusic() {
        if (this.musicTimeout) clearTimeout(this.musicTimeout);
        if (!this.ctx || !this.isPlayingMusic) return;

        // Catchier Arcade Melody (Arpeggio)
        // C Minor Pentatonic: C, Eb, F, G, Bb
        const melody = [
            261.63, 311.13, 392.00, 523.25, // C4, Eb4, G4, C5
            311.13, 392.00, 523.25, 622.25, // Eb4, G4, C5, Eb5
            392.00, 523.25, 622.25, 783.99, // G4, C5, Eb5, G5
            523.25, 392.00, 311.13, 261.63  // C5, G4, Eb4, C4
        ];

        let noteIndex = 0;

        const playNextNote = () => {
            if (!this.isPlayingMusic) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square'; // Retro sound
            osc.frequency.value = melody[noteIndex];

            // Short staccato notes
            gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.1);

            noteIndex = (noteIndex + 1) % melody.length;

            // 150 BPM 16th notes approx
            this.musicTimeout = setTimeout(playNextNote, 100);
        };

        playNextNote();
    }

    startMusic() {
        if (this.isPlayingMusic) return;
        this.isPlayingMusic = true;
        this.playNormalMusic();
    }

    playBossMusic() {
        if (this.musicTimeout) clearTimeout(this.musicTimeout);
        if (!this.ctx || !this.isPlayingMusic) return;

        // Menacing Sawtooth Bass
        const melody = [110, 103, 98, 103]; // A2, G#2, G2, G#2
        let noteIndex = 0;

        const playNextNote = () => {
            if (!this.isPlayingMusic) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.value = melody[noteIndex];

            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.2);

            noteIndex = (noteIndex + 1) % melody.length;
            this.musicTimeout = setTimeout(playNextNote, 200); // Faster tempo
        };

        playNextNote();
    }

    stopMusic() {
        this.isPlayingMusic = false;
        if (this.musicTimeout) {
            clearTimeout(this.musicTimeout);
            this.musicTimeout = null;
        }
    }
}
