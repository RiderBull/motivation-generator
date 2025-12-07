"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { AutoInput } from '@/components/AutoInput';
import { PersonaCard } from '@/components/PersonaCard';
import { Mic, Zap, Briefcase, BookOpen, Loader2, Play, Pause, Download, Sparkles, Volume2 } from 'lucide-react';

const PERSONAS = [
  { id: 'Steve Jobs', name: 'Steve Jobs', description: 'of design', icon: Briefcase, image: '/images/steve.png' },
  // { id: 'Goggins', name: 'Goggins', description: 'of discipline', icon: Mic, image: '/images/goggins.png' }, // Unavailable
  { id: 'Hormozi', name: 'Hormozi', description: 'of leverage', icon: Zap, image: '/images/hormozi.png' },
  { id: 'Bible', name: 'Bible', description: 'of wisdom', icon: BookOpen, image: '/images/bible.png' },
];

export default function Home() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [persona, setPersona] = useState(PERSONAS[0].id);

  // --- AUDIO STATE MANAGEMENT ---
  const [isStreaming, setIsStreaming] = useState(false); // Is the session active?
  const [isPaused, setIsPaused] = useState(false);       // Did user explicitly pause?
  const [isSpeaking, setIsSpeaking] = useState(false);   // Is voice currently playing?

  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Queue System
  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  const [scriptQueue, setScriptQueue] = useState<string[]>([]); // For displaying upcoming scripts
  const [fullHistory, setFullHistory] = useState<string[]>([]); // For context in generation
  const [isGenerating, setIsGenerating] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null); // Voice only

  // --- QUEUE SOURCE OF TRUTH ---
  // We use Refs for logic to avoid React state closure staleness issues completely.
  // State is used ONLY for UI rendering linkage.
  const audioQueueRef = useRef<string[]>([]);
  const scriptQueueRef = useRef<string[]>([]);

  // Helpers to keep Ref and State in sync
  const addToQueue = useCallback((audioUrl: string, scriptText: string) => {
    audioQueueRef.current.push(audioUrl);
    scriptQueueRef.current.push(scriptText);

    // Trigger UI update
    setAudioQueue([...audioQueueRef.current]);
    setScriptQueue([...scriptQueueRef.current]);
  }, []);

  const shiftQueue = useCallback(() => {
    const nextAudio = audioQueueRef.current.shift();
    const nextScript = scriptQueueRef.current.shift();

    // Trigger UI update
    setAudioQueue([...audioQueueRef.current]);
    setScriptQueue([...scriptQueueRef.current]);

    return { nextAudio, nextScript };
  }, []);

  // Refs for logic state
  const isGeneratingRef = useRef(isGenerating);
  const isStreamingRef = useRef(isStreaming);
  const isPausedRef = useRef(isPaused);
  const isSpeakingRef = useRef(isSpeaking);

  const fullHistoryRef = useRef<string[]>([]);

  // Ref for Parameters (Name, Context, etc) to avoid stale closures in generation
  const paramsRef = useRef({ name, context, additionalDetails, persona });

  // Sync Refs with State
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
    isStreamingRef.current = isStreaming;
    isPausedRef.current = isPaused;
    isSpeakingRef.current = isSpeaking;

    fullHistoryRef.current = fullHistory;
    paramsRef.current = { name, context, additionalDetails, persona };
  }, [isGenerating, isStreaming, isPaused, isSpeaking, fullHistory, name, context, additionalDetails, persona]);

  // Infinite Generation Loop (Moved Up)
  const generateNextSegment = useCallback(async (history: string[]) => {
    if (isGeneratingRef.current) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Read latest params from Ref
      const { name, context, additionalDetails, persona } = paramsRef.current;

      const fullContext = additionalDetails
        ? `${context}. Additional context about me: ${additionalDetails}`
        : context;

      const res = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          context: fullContext,
          persona,
          // mood removed
          previousScripts: history
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate next segment');
      }

      if (data.url) {
        // Use Helper to add
        addToQueue(data.url, data.script);
        console.log("Segment added. Queue size:", audioQueueRef.current.length);
      }
    } catch (e: any) {
      console.error("Generation failed", e);
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  }, [addToQueue]); // addToQueue is stable

  // Robust PlayNext Function
  const playNext = useCallback(async () => {
    // 1. Check Availability (Directly from Ref)
    if (!isStreamingRef.current) {
      console.log("playNext abort: Not streaming");
      return;
    }
    if (isPausedRef.current) {
      console.log("playNext abort: Paused");
      return;
    }
    if (audioQueueRef.current.length === 0) {
      console.log("playNext abort: Queue empty.");
      return;
    }
    // Prevent double play if already speaking
    if (isSpeakingRef.current) {
      console.log("playNext abort: Already speaking");
      return;
    }

    // 2. Shift Item
    const { nextAudio, nextScript } = shiftQueue();
    if (!nextAudio || !nextScript) return;

    console.log("playNext initiating for:", nextAudio);
    setCurrentScript(nextScript);

    // 3. Prepare Audio
    if (!audioRef.current) return;

    const audioSrc = (nextAudio.startsWith('http') || nextAudio.startsWith('data:')) ? nextAudio : `${API_BASE}${nextAudio}`;

    // Do not append query params to Data URIs (corrupts base64)
    if (audioSrc.startsWith('data:')) {
      audioRef.current.src = audioSrc;
    } else {
      audioRef.current.src = `${audioSrc}?t=${Date.now()}`;
    }

    audioRef.current.currentTime = 0;
    audioRef.current.load();

    // 4. Set State & Play
    setIsSpeaking(true);

    try {
      console.log("Attempting to play audio (src length):", audioRef.current.src.length);
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log("Audio playback started successfully");
      }

      // 5. Manage Buffer & History
      setFullHistory(prev => {
        const newHistory = [...prev, nextScript];

        // Check Buffer directly from Ref
        const bufferSize = audioQueueRef.current.length;
        const generating = isGeneratingRef.current;
        console.log("Buffer check:", { bufferSize, generating });

        if (bufferSize <= 2 && !generating) {
          console.log("Triggering generation (buffer low)");
          generateNextSegment(newHistory);
        }
        return newHistory;
      });

    } catch (e: any) {
      console.error("Playback failed for:", nextAudio, e);
      setError(`Playback failed: ${e.message}`);
      setIsSpeaking(false); // Reset tracking on failure so we can try next
    }
  }, [shiftQueue, generateNextSegment]);

  // Stop Stream
  const stopStream = () => {
    setIsStreaming(false);
    setIsPaused(false);
    setIsSpeaking(false);

    audioQueueRef.current = [];
    scriptQueueRef.current = [];
    setAudioQueue([]);
    setScriptQueue([]);
    setFullHistory([]);
    setCurrentScript(null);
    setError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
  };


  // Refined "Start"
  const handleStart = async () => {
    if (!name || !context) {
      setError('Please tell me who you are and what you need.');
      return;
    }
    setError(null);

    // Set States
    setIsStreaming(true);
    setIsPaused(false);
    setIsSpeaking(false);

    await generateNextSegment([]); // Generate the first segment
  };

  // Toggle Play/Pause
  const togglePause = () => {
    if (isPaused) {
      // RESUME
      setIsPaused(false);

      // Resume Speech if we have one loaded, PlayNext if queue has stuff
      if (audioRef.current && audioRef.current.src && audioRef.current.src !== '') {
        audioRef.current.play().catch(e => console.error("Resume audio failed", e));
        setIsSpeaking(true);
      } else {
        // Try to trigger next if nothing was playing
        playNext();
      }
    } else {
      // PAUSE
      setIsPaused(true);
      audioRef.current?.pause();
      setIsSpeaking(false); // Technically paused speaking
    }
  };

  // Centralized Playback Controller / Queue Watcher
  // Triggers when queue gets items or when we finish speaking (if streaming and not paused)
  useEffect(() => {
    if (!isStreaming) return;
    if (isPaused) return;
    if (isSpeaking) return; // Wait until done speaking

    // Check ref directly
    const hasItems = audioQueueRef.current.length > 0;

    if (hasItems) {
      console.log("Watcher triggering playNext. Queue:", audioQueueRef.current.length);
      playNext();
    }
  }, [audioQueue, isStreaming, isPaused, isSpeaking, playNext]);

  // Handle voice audio ending
  const handleVoiceEnded = useCallback(() => {
    console.log("Voice ended.");
    setIsSpeaking(false);
    // The effect above [isSpeaking changing to false] will pick this up and call playNext if queue has items
  }, []);

  const selectedPersona = PERSONAS.find(p => p.id === persona);

  return (
    <main className="min-h-screen relative flex flex-col justify-center items-center overflow-hidden selection:bg-oura-accent/20">

      {/* ... (backgrounds) ... */}
      <div className="bg-grain" />
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[#f2f0e9]">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-200/20 rounded-full mix-blend-multiply filter blur-[100px] animate-float opacity-60" />
        <div className="absolute bottom-1/4 right-0 w-[600px] h-[600px] bg-blue-100/30 rounded-full mix-blend-multiply filter blur-[120px] animate-grain" />
      </div>

      <div className="w-full max-w-6xl px-6 md:px-12 py-12 md:py-24 relative z-10">


        <div className="space-y-16 md:space-y-24">

          {/* Main Mad Libs Interface - Smoother Flow */}
          <section className="animate-fade-in-up text-center max-w-5xl mx-auto flex flex-col items-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif text-oura-dark leading-tight md:leading-snug">
              <span className="opacity-40 font-light mr-2">I am</span>
              <AutoInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="name"
                className="inline-block text-oura-accent italic placeholder:text-stone-300 placeholder:italic bg-transparent text-center focus:placeholder:text-transparent border-b-2 border-stone-200 focus:border-oura-accent focus:outline-none transition-colors min-w-[120px]"
              />
              <span className="opacity-40 font-light mx-2">and I clearly need to</span>
              <br className="md:hidden" />
              <AutoInput
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="focus on my startup..."
                className="inline-block text-oura-accent italic placeholder:text-stone-300 placeholder:italic bg-transparent text-center focus:placeholder:text-transparent border-b-2 border-stone-200 focus:border-oura-accent focus:outline-none transition-colors min-w-[280px]"
              />
              <span className="opacity-40 font-light">.</span>
            </h1>

            {/* Creative 'Add details' button/section remains ... */}
            <div className="mt-8 w-full max-w-2xl mx-auto">
              {!showDetails ? (
                <button
                  onClick={() => setShowDetails(true)}
                  className="group flex flex-col items-center gap-3 mx-auto transition-all duration-500 hover:opacity-80"
                >
                  <span className="text-[10px] font-sans tracking-[0.2em] uppercase text-stone-400 border-b border-transparent group-hover:border-stone-300 transition-all pb-0.5">
                    + add details
                  </span>
                </button>
              ) : (
                <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
                  <div className="bg-[#fcfbf9] relative p-8 rounded-xl shadow-lg border border-stone-100 overflow-hidden">
                    <div className="absolute inset-0 bg-grain opacity-[0.03] pointer-events-none" />
                    <div className="flex justify-between items-center mb-6">
                      <span className="font-serif italic text-lg text-stone-400">Context</span>
                      <button
                        onClick={() => setShowDetails(false)}
                        className="text-[10px] uppercase tracking-widest text-stone-300 hover:text-oura-dark transition-colors"
                      >
                        Close
                      </button>
                    </div>
                    <textarea
                      value={additionalDetails}
                      onChange={(e) => setAdditionalDetails(e.target.value)}
                      placeholder="Add any specific context relevant to your situation..."
                      className="w-full bg-transparent border-none p-0 font-serif text-xl text-oura-dark placeholder:text-stone-300/60 focus:outline-none resize-none leading-relaxed"
                      rows={3}
                      autoFocus
                    />
                    <div className="mt-4 flex justify-end border-t border-stone-100 pt-4">
                      <span className="text-[9px] font-sans uppercase tracking-[0.2em] text-stone-300">
                        {additionalDetails.length} chars
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Selection Grid */}
          <div className="space-y-24 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>

            {/* Coach Selection */}
            <div className="space-y-8">
              <h2 className="text-xs font-sans font-semibold tracking-widest text-stone-400 uppercase pl-2">Select Voice</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {PERSONAS.map((p) => (
                  <PersonaCard
                    key={p.id}
                    name={p.name}
                    description={p.description}
                    icon={<p.icon />}
                    imageSrc={p.image}
                    selected={persona === p.id}
                    onClick={() => setPersona(p.id)}
                  />
                ))}
              </div>
            </div>

            {/* Mood Selection removed */}
          </div>

          {/* Generate Action */}
          <div className="flex flex-col items-center space-y-8 pt-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            {error && (
              <div className="text-red-500 font-serif italic text-lg text-center">{error}</div>
            )}

            <button
              onClick={isStreaming ? stopStream : handleStart}
              disabled={isGenerating && !isStreaming} // Disable only if generating first segment
              className={`group relative w-full md:w-auto min-w-[300px] px-12 py-6 rounded-xl font-serif text-2xl transition-all duration-500 border border-oura-dark ${isStreaming
                ? 'bg-white text-oura-dark border-transparent shadow-xl'
                : 'bg-oura-dark text-white hover:bg-transparent hover:text-oura-dark'
                }`}
            >
              <div className="relative z-10 flex items-center justify-center gap-4">
                {isGenerating && !isStreaming ? (
                  <>
                    <Loader2 className="animate-spin w-6 h-6" />
                    <span className="text-lg font-sans tracking-widest uppercase">Initiating Stream</span>
                  </>
                ) : isStreaming ? (
                  <>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-lg font-sans tracking-widest uppercase">Stop Stream</span>
                  </>
                ) : (
                  <>
                    <div className="relative h-8 w-full overflow-hidden flex flex-col items-center">
                      <span className="block transform transition-transform duration-500 group-hover:-translate-y-10">Start Infinite Motivation</span>
                      <span className="absolute top-0 block transform translate-y-10 transition-transform duration-500 group-hover:translate-y-0 italic">
                        Begin Journey
                      </span>
                    </div>
                  </>
                )}
              </div>
            </button>

            <p className="text-stone-400 text-[10px] font-sans tracking-[0.3em] uppercase opacity-40">
              {isStreaming ? "Live generating..." : "Press to start infinite stream"}
            </p>
          </div>
        </div>

        {/* Floating Minimalist Player */}
        {isStreaming && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg animate-in slide-in-from-top-4 duration-700 ease-out">
            <div className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl rounded-full p-3 pl-4 pr-5 flex items-center gap-4 ring-1 ring-black/5">

              {/* Play/Pause Button */}
              <button
                onClick={togglePause}
                className="flex-shrink-0 w-12 h-12 bg-oura-dark rounded-full flex items-center justify-center text-white hover:scale-105 transition-transform shadow-md"
              >
                {isPaused ? <Play className="w-5 h-5 ml-1 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
              </button>

              {/* Info & Viz */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-serif text-oura-dark text-base truncate pr-2">
                  {persona} Live Stream
                </h3>
                <p className="text-[10px] font-sans uppercase tracking-[0.15em] text-stone-400 animate-pulse">
                  {isPaused ? "Paused" : isGenerating ? "Generating next segment..." : "Streaming"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 border-l border-stone-200 pl-3">
                <button
                  onClick={stopStream}
                  className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Hidden Players - Audio Only */}
              <audio
                ref={audioRef}
                onEnded={handleVoiceEnded}
                onError={(e) => {
                  const target = e.target as HTMLAudioElement;
                  console.error("Audio Element Error:", target.error);
                  setError(`Audio Playback Error: Code ${target.error?.code} - ${target.error?.message || "Unknown"}`);
                  setIsSpeaking(false);
                }}
                onPlay={() => console.log("Audio Element: Playing")}
                onPause={() => console.log("Audio Element: Paused")}
                className="hidden"
              />
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
