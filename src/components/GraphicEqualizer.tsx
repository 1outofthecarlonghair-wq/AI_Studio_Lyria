import React, { useState, useEffect, useRef } from 'react';

// Standard 12 bands for graphic equalization
export interface BandConfig {
  frequency: number;
  label: string;
  type: 'Sub' | 'Bass' | 'Mids' | 'Highs' | 'Treble' | 'Air';
}

export const EQ_BANDS: BandConfig[] = [
  { frequency: 32, label: '32Hz', type: 'Sub' },
  { frequency: 64, label: '64Hz', type: 'Sub' },
  { frequency: 125, label: '125Hz', type: 'Bass' },
  { frequency: 250, label: '250Hz', type: 'Bass' },
  { frequency: 500, label: '500Hz', type: 'Mids' },
  { frequency: 1000, label: '1kHz', type: 'Mids' },
  { frequency: 2000, label: '2kHz', type: 'Highs' },
  { frequency: 4000, label: '4kHz', type: 'Highs' },
  { frequency: 6000, label: '6kHz', type: 'Treble' },
  { frequency: 8000, label: '8kHz', type: 'Treble' },
  { frequency: 12000, label: '12kHz', type: 'Treble' },
  { frequency: 16000, label: '16kHz', type: 'Air' }
];

export interface Preset {
  name: string;
  gains: number[];
}

export const EQ_PRESETS: Preset[] = [
  { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost', gains: [9, 8, 7, 5, 2, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Treble Boost', gains: [-1, -1, 0, 0, 0, 1, 2, 4, 6, 8, 8, 7] },
  { name: 'Vocal', gains: [-4, -2, 0, 2, 5, 6, 5, 4, 2, 0, 0, 0] },
  { name: 'Dance', gains: [7, 6, 5, 0, -2, -1, 1, 3, 5, 6, 6, 4] },
  { name: 'Rock', gains: [5, 4, 3, -1, -2, -1, 1, 3, 4, 5, 5, 3] },
  { name: 'Ambient', gains: [2, 3, 3, 2, 1, 2, 3, 3, 2, 1, 0, 0] },
  { name: 'Pop', gains: [-2, 0, 2, 4, 2, -1, -1, 1, 3, 3, 2, 0] },
  { name: 'Lofi Solo', gains: [4, 4, 3, 1, -1, -2, -1, 0, 2, 3, 1, 0] }
];

// Single WeakMap to manage and prevent multiple source node connection errors
const connectedElements = new WeakMap<HTMLAudioElement, {
  source: MediaElementAudioSourceNode;
  filters: BiquadFilterNode[];
  analyser: AnalyserNode;
}>();

let globalAudioCtx: AudioContext | null = null;
const getAudioContext = (): AudioContext => {
  if (!globalAudioCtx) {
    globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return globalAudioCtx;
};

// Internal connection helper
const connectEqualizer = (audioEl: HTMLAudioElement): { filters: BiquadFilterNode[], analyser: AnalyserNode } | null => {
  try {
    const ctx = getAudioContext();
    
    if (connectedElements.has(audioEl)) {
      const cached = connectedElements.get(audioEl)!;
      return { filters: cached.filters, analyser: cached.analyser };
    }

    const source = ctx.createMediaElementSource(audioEl);
    const filters: BiquadFilterNode[] = [];

    EQ_BANDS.forEach((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.setValueAtTime(band.frequency, ctx.currentTime);
      filter.Q.setValueAtTime(1.0, ctx.currentTime); // Standard graphical EQ bandwidth
      filter.gain.setValueAtTime(0, ctx.currentTime);
      filters.push(filter);
    });

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256; // 128 frequency bins

    // Chain source -> filter 0 -> filter 1 -> ... -> filter 11 -> analyser -> destination
    source.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filters[filters.length - 1].connect(analyser);
    analyser.connect(ctx.destination);

    connectedElements.set(audioEl, { source, filters, analyser });
    return { filters, analyser };
  } catch (err) {
    console.error("Equalizer initialization error:", err);
    return null;
  }
};

interface GraphicEqualizerProps {
  /** The DOM ID of the actual HTMLAudioElement to hook up */
  audioElementId: string;
}

export const GraphicEqualizer: React.FC<GraphicEqualizerProps> = ({ audioElementId }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('Flat');
  const [gains, setGains] = useState<number[]>(EQ_PRESETS[0].gains);
  const [isBypassed, setIsBypassed] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Resume the AudioContext safely
  const resumeContext = async (ctx: AudioContext) => {
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn("Failed to resume Web Audio Context:", e);
      }
    }
  };

  const connectAndGetFilters = (audioEl: HTMLAudioElement): BiquadFilterNode[] | null => {
    const res = connectEqualizer(audioEl);
    return res ? res.filters : null;
  };

  // Update gains on active filters
  const applyGains = (targetGains: number[], bypass: boolean = false) => {
    const audioEl = document.getElementById(audioElementId) as HTMLAudioElement;
    if (!audioEl) return;

    const filters = connectAndGetFilters(audioEl);
    if (!filters) return;

    const ctx = getAudioContext();
    resumeContext(ctx);

    filters.forEach((filter, index) => {
      const targetGain = bypass ? 0 : targetGains[index];
      try {
        filter.gain.setValueAtTime(targetGain, ctx.currentTime);
      } catch (e) {
        filter.gain.value = targetGain;
      }
    });
  };

  // Link EQ parameters to the audio tag on mount/play
  useEffect(() => {
    const audioEl = document.getElementById(audioElementId) as HTMLAudioElement;
    if (!audioEl) return;

    // Connect immediately so it's ready
    connectAndGetFilters(audioEl);
    applyGains(gains, isBypassed);

    // Resume when playing
    const handlePlay = () => {
      const ctx = getAudioContext();
      resumeContext(ctx);
    };

    audioEl.addEventListener('play', handlePlay);

    return () => {
      audioEl.removeEventListener('play', handlePlay);
    };
  }, [audioElementId]);

  // Real-time Spectrum Visualizer canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      const audioEl = document.getElementById(audioElementId) as HTMLAudioElement;
      if (!audioEl) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const eq = connectEqualizer(audioEl);
      if (!eq) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        return;
      }

      const { analyser } = eq;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Handle high-DPI canvas responsiveness
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // Draw horizontal reference lines (dB lines)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const yLine = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, yLine);
        ctx.lineTo(width, yLine);
        ctx.stroke();
      }

      // Draw vertical divisions grid
      const gridCols = 8;
      for (let i = 1; i < gridCols; i++) {
        const xLine = (width / gridCols) * i;
        ctx.beginPath();
        ctx.moveTo(xLine, 0);
        ctx.lineTo(xLine, height);
        ctx.stroke();
      }

      // Smooth flowing frequency line & gradient fill
      const activeLength = Math.floor(bufferLength * 0.85); // Concentrate on active audible frequencies
      
      const fillGradient = ctx.createLinearGradient(0, height, 0, 0);
      fillGradient.addColorStop(0, 'rgba(175, 82, 222, 0.03)'); // purple fade
      fillGradient.addColorStop(0.5, 'rgba(255, 45, 85, 0.15)'); // rose
      fillGradient.addColorStop(1, 'rgba(255, 45, 85, 0.4)'); // hot pink top

      const strokeGradient = ctx.createLinearGradient(0, 0, width, 0);
      strokeGradient.addColorStop(0, '#af52de'); // Purple
      strokeGradient.addColorStop(0.5, '#ea580c'); // Warm Orange
      strokeGradient.addColorStop(1, '#ff2d55'); // Hot Pink

      // Fill Area
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < activeLength; i++) {
        const value = dataArray[i] / 255;
        const x = (i / (activeLength - 1)) * width;
        const y = height - (value * height * 0.85) - 2;

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          const prevX = ((i - 1) / (activeLength - 1)) * width;
          const prevVal = dataArray[i - 1] / 255;
          const prevY = height - (prevVal * height * 0.85) - 2;
          const xc = (prevX + x) / 2;
          const yc = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, xc, yc);
        }
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = fillGradient;
      ctx.fill();

      // Stroke Line
      ctx.beginPath();
      for (let i = 0; i < activeLength; i++) {
        const value = dataArray[i] / 255;
        const x = (i / (activeLength - 1)) * width;
        const y = height - (value * height * 0.85) - 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = ((i - 1) / (activeLength - 1)) * width;
          const prevVal = dataArray[i - 1] / 255;
          const prevY = height - (prevVal * height * 0.85) - 2;
          const xc = (prevX + x) / 2;
          const yc = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, xc, yc);
        }
      }
      ctx.strokeStyle = strokeGradient;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(255, 45, 85, 0.35)';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw aesthetic spectral bars in the background (discrete bins representation)
      const numBars = 16;
      const spacing = 4;
      const barWidth = (width - (numBars - 1) * spacing) / numBars;
      const step = Math.floor(activeLength / numBars);

      for (let i = 0; i < numBars; i++) {
        const dataIdx = Math.min(activeLength - 1, i * step);
        const value = dataArray[dataIdx] / 255;
        const barHeight = Math.max(1.5, value * height * 0.75);
        const bX = i * (barWidth + spacing);
        const bY = height - barHeight;

        const barGrad = ctx.createLinearGradient(0, height, 0, bY);
        barGrad.addColorStop(0, 'rgba(175, 82, 222, 0.05)');
        barGrad.addColorStop(1, 'rgba(255, 45, 85, 0.15)');

        ctx.fillStyle = barGrad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bX, bY, barWidth, barHeight, [2, 2, 0, 0]);
        } else {
          ctx.rect(bX, bY, barWidth, barHeight);
        }
        ctx.fill();

        // High intensity peaks cap
        ctx.fillStyle = `rgba(255, 45, 85, ${0.3 + value * 0.6})`;
        ctx.fillRect(bX, bY, barWidth, Math.min(2, barHeight));
      }

      ctx.restore();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [audioElementId]);

  // Synchronize dynamic slider adjustments
  const handleGainChange = (bandIndex: number, val: number) => {
    const nextGains = [...gains];
    nextGains[bandIndex] = val;
    setGains(nextGains);
    setSelectedPreset('Custom');
    applyGains(nextGains, isBypassed);
  };

  // Sync preset changes
  const handlePresetSelect = (presetName: string) => {
    const preset = EQ_PRESETS.find(p => p.name === presetName);
    if (!preset) return;

    setGains(preset.gains);
    setSelectedPreset(presetName);
    applyGains(preset.gains, isBypassed);
  };

  // Sync bypass state updates
  const handleBypassToggle = () => {
    const nextBypass = !isBypassed;
    setIsBypassed(nextBypass);
    applyGains(gains, nextBypass);
  };

  const getPillColor = (type: BandConfig['type']) => {
    switch (type) {
      case 'Sub': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Bass': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Mids': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Highs': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Treble': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Air': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="bg-gray-50/80 border border-gray-100 rounded-[28px] p-6 shadow-inner relative max-w-full overflow-hidden mt-3" onClick={e => e.stopPropagation()}>
      <style>{`
        input[type="range"].eq-slider {
          -webkit-appearance: none;
          appearance: none;
          writing-mode: vertical-lr;
          direction: rtl;
          background: transparent;
          width: 8px;
          height: 120px;
          cursor: pointer;
          outline: none;
        }

        /* Chrome, Safari, Opera, Edge track & thumb */
        input[type="range"].eq-slider::-webkit-slider-runnable-track {
          width: 6px;
          background: #e5e7eb;
          border-radius: 9999px;
          border: none;
        }

        input[type="range"].eq-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #af52de 0%, #ff2d55 100%);
          cursor: pointer;
          margin-top: -4px;
          box-shadow: 0 2px 6px rgba(175, 82, 222, 0.4);
          transition: transform 0.1s, background 0.1s;
        }

        input[type="range"].eq-slider:hover::-webkit-slider-thumb {
          transform: scale(1.2);
        }

        /* Firefox track & thumb */
        input[type="range"].eq-slider::-moz-range-track {
          width: 6px;
          background: #e5e7eb;
          border-radius: 9999px;
          border: none;
        }

        input[type="range"].eq-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #af52de 0%, #ff2d55 100%);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(175, 82, 222, 0.4);
          transition: transform 0.1s;
        }

        input[type="range"].eq-slider:hover::-moz-range-thumb {
          transform: scale(1.2);
        }
        
        .eq-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .eq-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .eq-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
      `}</style>

      {/* Equalizer Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-gray-200/50">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-gradient-to-b from-[#af52de] to-[#ff2d55] rounded-full"></div>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-widest text-gray-800">12-Band Graphic Equalizer</h5>
            <p className="text-[10px] text-gray-400">Target frequency spectrum sculpting</p>
          </div>
        </div>

        <button 
          onClick={handleBypassToggle} 
          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all active:scale-95 ${
            isBypassed 
              ? 'bg-red-50 text-red-600 border-red-200' 
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {isBypassed ? 'EQ Bypassed' : 'Bypass EQ'}
        </button>
      </div>

      {/* Real-time Spectrum Visualizer */}
      <div className="mb-4 bg-gray-950 border border-gray-800 rounded-2xl p-3 shadow-inner relative overflow-hidden h-[90px]">
        {/* Subtle grid and glowing vibe */}
        <div className="absolute top-2 left-3 flex items-center gap-1.5 z-10 select-none pointer-events-none">
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="text-[8px] font-mono font-bold tracking-widest text-gray-400 uppercase">Live Spectrum Analyzer</span>
        </div>
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Preset Options Slider */}
      <div className="mb-4">
        <label className="block text-[9px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">Preset Profiles</label>
        <div className="flex gap-1.5 overflow-x-auto pb-2 eq-scroll -mx-1 px-1">
          {EQ_PRESETS.map(preset => (
            <button
              key={preset.name}
              disabled={isBypassed}
              onClick={() => handlePresetSelect(preset.name)}
              className={`px-3 py-1 text-[10px] font-semibold rounded-full shrink-0 border transition-all ${
                selectedPreset === preset.name && !isBypassed
                  ? 'bg-gradient-to-r from-[#af52de] to-[#ff2d55] text-white border-transparent shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* The 12 Equalizer Sliders Row */}
      <div className={`p-4 bg-white border border-gray-100 rounded-2xl ${isBypassed ? 'opacity-40 select-none' : ''}`}>
        <div className="flex gap-2 min-w-full overflow-x-auto justify-between pb-3 eq-scroll">
          {EQ_BANDS.map((band, idx) => {
            const currentVal = isBypassed ? 0 : gains[idx];
            const isNonZero = currentVal !== 0;

            return (
              <div key={band.frequency} className="flex flex-col items-center shrink-0 w-11 select-none">
                {/* Dynamic Decibel read-out */}
                <span className={`text-[9px] font-mono tracking-tighter mb-2 ${isNonZero ? 'text-pink-600 font-semibold' : 'text-gray-400'}`}>
                  {currentVal > 0 ? `+${currentVal}` : currentVal}
                </span>

                {/* Vertical Slider Controller */}
                <div className="h-32 flex items-center justify-center relative py-1">
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    disabled={isBypassed}
                    value={currentVal}
                    onChange={(e) => handleGainChange(idx, parseInt(e.target.value))}
                    className="eq-slider"
                  />
                </div>

                {/* Frequency & Type Labels */}
                <span className={`text-[9px] font-mono tracking-tight mt-2 font-medium ${isNonZero ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                  {band.label}
                </span>
                
                <span className={`px-1 py-0.5 mt-1 border text-[7px] font-bold uppercase tracking-wider rounded-md ${getPillColor(band.type)}`}>
                  {band.type}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
