export class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicOscillators = [];
        this.isPlayingMusic = false;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.5; // Master volume
        this.initialized = true;
    }

    playTone(freq, type, duration, startTime = 0) {
        if (!this.initialized) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

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
        if (!this.initialized) this.init();
        this.playTone(880, 'sine', 0.1);
        this.playTone(1760, 'sine', 0.1, 0.1);
    }

    playShoot() {
        if (!this.initialized) this.init();
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
        if (!this.initialized) this.init();
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
        if (!this.initialized) this.init();
        if (this.musicTimeout) clearTimeout(this.musicTimeout);
        // Ensure context is valid
        if (!this.ctx) return;
        
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
            
            // Double check context state
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(e => console.error(e));
            }

            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'square'; // Retro sound
                osc.frequency.value = melody[noteIndex];

                // Short staccato notes
                gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.1);
            } catch (e) {
                console.error("Error playing note:", e);
            }

            noteIndex = (noteIndex + 1) % melody.length;

            // 150 BPM 16th notes approx
            this.musicTimeout = setTimeout(playNextNote, 100);
        };

        playNextNote();
    }

    async startMusic() {
        if (!this.initialized) this.init();

        // Always try to resume context first
        if (this.ctx.state === 'suspended') {
            try {
                await this.ctx.resume();
            } catch (e) {
                console.error('Failed to resume audio context', e);
            }
        }
        
        // If context is closed, try to recreate it (rare but possible)
        if (this.ctx.state === 'closed') {
             this.init();
        }

        if (this.isPlayingMusic) return;
        this.isPlayingMusic = true;
        this.playNormalMusic();
    }

    playBossMusic() {
        if (!this.initialized) this.init();
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

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
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

    playMenuMusic() {
        if (!this.initialized) this.init();
        if (this.musicTimeout) clearTimeout(this.musicTimeout);
        // Ensure context is valid
        if (!this.ctx) return;
        
        // Catchy Menu Theme - Upbeat and energetic
        // Using a mix of bass and melody notes for a full sound
        const bassLine = [
            130.81, 130.81, 146.83, 164.81, // C3, C3, D3, E3
            130.81, 130.81, 146.83, 164.81, // Repeat
        ];
        
        const melody = [
            523.25, 659.25, 783.99, 659.25, // C5, E5, G5, E5
            523.25, 659.25, 783.99, 1046.50, // C5, E5, G5, C6
        ];

        let noteIndex = 0;

        const playNextNote = () => {
            if (!this.isPlayingMusic) return;
            
            // Double check context state
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(e => console.error(e));
            }

            try {
                // Play bass note
                const bassOsc = this.ctx.createOscillator();
                const bassGain = this.ctx.createGain();
                bassOsc.type = 'triangle';
                bassOsc.frequency.value = bassLine[noteIndex % bassLine.length];
                bassGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
                bassGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
                bassOsc.connect(bassGain);
                bassGain.connect(this.masterGain);
                bassOsc.start();
                bassOsc.stop(this.ctx.currentTime + 0.25);

                // Play melody note (slightly offset for rhythm)
                setTimeout(() => {
                    if (!this.isPlayingMusic) return;
                    const melOsc = this.ctx.createOscillator();
                    const melGain = this.ctx.createGain();
                    melOsc.type = 'square';
                    melOsc.frequency.value = melody[noteIndex % melody.length];
                    melGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                    melGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
                    melOsc.connect(melGain);
                    melGain.connect(this.masterGain);
                    melOsc.start();
                    melOsc.stop(this.ctx.currentTime + 0.15);
                }, 50);

            } catch (e) {
                console.error("Error playing menu note:", e);
            }

            noteIndex = (noteIndex + 1) % Math.max(bassLine.length, melody.length);

            // 140 BPM - Catchy upbeat tempo
            this.musicTimeout = setTimeout(playNextNote, 200);
        };

        playNextNote();
    }

    async startMenuMusic() {
        if (!this.initialized) this.init();

        // Always try to resume context first
        if (this.ctx.state === 'suspended') {
            try {
                await this.ctx.resume();
            } catch (e) {
                console.error('Failed to resume audio context', e);
            }
        }
        
        // If context is closed, try to recreate it
        if (this.ctx.state === 'closed') {
             this.init();
        }

        if (this.isPlayingMusic) return;
        this.isPlayingMusic = true;
        this.playMenuMusic();
    }
}
