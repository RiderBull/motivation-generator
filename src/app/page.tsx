"use client";

import { useState, useRef, useEffect } from 'react';
import { AutoInput } from '@/components/AutoInput';
import { PersonaCard } from '@/components/PersonaCard';
import { MoodCard } from '@/components/MoodCard';
import { Mic, Zap, Briefcase, BookOpen, Loader2, Play, Pause, Download, Sparkles, Volume2 } from 'lucide-react';

const PERSONAS = [
  { id: 'Steve Jobs', name: 'Steve Jobs', description: 'of design', icon: Briefcase, image: '/images/steve.png' },
  // { id: 'Goggins', name: 'Goggins', description: 'of discipline', icon: Mic, image: '/images/goggins.png' }, // Unavailable
  { id: 'Hormozi', name: 'Hormozi', description: 'of leverage', icon: Zap, image: '/images/hormozi.png' },
  { id: 'Bible', name: 'Bible', description: 'of wisdom', icon: BookOpen, image: '/images/bible.png' },
];

const MOODS = [
  { id: 'Motivational', name: 'Motivational', description: 'into focus', color: '#ef4444' },
  { id: 'Emotional', name: 'Emotional', description: 'into feeling', color: '#3b82f6' },
];

export default function Home() {
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [persona, setPersona] = useState(PERSONAS[0].id);
  const [mood, setMood] = useState(MOODS[0].id);

  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const generateSpeech = async () => {
    if (!name || !context) {
      setError('Please tell me who you are and what you need.');
      return;
    }
    setError(null);
    setIsLoading(true);
    setAudioUrl(null);
    setScript(null);

    // Combine context with additional details if present
    const fullContext = additionalDetails
      ? `${context}. Additional context about me: ${additionalDetails}`
      : context;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, context: fullContext, persona, mood }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');

      setAudioUrl(data.url);
      setScript(data.script);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPersona = PERSONAS.find(p => p.id === persona);
  const selectedMood = MOODS.find(m => m.id === mood);

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

            {/* Creative 'Deep Dive' Context Input */}
            <div className="mt-12 w-full max-w-2xl perspective-1000">
              {!showDetails ? (
                <button
                  onClick={() => setShowDetails(true)}
                  className="group flex flex-col items-center gap-2 mx-auto transition-all duration-700 hover:scale-110"
                >
                  <div className="w-12 h-12 rounded-full border border-stone-300 flex items-center justify-center group-hover:border-oura-accent group-hover:bg-oura-accent/5 transition-colors">
                    <span className="text-xl font-serif italic text-stone-400 group-hover:text-oura-accent">+</span>
                  </div>
                  <span className="text-[10px] font-sans tracking-[0.3em] uppercase text-stone-300 group-hover:text-oura-accent transition-colors">
                    Deep Dive
                  </span>
                </button>
              ) : (
                <div className="relative animate-in zoom-in-95 fade-in duration-700 ease-out">
                  {/* Artistic Backdrop/Frame */}
                  <div className="absolute -inset-4 bg-gradient-to-b from-white/80 to-white/40 rounded-[2rem] blur-xl -z-10" />

                  <div className="bg-[#fcfbf9] relative p-8 md:p-12 rounded-[2px] shadow-2xl border-l-[6px] border-oura-accent/20 overflow-hidden transform rotate-[-1deg] hover:rotate-0 transition-transform duration-500">
                    {/* Paper texture noise overlay for vellum feel */}
                    <div className="absolute inset-0 bg-grain opacity-[0.05] pointer-events-none" />

                    <div className="flex justify-between items-start mb-6 border-b border-stone-200 pb-4">
                      <span className="font-serif italic text-2xl text-oura-dark">The Archives</span>
                      <button
                        onClick={() => setShowDetails(false)}
                        className="text-[10px] uppercase tracking-widest text-stone-300 hover:text-oura-accent transition-colors"
                      >
                        Close
                      </button>
                    </div>

                    <textarea
                      value={additionalDetails}
                      onChange={(e) => setAdditionalDetails(e.target.value)}
                      placeholder="Whisper your context here. The more honest, the more potent the result..."
                      className="w-full bg-transparent border-none p-0 font-serif text-xl md:text-2xl text-oura-dark/80 placeholder:text-stone-300/50 focus:outline-none resize-none leading-relaxed italic"
                      rows={4}
                      autoFocus
                    />

                    <div className="mt-6 flex justify-end">
                      <span className="text-[10px] font-sans uppercase tracking-[0.2em] text-stone-300">
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

            {/* ... (Coach Selection - Keep as is just map fix if needed) ... */}
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

            {/* Mood Selection - Updated for Minimalist Style */}
            <div className="space-y-8">
              <h2 className="text-xs font-sans font-semibold tracking-widest text-stone-400 uppercase pl-2">Select Vibe</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {MOODS.map((m) => (
                  <MoodCard
                    key={m.id}
                    name={m.name}
                    description={m.description}
                    color={m.color}
                    selected={mood === m.id}
                    onClick={() => setMood(m.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Generate Action */}
          <div className="flex flex-col items-center space-y-8 pt-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            {error && (
              <div className="text-red-500 font-serif italic text-lg">{error}</div>
            )}

            <button
              onClick={generateSpeech}
              disabled={isLoading}
              className={`group relative w-full md:w-auto min-w-[300px] px-12 py-6 rounded-xl font-serif text-2xl transition-all duration-500 border border-oura-dark ${isLoading
                ? 'bg-transparent text-stone-400 cursor-not-allowed border-stone-300'
                : 'bg-oura-dark text-white hover:bg-transparent hover:text-oura-dark'
                }`}
            >
              <div className="relative z-10 flex items-center justify-center gap-4">
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin w-6 h-6" />
                    <span className="text-lg font-sans tracking-widest uppercase">Fabricating</span>
                  </>
                ) : (
                  <>
                    <div className="relative h-8 w-full overflow-hidden flex flex-col items-center">
                      <span className="block transform transition-transform duration-500 group-hover:-translate-y-10">Ignite Information</span>
                      <span className="absolute top-0 block transform translate-y-10 transition-transform duration-500 group-hover:translate-y-0 italic">
                        Generate Manifesto
                      </span>
                    </div>
                  </>
                )}
              </div>
            </button>

            <p className="text-stone-400 text-[10px] font-sans tracking-[0.3em] uppercase opacity-40">
              {isLoading ? "Consulting the archives..." : "Press to generate your manifesto"}
            </p>
          </div>
        </div>

        {/* Immersive Modal / Overlay Result */}
        {audioUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-700">

            {/* Cinematic Background Glow */}
            {selectedMood && (
              <div
                className="absolute inset-0 opacity-30 blur-[100px]"
                style={{
                  background: `radial-gradient(circle at center, ${selectedMood.color}, transparent 70%)`
                }}
              />
            )}

            <div className="w-full max-w-2xl bg-[#f2f0e9]/90 backdrop-blur-xl p-8 md:p-16 rounded-[3rem] shadow-2xl m-4 relative overflow-hidden ring-1 ring-white/20">

              <button
                onClick={() => setAudioUrl(null)}
                className="absolute top-8 right-8 text-stone-400 hover:text-oura-dark transition-colors z-20"
              >
                Close
              </button>

              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-oura-accent via-purple-500 to-oura-accent animate-grain" />

              <div className="text-center space-y-12 relative z-10">
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-oura-dark text-white mb-6 shadow-lg">
                    <Volume2 className="w-6 h-6 animate-pulse" />
                  </div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif text-oura-dark leading-snug italic px-4">
                    "{script}"
                  </h2>
                  <p className="text-stone-500 font-sans tracking-widest uppercase text-[10px] space-x-2">
                    <span>Generated for {name}</span>
                    <span className="text-stone-300">•</span>
                    <span>{selectedPersona?.name} Style</span>
                  </p>
                </div>

                <div className="bg-white/60 p-6 rounded-2xl border border-white/50 shadow-inner backdrop-blur-sm">
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-10 focus:outline-none mix-blend-darken filter sepia-[0.1]"
                  />
                </div>

                <div className="flex justify-center pt-4">
                  <a
                    href={audioUrl}
                    download={`motivation-${persona}.mp3`}
                    className="group relative inline-flex items-center gap-2 px-8 py-3 rounded-full bg-oura-dark text-white hover:bg-black transition-all hover:scale-105 shadow-lg"
                  >
                    <span className="text-sm font-medium tracking-wide">Download Audio</span>
                    <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
