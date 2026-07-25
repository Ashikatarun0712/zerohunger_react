export function playSuccessSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(ctx.destination);
    
    const playTone = (freq, type, startTime, duration, vol = 1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // A magical, encouraging victory fanfare (C major ascending fast, then a big sparkly chord)
    // Fast ascending run
    playTone(392.00, 'sine', 0.0, 0.15); // G4
    playTone(523.25, 'sine', 0.1, 0.15); // C5
    playTone(659.25, 'sine', 0.2, 0.15); // E5
    
    // The big victory chord at the end (C6 + G5 + E5 + C5)
    playTone(1046.50, 'triangle', 0.35, 0.8, 0.8); // C6
    playTone(783.99, 'sine', 0.35, 0.8, 0.6);  // G5
    playTone(659.25, 'sine', 0.35, 0.8, 0.6);  // E5
    playTone(523.25, 'square', 0.35, 0.8, 0.2); // C5 (adds body)
    
  } catch (err) {
    console.error("Audio playback failed:", err);
  }
}

export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    
    const playTone = (freq, type, startTime, duration, vol = 1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // A subtle, pleasant notification chime (pop-up sound)
    playTone(659.25, 'sine', 0.0, 0.15, 0.8); // E5
    playTone(880.00, 'sine', 0.1, 0.3, 0.6); // A5
    
  } catch (err) {
    console.error("Notification audio failed:", err);
  }
}
