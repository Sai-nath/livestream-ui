// Create a ringtone using Web Audio API
export const createRingtone = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);

    // Create a repeating pattern
    const startTime = audioContext.currentTime;
    const ringDuration = 0.1;
    const pauseDuration = 0.1;
    const totalDuration = 1;

    for (let time = 0; time < totalDuration; time += (ringDuration + pauseDuration)) {
        gainNode.gain.setValueAtTime(0, startTime + time);
        gainNode.gain.linearRampToValueAtTime(0.5, startTime + time + ringDuration * 0.1);
        gainNode.gain.setValueAtTime(0.5, startTime + time + ringDuration * 0.9);
        gainNode.gain.linearRampToValueAtTime(0, startTime + time + ringDuration);
    }

    oscillator.start(startTime);
    oscillator.stop(startTime + totalDuration);

    return { 
        oscillator, 
        gainNode, 
        audioContext,
        stop: () => {
            try {
                if (oscillator.playbackState !== 'finished') {
                    oscillator.stop();
                }
                if (audioContext.state !== 'closed') {
                    audioContext.close();
                }
            } catch (error) {
                console.warn('Error stopping ringtone:', error);
            }
        }
    };
};
