/**
 * Main Application Component for Lyria Studio
 * 
 * This component serves as the primary container for the Lyria Studio application.
 * It manages the global state for music generation, including user inputs (prompts,
 * duration, lyrics options, image uploads), the generation process, and the display
 * of generated results.
 * 
 * Key Features:
 * - Prompt building (manual or via the PromptBuilder helper)
 * - Image upload for visual prompting
 * - Integration with Google GenAI for audio generation
 * - Audio playback and video export functionality
 * - Display of generated lyrics and metadata (title, cover art)
 */
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Duration, LyricsOption, GenerationState, SongResult } from './types';
import { Icons, PROMPT_HELPER_CONFIG } from './constants';
import { CONFIG } from './src/config';
import { logFunctionCall } from './src/utils/logger';
import { createAudioUrlFromBase64 } from './src/utils/audioUtils';
import { cleanLyricsForDisplay } from './src/utils/lyricsUtils';
import { handleDownloadVideo } from './src/utils/videoUtils';
import { parseModelOutput, generateSongTitle, generateCoverArt } from './src/services/genaiService';
import { getRandomItem } from './src/utils/helpers';
import { PromptBuilder, HelperSection } from './src/components/PromptBuilder';
import { GraphicEqualizer } from './src/components/GraphicEqualizer';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isPromptManual, setIsPromptManual] = useState(false);
  const [duration, setDuration] = useState<Duration>('Clip (30s)');
  const [lyricsOption, setLyricsOption] = useState<LyricsOption>('Auto');
  const [customLyrics, setCustomLyrics] = useState('');
  const [gen, setGen] = useState<GenerationState>({ results: [] });
  const [isResultPlaying, setIsResultPlaying] = useState<string | null>(null);
  const [openEqId, setOpenEqId] = useState<string | null>(null);
  const [encodingVideoId, setEncodingVideoId] = useState<string | null>(null);
  const [encodingProgress, setEncodingProgress] = useState(0);
  const [selectedImages, setSelectedImages] = useState<{data: string, mimeType: string, previewUrl: string}[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);

  // Helper Mode States
  const [isHelperOpen, setIsHelperOpen] = useState(false);
  const [helperSections, setHelperSections] = useState<HelperSection[]>([
    { 
      id: 'initial', 
      type: 'main', 
      mood: getRandomItem(PROMPT_HELPER_CONFIG.moods), 
      gender: getRandomItem(PROMPT_HELPER_CONFIG.genders), 
      theme: getRandomItem(PROMPT_HELPER_CONFIG.themes) 
    }
  ]);
  const [activeSelector, setActiveSelector] = useState<{ sectionId: string, type: 'mood' | 'gender' | 'theme' | 'timestamp' | 'bpm' | 'scale' } | null>(null);
  
  const consoleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (promptTextareaRef.current) {
      promptTextareaRef.current.style.height = 'auto';
      promptTextareaRef.current.style.height = `${promptTextareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  // Sync Helper sections to Prompt
  useEffect(() => {
    if (isHelperOpen) {
      const generated = helperSections.map(s => {
        const scaleInfo = s.scale ? ` in the scale of ${s.scale.toLowerCase()}` : '';

        if (s.type === 'main') {
          const bpmInfo = s.bpm ? ` at ${s.bpm.toLowerCase()}` : '';
          const musicDetails = `${bpmInfo}${scaleInfo}`;
          return `Create a ${s.mood?.toLowerCase()} ${s.gender?.toLowerCase()} song about ${s.theme?.toLowerCase()}${musicDetails}.`;
        } else {
          const musicDetails = `${scaleInfo}`;
          return `[From ${s.timestamp}] the song transitions to a ${s.mood?.toLowerCase()} ${s.gender?.toLowerCase()} song${musicDetails}.`;
        }
      }).join('\n');
      setPrompt(generated);
      setIsPromptManual(false); // Helper sync is not "manual typing"
    }
  }, [isHelperOpen, helperSections]);

  useEffect(() => {
    Object.values(consoleRefs.current).forEach(el => {
      if (el) {
        (el as HTMLDivElement).scrollTop = (el as HTMLDivElement).scrollHeight;
      }
    });
  }, [gen.results]);

  const handleSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Limit to 10 images total
    const remainingSlots = 10 - selectedImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setSelectedImages(prev => [...prev, { data: base64, mimeType: file.type, previewUrl: URL.createObjectURL(file) }]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].previewUrl);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleFeelingLucky = () => {
    // Check if the prompt is manual and not empty. If so, do nothing.
    if (isPromptManual && prompt.trim() !== '') return;

    const randomMood = getRandomItem(PROMPT_HELPER_CONFIG.moods);
    const randomGender = getRandomItem(PROMPT_HELPER_CONFIG.genders);
    const randomTheme = getRandomItem(PROMPT_HELPER_CONFIG.themes);
    
    setPrompt(`Create a ${randomMood.toLowerCase()} ${randomGender.toLowerCase()} song about ${randomTheme.toLowerCase()}.`);
    setIsPromptManual(false); // Mark as generated
  };

  const updateHelperSection = (id: string, updates: Partial<HelperSection>) => {
    setHelperSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const updateResult = (id: string, updater: (prev: SongResult) => SongResult) => {
    setGen(prev => ({ results: prev.results.map(r => r.id === id ? updater(r) : r) }));
  };

  const addLog = (id: string, message: string) => {
    updateResult(id, prev => ({ ...prev, logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`] }));
  };

  const toggleExpand = (id: string) => {
    setGen(prev => ({ results: prev.results.map(r => r.id === id ? { ...r, isExpanded: !r.isExpanded } : r) }));
  };

  const handleGenerateSongTitle = async (id: string, musicPrompt: string, lyricContext: string) => {
    addLog(id, "Decoding narrative architecture for title...");
    const title = await generateSongTitle(musicPrompt, lyricContext);
    updateResult(id, r => ({ ...r, title }));
    addLog(id, `Identity confirmed: "${title}"`);
    return title;
  };

  const handleGenerateCoverArt = async (id: string, musicPrompt: string, lyricContext: string, title?: string) => {
    addLog(id, "Synthesizing visual representation...");
    const base64Image = await generateCoverArt(musicPrompt, lyricContext, title);
    if (base64Image) {
      updateResult(id, r => ({ ...r, coverImageUrl: base64Image }));
      addLog(id, "Visual synthesis finalized.");
    } else {
      addLog(id, "Visual synthesis skipped.");
    }
  };

  const handleGenerate = async (overrides?: { prompt: string, duration: Duration, lyricsOption: LyricsOption, customLyrics?: string }) => {
    const activePrompt = overrides?.prompt ?? prompt;
    const activeDuration = overrides?.duration ?? duration;
    const activeLyricsOption = overrides?.lyricsOption ?? lyricsOption;
    const activeCustomLyrics = overrides?.customLyrics ?? customLyrics;
    if (!activePrompt.trim() && selectedImages.length === 0) return;

    // Check for API key if Pro or Clip model is selected
    if (activeDuration === 'Pro' || activeDuration === 'Clip (30s)') {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          if ((window as any).aistudio?.openSelectKey) {
            await (window as any).aistudio.openSelectKey();
          }
          return; // Stop generation so the user can select the key and try again
        }
      }
    }

    setIsTriggering(true);
    setTimeout(() => setIsTriggering(false), 200);

    const newId = Math.random().toString(36).substring(7);
    const newResult: SongResult = {
      id: newId, status: 'generating', logs: [], audioUrl: null, coverImageUrl: null, title: null, lyrics: '', metadata: '', fullPrompt: null, error: null, duration: activeDuration, timestamp: new Date(), isExpanded: true,
      originalPrompt: activePrompt, originalDuration: activeDuration, originalLyricsOption: activeLyricsOption
    };
    setGen(prev => ({ results: [newResult, ...prev.results.map(r => ({ ...r, isExpanded: false }))] }));
    const modelId = activeDuration === 'Pro' ? CONFIG.MODEL_ID_FULL : CONFIG.MODEL_ID_SHORT;
    const modelDisplayName = activeDuration === 'Pro' ? 'Lyria Pro' : 'Lyria Clip';
    addLog(newId, `Waking ${modelDisplayName} engine...`);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let lyricInstruction = activeLyricsOption === 'Instrumental' ? "IMPORTANT: This track MUST be strictly INSTRUMENTAL." : 
                          activeLyricsOption === 'Custom' ? `\nUse these exact lyrics:\n ${activeCustomLyrics}` : "\nGenerate lyrics with precise [seconds:] timing markers.";
      const contextPart = activePrompt.trim() ? `\nContext: "${activePrompt}".` : '';
      const promptText = `Generate a ${activeDuration === 'Pro' ? 'full-length' : '30-second'} track.${contextPart} ${ lyricInstruction }.`;
      
      // Save the full prompt for display later
      updateResult(newId, r => ({ ...r, fullPrompt: promptText }));
      
      const contents: any = selectedImages.length > 0 ? { 
        parts: [
          { text: promptText }, 
          ...selectedImages.map(img => ({ inlineData: { data: img.data, mimeType: img.mimeType } }))
        ] 
      } : promptText;
      const responseStream = await ai.models.generateContentStream({ model: modelId, contents: contents, config: { responseModalities: [Modality.AUDIO] } });
      let audioAccumulator = ""; let textAccumulator = ""; let mimeType = "audio/wav"; let auxTriggered = false;
      let currentPartType = ''; let textPartsSeen = 0;
      
      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) { 
            currentPartType = 'audio';
            if (!audioAccumulator && part.inlineData.mimeType) mimeType = part.inlineData.mimeType; 
            audioAccumulator += part.inlineData.data; 
          }
          if (part.text) {
            if (currentPartType !== 'text') { 
              textPartsSeen++; 
              currentPartType = 'text'; 
            }
            if (textPartsSeen === 1) {
              textAccumulator += part.text;
              const { lyrics, metadata } = parseModelOutput(textAccumulator);
              updateResult(newId, r => ({ ...r, lyrics, metadata }));
              if (!auxTriggered && textAccumulator.length > 50) { auxTriggered = true; handleGenerateSongTitle(newId, activePrompt, textAccumulator).then(t => handleGenerateCoverArt(newId, activePrompt, textAccumulator, t)); }
            }
          }
        }
      }
      console.log('[Raw Generated Lyrics]', textAccumulator);
      if (audioAccumulator) { updateResult(newId, r => ({ ...r, status: 'completed', audioUrl: createAudioUrlFromBase64(audioAccumulator, mimeType) })); addLog(newId, "Signal stabilized."); }
      else throw new Error("Zero audio bits captured.");
    } catch (err: any) { updateResult(newId, r => ({ ...r, status: 'error', error: err.message || "Synthesis interrupted." })); }
  };

  const handleDownload = (result: SongResult) => {
    if (!result.audioUrl) return;
    const link = document.createElement('a'); link.href = result.audioUrl; link.download = `${result.title || 'Lyria'}.wav`; link.click();
  };

  const onDownloadVideo = async (result: SongResult, withLyrics: boolean = false) => {
    if (!result.audioUrl || !result.coverImageUrl || encodingVideoId) return;
    setEncodingVideoId(result.id);
    setEncodingProgress(0);

    await handleDownloadVideo(
      result,
      withLyrics,
      (progress) => setEncodingProgress(progress),
      () => {
        setEncodingVideoId(null);
        setEncodingProgress(0);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleGenerate(); };

  return (
    <div className="min-h-screen flex flex-col pb-20 overflow-x-hidden" onClick={() => setActiveSelector(null)}>
      <nav className="sticky top-0 z-50 glass border-b border-gray-200/50 h-14 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 music-gradient rounded-lg flex items-center justify-center text-white font-bold text-xs">LYRIA</div>
          <span className="font-semibold text-lg tracking-tight">Studio</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest border border-gray-200">lyria 3 preview</div>
          <button 
            onClick={handleSelectKey} 
            className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
          >
            api key
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 pt-12">
        <section className="text-center mb-16 space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 leading-tight">Create your sound</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">Synthesis of professional music from narrative engineering.</p>
        </section>

        <section className="bg-white rounded-[40px] p-8 md:p-12 card-shadow border border-gray-100 mb-12 relative z-10">
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-end mb-1">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Track Directives (Ctrl + Enter to send)</label>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsHelperOpen(!isHelperOpen); }}
                    className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${isHelperOpen ? 'text-blue-600' : 'text-blue-400 hover:text-blue-600'}`}
                  >
                    <Icons.Sparkles className="w-3.5 h-3.5" />
                    {isHelperOpen ? 'Free Text' : 'Help me create'}
                  </button>
                </div>
              </div>
              
              <div className="relative group/prompt min-h-[160px]">
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
                {isHelperOpen ? (
                  <PromptBuilder
                    isHelperOpen={isHelperOpen}
                    helperSections={helperSections}
                    setHelperSections={setHelperSections}
                    activeSelector={activeSelector}
                    setActiveSelector={setActiveSelector}
                    selectedImages={selectedImages}
                    onImageSelect={() => fileInputRef.current?.click()}
                    onImageRemove={removeImage}
                  />
                ) : (
                  <div className="relative">
                    <textarea
                      ref={promptTextareaRef}
                      value={prompt}
                      onChange={(e) => {
                        setPrompt(e.target.value);
                        setIsPromptManual(true);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Atmospheric cinematic track with heavy sub-bass..."
                      className="w-full min-h-[128px] bg-gray-50 border border-gray-100 rounded-3xl p-6 pb-20 text-xl font-light leading-relaxed resize-none focus:bg-white transition-all pr-16"
                      style={{ overflow: 'hidden' }}
                    />
                    <div className="absolute bottom-4 left-4 flex items-center gap-2">
                      {selectedImages.length < 10 && (
                        <button 
                          title="By using this feature, you confirm that you have the necessary rights to any content that you upload. Do not generate content that infringes on others’ intellectual property or privacy rights. Your use of this generative AI service is subject to our Prohibited Use Policy." 
                          onClick={() => fileInputRef.current?.click()} 
                          className={`transition-all shadow-sm border border-gray-100 flex items-center justify-center ${selectedImages.length > 0 ? 'p-2.5 rounded-2xl bg-blue-500 text-white' : 'px-4 py-2.5 rounded-2xl bg-white text-gray-500 hover:text-blue-600 gap-2 text-sm font-medium'}`}
                        >
                          <Icons.Camera className="w-5 h-5" />
                          {selectedImages.length === 0 && <span>Add image references</span>}
                        </button>
                      )}
                      {selectedImages.length > 0 && (
                        <div className="flex gap-2">
                          {selectedImages.map((img, idx) => (
                            <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-white shadow-lg animate-in zoom-in duration-200">
                              <img src={img.previewUrl} className="w-full h-full object-cover" />
                              <button onClick={() => removeImage(idx)} className="absolute top-0 right-0 w-4 h-4 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur hover:bg-black"><Icons.X className="w-2.5 h-2.5" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <button 
                        title="I'm feeling lucky" 
                        onClick={handleFeelingLucky} 
                        className={`p-2.5 bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-blue-500 rounded-2xl transition-transform active:scale-90 ${isPromptManual && prompt.trim() !== '' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                      >
                        <Icons.Sparkles className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Length</label>
                <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
                  {(['Clip (30s)', 'Pro'] as Duration[]).map((opt) => (
                    <button key={opt} onClick={() => setDuration(opt)} className={`px-8 py-2.5 rounded-xl text-sm font-semibold transition-all ${duration === opt ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-800'}`}>{opt}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Lyrics</label>
                <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
                  {(['Auto', 'Custom', 'Instrumental'] as LyricsOption[]).map((opt) => (
                    <button key={opt} onClick={() => setLyricsOption(opt)} className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${lyricsOption === opt ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}>{opt}</button>
                  ))}
                </div>
              </div>
            </div>

            {lyricsOption === 'Custom' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Custom Composition Lyrics</label>
                <textarea
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  placeholder={`[0:00 - 0:15] Hey this is your song\n[0:15 - ] You can write any lyrics you want`}
                  className="w-full min-h-[160px] bg-gray-50 border border-gray-100 rounded-3xl p-6 text-lg font-light leading-relaxed resize-none focus:bg-white transition-all custom-scrollbar"
                />
              </div>
            )}

            <button 
              onClick={() => handleGenerate()} 
              disabled={(!prompt.trim() && selectedImages.length === 0) || CONFIG.IS_MAINTENANCE_MODE} 
              className={`w-full py-5 rounded-3xl text-lg font-bold text-white transition-all shadow-xl ${
                ((!prompt.trim() && selectedImages.length === 0) || CONFIG.IS_MAINTENANCE_MODE)
                  ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                  : `music-gradient shadow-red-500/20 active:scale-[0.98] active:brightness-110 ${isTriggering ? 'scale-[0.98] brightness-125 ring-4 ring-pink-200' : ''}`
              }`}
            >
              Generate Song
            </button>
          </div>
        </section>

        {gen.results.length > 0 && (
          <div className="relative mb-12 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200/60"></div></div>
            <div className="relative bg-[#fbfbfd] px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Songs Gallery</div>
          </div>
        )}

        <div className="space-y-6">
          {gen.results.map((result) => {
            const isExpanded = result.isExpanded;
            const isEncoding = encodingVideoId === result.id;
            const isGenerating = result.status === 'generating';
            const isFailed = result.status === 'error';
            
            return (
              <div key={result.id} className="group relative transition-all duration-700 ease-in-out transform">
                <div className={`relative transition-all duration-700 ease-in-out border border-gray-200/60 shadow-lg rounded-[40px] ${isExpanded ? 'p-8 pb-12' : 'p-4'}`}>
                  <div className="absolute inset-0 z-0 rounded-[40px] overflow-hidden" style={{ backgroundImage: result.coverImageUrl ? `url(${result.coverImageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out backdrop-blur-2xl ${isExpanded ? 'bg-white/75 opacity-100' : 'bg-white/85 opacity-100'}`} />
                  </div>

                  <div className={`relative z-[30] flex transition-all duration-700 ease-in-out gap-6 items-center ${isExpanded ? 'flex-col md:flex-row mb-8' : 'flex-row'}`} onClick={() => !isExpanded && toggleExpand(result.id)} style={{ cursor: isExpanded ? 'default' : 'pointer' }}>
                    <div className={`relative shrink-0 transition-all duration-700 ease-in-out rounded-3xl overflow-hidden shadow-2xl ${isExpanded ? 'w-48 h-48 md:w-56 md:h-56' : 'w-16 h-16'}`}>
                      {result.coverImageUrl ? <img src={result.coverImageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gray-100/50"><Icons.Sparkles className={`text-blue-300 ${isExpanded ? 'w-12 h-12 animate-pulse' : 'w-5 h-5'}`} /></div>}
                      {isEncoding && <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center"><Icons.Loading className={`${isExpanded ? 'w-12 h-12' : 'w-6 h-6'} text-blue-600 animate-spin`} /></div>}
                      <button onClick={(e) => { e.stopPropagation(); if (isGenerating) return; const audio = document.getElementById(`audio-${result.id}`) as HTMLAudioElement; if (audio) audio.paused ? audio.play() : audio.pause(); }} disabled={(!result.audioUrl && !isGenerating) || isEncoding} className={`absolute inset-0 flex items-center justify-center text-white z-10 transition-opacity duration-300 ${isExpanded || isGenerating ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isEncoding ? 'cursor-wait' : 'cursor-pointer'}`}>
                        <div className={`music-gradient backdrop-blur-xl rounded-full flex items-center justify-center border border-white/40 shadow-2xl hover:scale-110 transition-transform ${isExpanded ? 'w-16 h-16' : 'w-10 h-10'}`}>
                          {isGenerating ? <Icons.Loading className={`${isExpanded ? 'w-8 h-8' : 'w-5 h-5'} animate-spin`} /> : isResultPlaying === result.id ? <Icons.Pause className={isExpanded ? 'w-8 h-8' : 'w-5 h-5'} /> : <Icons.Play className={`${isExpanded ? 'w-8 h-8' : 'w-5 h-5'} ml-1`} />}
                        </div>
                      </button>
                    </div>

                    <div className={`flex-1 min-w-0 transition-all duration-700 ease-in-out ${isExpanded ? 'text-center md:text-left' : ''}`}>
                      <div className="space-y-1 relative">
                        <div className={`flex items-center gap-4 ${isExpanded ? 'justify-center md:justify-start flex-wrap' : ''}`}>
                          <h4 className={`font-extrabold text-blue-900 tracking-tight transition-all duration-700 ease-in-out truncate ${isExpanded ? 'text-3xl md:text-4xl' : 'text-lg'}`}>
                            {isFailed ? 'Processing Failed' : (result.title || (isGenerating ? "Synthesizing..." : "Untitled Composition"))}
                          </h4>
                          {(isFailed || result.audioUrl) && (
                            <div className="relative" onClick={e => e.stopPropagation()}>
                              <button onClick={() => handleGenerate({ prompt: result.originalPrompt, duration: result.originalDuration, lyricsOption: result.originalLyricsOption })} className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-100 border border-blue-200 text-blue-600 text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-blue-200 transition-all shadow-sm active:scale-95 z-20">
                                <Icons.RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                <span>{isFailed ? 'Retry' : 'Regenerate'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest transition-all duration-700 ease-in-out ${isExpanded ? 'justify-center md:justify-start' : ''}`}>
                          <span className="px-2 py-0.5 bg-blue-500 text-white rounded">LYRIA 3.0</span>
                          <span>• {result.duration}</span>
                        </div>
                      </div>

                      <div className={`transition-all duration-700 ease-in-out overflow-visible ${isExpanded ? 'max-h-[800px] mt-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                        {result.audioUrl && (
                          <div className="space-y-4">
                            <audio id={`audio-${result.id}`} onPlay={() => setIsResultPlaying(result.id)} onPause={() => setIsResultPlaying(null)} controls className="h-10 w-full rounded-2xl"><source src={result.audioUrl} /></audio>
                            <div className="flex gap-4 items-start relative">
                              {/* Equalizer Toggle Button */}
                              <button 
                                onClick={(e) => { e.stopPropagation(); setOpenEqId(openEqId === result.id ? null : result.id); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-[0.1em] border transition-all active:scale-95 ${
                                  openEqId === result.id 
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-inner font-extrabold' 
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                              >
                                <svg className="w-4 h-4 shrink-0 text-[#af52de]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="4" y1="21" x2="4" y2="14" />
                                  <line x1="4" y1="10" x2="4" y2="3" />
                                  <line x1="12" y1="21" x2="12" y2="12" />
                                  <line x1="12" y1="8" x2="12" y2="3" />
                                  <line x1="20" y1="21" x2="20" y2="16" />
                                  <line x1="20" y1="12" x2="20" y2="3" />
                                  <line x1="1" y1="14" x2="7" y2="14" />
                                  <line x1="9" y1="8" x2="15" y2="8" />
                                  <line x1="17" y1="16" x2="23" y2="16" />
                                </svg>
                                <span>{openEqId === result.id ? 'Close EQ' : 'Equalizer'}</span>
                              </button>

                              {/* Download Button Overlay */}
                              <div className="flex-1 relative group/download" onClick={e => e.stopPropagation()}>
                                <button onClick={(e) => { e.stopPropagation(); handleDownload(result); }} className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 ${isEncoding ? 'opacity-50 cursor-wait' : ''}`} disabled={isEncoding}>
                                  {isEncoding ? <Icons.Loading className="w-4 h-4 animate-spin" /> : <Icons.Download className="w-4 h-4" />}
                                  {isEncoding ? `Processing ${Math.round(encodingProgress)}%` : 'Download'}
                                </button>
                                {!isEncoding && (
                                  <div className="absolute top-full left-0 right-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/download:opacity-100 group-hover/download:translate-y-0 group-hover/download:pointer-events-auto transition-all duration-300 z-[60]">
                                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                                      <button onClick={(e) => { e.stopPropagation(); handleDownload(result); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><Icons.Download className="w-4 h-4" /></div>
                                        <div><div className="text-[10px] font-bold uppercase tracking-wider text-gray-900">Track</div><div className="text-[9px] text-gray-400">High fidelity master</div></div>
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); onDownloadVideo(result, false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-t border-gray-50 transition-colors">
                                        <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center"><Icons.Video className="w-4 h-4" /></div>
                                        <div><div className="text-[10px] font-bold uppercase tracking-wider text-gray-900">Video</div><div className="text-[9px] text-gray-400">Reactive visual map</div></div>
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); onDownloadVideo(result, true); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-t border-gray-50 transition-colors">
                                        <div className="w-8 h-8 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center"><Icons.Sparkles className="w-4 h-4" /></div>
                                        <div><div className="text-[10px] font-bold uppercase tracking-wider text-gray-900">Karaoke</div><div className="text-[9px] text-gray-400">Timed sync engine</div></div>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Render Graphic Equalizer component when expanded */}
                            {openEqId === result.id && (
                              <div className="animate-in fade-in duration-300">
                                <GraphicEqualizer audioElementId={`audio-${result.id}`} />
                              </div>
                            )}
                          </div>
                        )}
                        {!result.audioUrl && isGenerating && <div className="h-1 w-full bg-blue-100 rounded-full overflow-hidden mt-6"><div className="h-full bg-blue-500 animate-[loading_2s_infinite]"></div></div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4"><button onClick={(e) => { e.stopPropagation(); toggleExpand(result.id); }} className={`p-2 rounded-full transition-all duration-500 ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-90' : 'text-gray-400 group-hover:text-blue-500'}`}><Icons.ChevronRight className="w-6 h-6" /></button></div>
                  </div>

                  <div className={`relative z-10 grid transition-all duration-700 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      {/* Generation Directive Box */}
                      {(result.fullPrompt || result.originalPrompt) && (
                        <div className="mb-6 space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Generation Directive</label>
                          <div className="bg-gray-50/80 border border-gray-100 rounded-[24px] p-6 text-xs font-mono text-gray-600 whitespace-pre-wrap shadow-inner overflow-x-auto custom-scrollbar">
                            {result.fullPrompt || result.originalPrompt}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 pb-2">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Composition Lyrics</label>
                          <div className="bg-white/40 border border-white/50 backdrop-blur-md rounded-[32px] p-8 h-[240px] overflow-y-auto text-base text-gray-800 italic whitespace-pre-wrap font-serif shadow-inner custom-scrollbar">{result.lyrics ? cleanLyricsForDisplay(result.lyrics) : (isGenerating ? "Synthesizing narrative..." : "Instrumental")}</div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">System Console</label>
                          <div ref={el => { consoleRefs.current[result.id] = el; }} className="bg-[#1c1c1e] rounded-[32px] p-8 h-[240px] overflow-y-auto font-mono text-[11px] text-[#32d74b] space-y-1 shadow-2xl border border-gray-800/50 custom-scrollbar">{result.logs.map((log, i) => <div key={i} className="opacity-80 leading-relaxed">{log}</div>)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <style>{`
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;