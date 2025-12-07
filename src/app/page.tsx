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

  // --- PERSISTENCE ---
  const STORAGE_KEY = 'MOTIVATION_USER_STATE';

  // Load state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) setName(parsed.name);
        if (parsed.context) setContext(parsed.context);
        if (parsed.additionalDetails) setAdditionalDetails(parsed.additionalDetails);
        if (parsed.persona) setPersona(parsed.persona);
      }
    } catch (e) {
      console.warn("Failed to load user state", e);
    }
  }, []);

  // Save state on change
  useEffect(() => {
    try {
      const stateToSave = { name, context, additionalDetails, persona };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn("Failed to save user state", e);
    }
  }, [name, context, additionalDetails, persona]);


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

  const player1Ref = useRef<HTMLAudioElement>(null);
  const player2Ref = useRef<HTMLAudioElement>(null);
  const activePlayerIndexRef = useRef<0 | 1>(0); // 0 = Player1, 1 = Player2

  // --- QUEUE SOURCE OF TRUTH ---
  // We use Refs for logic to avoid React state closure staleness issues completely.
  const audioQueueRef = useRef<string[]>([]);
  const scriptQueueRef = useRef<string[]>([]);

  // Track which player has what
  const nextTrackReadyRef = useRef(false); // Is the "other" player loaded and ready to go?

  // Helpers to keep Ref and State in sync
  const addToQueue = useCallback((audioUrl: string, scriptText: string) => {
    // If the URL is relative, make it absolute immediately for consistency
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
    const fullAudioUrl = (audioUrl.startsWith('http') || audioUrl.startsWith('data:')) ? audioUrl : `${API_BASE}${audioUrl}`;

    // Do we strip params for Data URIs? Yes.
    const finalUrl = fullAudioUrl.startsWith('data:') ? fullAudioUrl : `${fullAudioUrl}?t=${Date.now()}`;

    audioQueueRef.current.push(finalUrl);
    scriptQueueRef.current.push(scriptText); // We can still queue scripts for history

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
  const isSpeakingRef = useRef(isSpeaking); // "Speaking" now means AT LEAST ONE player is playing

  const fullHistoryRef = useRef<string[]>([]);
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


  // Infinite Generation Loop 
  const generateNextSegment = useCallback(async (history: string[]) => {
    if (isGeneratingRef.current) return;
    setIsGenerating(true);
    setError(null);

    try {
      const { name, context, additionalDetails, persona } = paramsRef.current;
      const fullContext = additionalDetails ? `${context}. Additional context: ${additionalDetails}` : context;
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

      const res = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, context: fullContext, persona, previousScripts: history }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');

      if (data.url) {
        addToQueue(data.url, data.script);
        console.log("Segment added. Queue size:", audioQueueRef.current.length);
      }
    } catch (e: any) {
      console.error("Generation failed", e);
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  }, [addToQueue]);


  // --- GAPLESS AUDIO ENGINE ---

  // Preloads the next item into the INACTIVE player
  const preloadNextTrack = useCallback(() => {
    // 1. Check if we have stuff in queue
    if (audioQueueRef.current.length === 0) return;

    // 2. Identify Inactive Player
    const activeIndex = activePlayerIndexRef.current;
    const inactiveIndex = activeIndex === 0 ? 1 : 0;
    const targetPlayer = inactiveIndex === 0 ? player1Ref.current : player2Ref.current;

    if (!targetPlayer) return;
    if (nextTrackReadyRef.current) return; // Already has something loaded?

    // 3. Pop from queue
    const { nextAudio, nextScript } = shiftQueue();
    if (!nextAudio) return;

    console.log(`Preloading into Player ${inactiveIndex + 1}:`, nextAudio.substring(0, 30));

    // 4. Load it
    targetPlayer.src = nextAudio;
    targetPlayer.load();

    // We assume it's ready once we set it (or we can listen to canplay)
    // For simplicity with Data URIs, it's usually instant.
    nextTrackReadyRef.current = true;

    // Note: We don't verify 'canplay' here for speed, but ideally we would.
    if (nextScript) {
      // We might want to store this script to show it when it ACTUALLY plays
      // For now, we update history immediately for generation context
      setFullHistory(prev => {
        const newHistory = [...prev, nextScript];
        const bufferSize = audioQueueRef.current.length;
        // Trigger generation if buffer low (checking both queue AND the preloaded one)
        // If we just popped one, queue is smaller.
        if (bufferSize <= 2 && !isGeneratingRef.current) {
          generateNextSegment(newHistory);
        }
        return newHistory;
      });
      setCurrentScript(nextScript); // This updates UI “Too Early” (during preload), but acceptable for "Next Up" feel
    }

  }, [shiftQueue, generateNextSegment]);


  // This is called when the ACTIVE player finishes
  const handleTrackEnded = useCallback(async () => {
    console.log("Track Ended. Switching players...");

    const activeIndex = activePlayerIndexRef.current;
    const inactiveIndex = activeIndex === 0 ? 1 : 0;

    const activePlayer = activeIndex === 0 ? player1Ref.current : player2Ref.current;
    const nextPlayer = inactiveIndex === 0 ? player1Ref.current : player2Ref.current;

    // 1. Swap Indices
    activePlayerIndexRef.current = inactiveIndex as 0 | 1;

    // 2. Play the Next One (if ready)
    if (nextPlayer && nextTrackReadyRef.current) {
      console.log(`Starting Player ${inactiveIndex + 1} IMMEDIATELY`);
      nextPlayer.play().catch(e => console.error("Playback failed switch", e));
      nextTrackReadyRef.current = false; // It's now consumed

      // 3. Preload the NEXT NEXT one into the old active player
      preloadNextTrack();
    } else {
      console.log("Next track wasn't ready! Stalling...");
      setIsSpeaking(false);
      // If queue has items, try to preload and play manually?
      // The queue watcher effect should kick in.
      nextTrackReadyRef.current = false;
      preloadNextTrack(); // Try to load something
      // If we load something now, we need to auto-play it when ready.
      // For now, we rely on the Watcher to see "Oh, not speaking, but queue has items"
    }
  }, [preloadNextTrack]);


  // Initial Start / Resume
  const playNext = useCallback(async () => {
    // This is acting as "Kickstart" now.
    if (!isStreamingRef.current || isPausedRef.current) return;
    if (isSpeakingRef.current) return; // Already going

    // Identify current player
    const activeIndex = activePlayerIndexRef.current;
    const activePlayer = activeIndex === 0 ? player1Ref.current : player2Ref.current;

    if (!activePlayer) return;

    // Case A: Next track IS ready in Current (Wait, if it was ready, why isn't it playing?)
    // Actually, nextTrackReadyRef refers to the *inactive* player.

    // Case B: Nothing playing. Check if we need to load active player from queue?
    // If we are fully stopped, reload active player.
    if (audioQueueRef.current.length > 0) {
      const { nextAudio, nextScript } = shiftQueue();
      if (nextAudio) {
        console.log("Kickstarting Player", activeIndex + 1);
        activePlayer.src = nextAudio;
        activePlayer.load();
        setIsSpeaking(true);
        await activePlayer.play();

        if (nextScript) {
          setFullHistory(prev => {
            const newHistory = [...prev, nextScript];
            if (audioQueueRef.current.length <= 2 && !isGeneratingRef.current) {
              generateNextSegment(newHistory);
            }
            return newHistory;
          });
          setCurrentScript(nextScript);
        }

        // Immediately preload next into the OTHER player
        preloadNextTrack();
      }
    }
  }, [shiftQueue, generateNextSegment, preloadNextTrack]);


  // Stop Stream
  const stopStream = () => {
    setIsStreaming(false);
    setIsPaused(false);
    setIsSpeaking(false);
    activePlayerIndexRef.current = 0;
    nextTrackReadyRef.current = false;

    audioQueueRef.current = [];
    scriptQueueRef.current = [];
    setAudioQueue([]);
    setScriptQueue([]);
    setFullHistory([]);
    setCurrentScript(null);
    setError(null);

    if (player1Ref.current) { player1Ref.current.pause(); player1Ref.current.currentTime = 0; player1Ref.current.src = ''; }
    if (player2Ref.current) { player2Ref.current.pause(); player2Ref.current.currentTime = 0; player2Ref.current.src = ''; }
  };


  const handleStart = async () => {
    if (!name || !context) { setError('Please tell me who you are and what you need.'); return; }
    setError(null);
    setIsStreaming(true);
    setIsPaused(false);
    setIsSpeaking(false);
    await generateNextSegment([]);
  };

  const togglePause = () => {
    const activePlayer = activePlayerIndexRef.current === 0 ? player1Ref.current : player2Ref.current;
    if (isPaused) {
      // RESUME
      setIsPaused(false);
      if (activePlayer && activePlayer.src) {
        activePlayer.play();
        setIsSpeaking(true);
      } else {
        playNext();
      }
    } else {
      // PAUSE
      setIsPaused(true);
      if (activePlayer) activePlayer.pause();
      setIsSpeaking(false);
    }
  };

  // Watcher
  useEffect(() => {
    if (!isStreaming) return;
    if (isPaused) return;

    // If not speaking, try to kickstart
    if (!isSpeaking) {
      playNext();
    }
  }, [audioQueue, isStreaming, isPaused, isSpeaking, playNext]);


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
                  {isPaused ? "Paused" : isQuestion(currentScript) ? "Asking Question..." : isGenerating ? "Generating next segment..." : "Streaming"}
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

              {/* Hidden Players - Audio Only - DUAL BUFFER */}
              <audio
                ref={player1Ref}
                onEnded={handleTrackEnded}
                onError={(e) => {
                  console.error("Player 1 Error:", e.currentTarget.error);
                  handleTrackEnded(); // Try skip
                }}
                className="hidden"
              />
              <audio
                ref={player2Ref}
                onEnded={handleTrackEnded}
                onError={(e) => {
                  console.error("Player 2 Error:", e.currentTarget.error);
                  handleTrackEnded(); // Try skip
                }}
                className="hidden"
              />
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

// Quick helper
function isQuestion(s: string | null) {
  if (!s) return false;
  return s.trim().endsWith('?');
}
