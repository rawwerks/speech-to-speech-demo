class SilenceDetector {
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private microphone: MediaStreamAudioSourceNode | null = null;
    private dataArray: Uint8Array;
    private silenceThreshold: number;
    private minSilenceDuration: number;
    private silenceStartTime: number | null = null;
    private isRunning = false;

    constructor(options: {
        threshold?: number;  // 0-255, where 0 is complete silence
        minSilenceDuration?: number;  // milliseconds
    } = {}) {
        this.audioContext = new AudioContext();
        this.analyser = this.audioContext.createAnalyser();
        
        // Configure analyser
        this.analyser.fftSize = 2048;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        // Set defaults
        this.silenceThreshold = options.threshold ?? 30;
        this.minSilenceDuration = options.minSilenceDuration ?? 1500;
    }

    async start(): Promise<void> {
        try {
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create and connect nodes
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            // Start detection loop
            this.isRunning = true;
            this.detectSilence();
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            throw error;
        }
    }

    stop(): void {
        this.isRunning = false;
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
    }

    private detectSilence(): void {
        if (!this.isRunning) return;

        // Get current audio data
        this.analyser.getByteTimeDomainData(this.dataArray);
        
        // Calculate average amplitude
        const average = this.calculateAverageAmplitude();
        
        // Check for silence
        if (average <= this.silenceThreshold) {
            if (!this.silenceStartTime) {
                this.silenceStartTime = Date.now();
            } else if (Date.now() - this.silenceStartTime >= this.minSilenceDuration) {
                this.onSilenceDetected();
                this.silenceStartTime = null;
            }
        } else {
            this.silenceStartTime = null;
        }

        // Continue detection loop
        requestAnimationFrame(() => this.detectSilence());
    }

    private calculateAverageAmplitude(): number {
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            // Convert to signed (-128 to 127)
            const signed = this.dataArray[i] - 128;
            sum += Math.abs(signed);
        }
        return sum / this.dataArray.length;
    }

    private onSilenceDetected(): void {
        // Emit custom event
        const event = new CustomEvent('silence-detected');
        window.dispatchEvent(event);
    }
}

export default SilenceDetector;