class SilenceDetector {
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private microphone: MediaStreamAudioSourceNode | null = null;
    private dataArray: Uint8Array;
    private silenceThreshold: number;
    private minSilenceDuration: number;
    private silenceStartTime: number | null = null;
    private isRunning = false;
    private recordingStartTime: number | null = null;
    private minRecordingDuration: number;

    constructor(options: {
        threshold?: number;  // 0-255, where 0 is complete silence
        minSilenceDuration?: number;  // milliseconds
        minRecordingDuration?: number;  // milliseconds
    } = {}) {
        this.audioContext = new AudioContext();
        this.analyser = this.audioContext.createAnalyser();
        
        // Configure analyser
        this.analyser.fftSize = 2048;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        // Set defaults
        this.silenceThreshold = options.threshold ?? 30;
        this.minSilenceDuration = options.minSilenceDuration ?? 1500;
        this.minRecordingDuration = options.minRecordingDuration ?? 2000;

        console.log(`SilenceDetector initialized with:
            threshold: ${this.silenceThreshold}
            minSilenceDuration: ${this.minSilenceDuration}ms
            minRecordingDuration: ${this.minRecordingDuration}ms`);
    }

    async start(): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            this.isRunning = true;
            this.recordingStartTime = Date.now();
            console.log(`Recording started at: ${this.recordingStartTime}`);
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
        this.recordingStartTime = null;
        this.silenceStartTime = null;
        console.log('SilenceDetector stopped');
    }

    private detectSilence(): void {
        if (!this.isRunning) return;

        this.analyser.getByteTimeDomainData(this.dataArray);
        const average = this.calculateAverageAmplitude();
        
        const currentTime = Date.now();
        const recordingDuration = this.recordingStartTime ? currentTime - this.recordingStartTime : 0;

        console.log(`Current amplitude: ${average.toFixed(2)}, Recording duration: ${recordingDuration}ms`);

        if (recordingDuration >= this.minRecordingDuration) {
            if (average <= this.silenceThreshold) {
                if (!this.silenceStartTime) {
                    this.silenceStartTime = currentTime;
                    console.log(`Silence started at: ${this.silenceStartTime}`);
                } else {
                    const silenceDuration = currentTime - this.silenceStartTime;
                    console.log(`Silence duration: ${silenceDuration}ms`);
                    if (silenceDuration >= this.minSilenceDuration) {
                        console.log(`Silence detected for ${silenceDuration}ms, stopping recording`);
                        this.onSilenceDetected();
                        return;  // Stop the detection loop
                    }
                }
            } else {
                if (this.silenceStartTime) {
                    console.log(`Silence ended, duration was less than ${this.minSilenceDuration}ms`);
                }
                this.silenceStartTime = null;
            }
        }

        requestAnimationFrame(() => this.detectSilence());
    }

    private calculateAverageAmplitude(): number {
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            const signed = this.dataArray[i] - 128;
            sum += Math.abs(signed);
        }
        return sum / this.dataArray.length;
    }

    private onSilenceDetected(): void {
        const event = new CustomEvent('silence-detected');
        window.dispatchEvent(event);
    }
}

export default SilenceDetector;