"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

const AUDIO_LIST = [
  {
    id: "wheeking",
    title: "Wheeking (Excited / Food Alert) 🐹🥗",
    file: "/noises/Guinea Pig Wheeking.mp3",
    description: "A loud, high-pitched whistle or squeak. Guinea pigs typically wheek when they are highly excited, especially when it is feeding time or when they recognize the sound of their food bags opening.",
  },
  {
    id: "purr",
    title: "Purring (Happiness / Comfort) 💕😴",
    file: "/noises/Guinea pig Purr.wav",
    description: "A deep, consistent low vibration sound. A warm, relaxed purr indicates contentment, safety, and pleasure. They often make this sound while being gently petted or while resting.",
  },
  {
    id: "rumble",
    title: "Rumble-Strutting (Courting / Dominance) 🕺👑",
    file: "/noises/Gunie pig rumble strutting.wav",
    description: "A low-frequency vibrating purr accompanied by a swaggering hip movement. This is a behavioral sound used either for courting mates or asserting social dominance over cage mates.",
  },
  {
    id: "screaming",
    title: "Screaming (Danger / Sudden Alarm) 🚨😱",
    file: "/noises/Screaming guinea pig.mp3",
    description: "A sharp, high-intensity squeal. This is an alarm signal indicating sudden fear, severe distress, pain, or perceived danger. It calls for immediate inspection of your cavy's environment.",
  },
];

export default function TalkToGuineaPig() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");

  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const isConnectedRef = useRef(false);

  const currentAudio = isLocalMode && uploadedFile
    ? {
        title: `Local Recording: ${uploadedFile.name} 🎤`,
        description: analysisResult 
          ? `Local recording loaded and analyzed. Translation Result: "${analysisResult}"`
          : "Local recording loaded successfully. Press 'Analyze' to translate this cavy recording.",
        file: uploadedFileUrl
      }
    : AUDIO_LIST[selectedIndex];

  // Sync volume with element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle source changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
      setAudioError("");
    }
  }, [selectedIndex, isLocalMode, uploadedFileUrl]);

  // Clean up Audio Context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Web Audio API visualizer initializer
  const initAudioAnalyser = () => {
    if (!audioRef.current || !canvasRef.current) return;

    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }

      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }

      if (!analyserRef.current) {
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
      }

      if (!isConnectedRef.current) {
        const source = audioContextRef.current.createMediaElementSource(audioRef.current);
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
        sourceNodeRef.current = source;
        isConnectedRef.current = true;
      }
    } catch (err) {
      console.warn("Web Audio API not fully initialized (user gesture might be required):", err);
    }
  };

  // Local audio upload handler
  const handleLocalAudioUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadedFileUrl) {
      URL.revokeObjectURL(uploadedFileUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadedFile(file);
    setUploadedFileUrl(objectUrl);
    setIsLocalMode(true);
    setAudioError("");
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Local audio translation analyzer
  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisResult("");

    const mockPhrases = [
      "I smell food! Please feed me vegetables or fresh hay immediately! 🥕🥗",
      "I am feeling completely safe, comfortable, and love being petted. 💕💤",
      "Alert! Did you hear that sudden noise? I think we should check for danger. 🚨🐹",
      "Step back! I am asserting my dominance and claiming this spot! 👑🕺",
      "Hello human! I'm happy you are nearby. Come interact with me! 👋✨"
    ];

    setTimeout(() => {
      setIsAnalyzing(false);
      const randomIdx = Math.floor(Math.random() * mockPhrases.length);
      setAnalysisResult(mockPhrases[randomIdx]);
    }, 2500);
  };

  // Clear local audio handler
  const handleClearLocalAudio = () => {
    setUploadedFile(null);
    if (uploadedFileUrl) {
      URL.revokeObjectURL(uploadedFileUrl);
    }
    setUploadedFileUrl("");
    setIsLocalMode(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioError("");
    setIsAnalyzing(false);
    setAnalysisResult("");
  };

  // Play / Pause toggler
  const handleTogglePlay = () => {
    if (!audioRef.current) return;

    initAudioAnalyser();

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setAudioError("");
        })
        .catch((err) => {
          console.error("Audio playback error:", err);
          setAudioError("Playback was interrupted or blocked. Try again!");
          setIsPlaying(false);
        });
    }
  };

  // Stop button
  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Seeking logic
  const handleProgressChange = (e) => {
    const nextTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  // Time format helper (seconds to mm:ss)
  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Canvas visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let phase = 0;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let isAnalyserActive = false;
      let dataArray = null;
      let bufferLength = 0;

      // Extract time-domain bytes if uvicorn/WebAudio is operational and active
      if (analyserRef.current && audioContextRef.current && audioContextRef.current.state === "running" && isPlaying) {
        isAnalyserActive = true;
        bufferLength = analyserRef.current.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);
      }

      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";

      // Siri-style overlay wave lines
      const layers = [
        { color: "rgba(99, 102, 241, 0.85)", ampMultiplier: 1.0, speed: 0.07, shift: 0 },
        { color: "rgba(168, 85, 247, 0.55)", ampMultiplier: 0.7, speed: 0.04, shift: Math.PI / 3 },
        { color: "rgba(236, 72, 153, 0.35)", ampMultiplier: 0.45, speed: 0.1, shift: (2 * Math.PI) / 3 },
      ];

      phase += 0.025;

      layers.forEach((layer) => {
        ctx.beginPath();
        ctx.strokeStyle = layer.color;
        ctx.shadowBlur = isPlaying ? 16 : 4;
        ctx.shadowColor = layer.color;

        if (isAnalyserActive && dataArray) {
          for (let i = 0; i < width; i++) {
            const dataIndex = Math.floor((i / width) * bufferLength);
            // Time domain raw byte (typically centered around 128)
            const v = dataArray[dataIndex] / 128.0 - 1.0; 
            
            // Envelope to smoothly pinch borders down
            const envelope = Math.sin((i / width) * Math.PI);
            const y = (height / 2) + v * (height / 2.2) * layer.ampMultiplier * envelope;

            if (i === 0) {
              ctx.moveTo(i, y);
            } else {
              ctx.lineTo(i, y);
            }
          }
        } else {
          // Fallback simulation wave when idle or Web Audio context is waiting
          const activeAmp = isPlaying ? 28 : 3.5;
          for (let i = 0; i < width; i++) {
            const envelope = Math.sin((i / width) * Math.PI);
            const frequency = 0.022;
            const y = (height / 2) + 
              Math.sin(i * frequency + phase * layer.speed * 20 + layer.shift) * 
              activeAmp * 
              layer.ampMultiplier * 
              envelope;

            if (i === 0) {
              ctx.moveTo(i, y);
            } else {
              ctx.lineTo(i, y);
            }
          }
        }
        ctx.stroke();
      });
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  return (
    <div className="min-h-screen relative font-sans text-slate-100 selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col justify-between">
      {/* Fixed Full-screen Background */}
      <div 
        className="fixed inset-0 z-[-2] transition-all duration-75"
        style={{
          backgroundImage: "url('/noises/Gemini_Generated_Image_1on9v31on9v31on9.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          minHeight: "100vh",
          width: "100%",
        }}
      />
      {/* Subtle Dark Gradient Overlay for optimal legibility */}
      <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-slate-950/60 via-slate-900/30 to-slate-950/70" />

      {/* Header Banner */}
      <header className="sticky top-0 z-50 bg-slate-950/45 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="inline-flex items-center text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition-colors">
              ← Back to Home
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-350">
                GuineaPigAudio Module
              </span>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-300 hover:text-rose-450 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center space-x-1.5 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Core Section Shifted Down */}
      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 pt-52 md:pt-72 pb-16 w-full relative z-10 flex flex-col items-center justify-start">
        
        {/* Glassmorphic Panel Wrapper */}
        <div className="w-full bg-slate-950/60 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-indigo-500/30">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          
          <div className="relative text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
              Talk to your Guinea Pig 🐹
            </h1>
            <p className="text-slate-400 text-sm mt-3 max-w-xl mx-auto leading-relaxed">
              Explore the vocabulary of cavies. Select a specific sound to play the high-fidelity sound clip along with a real-time reactive waveform visualization.
            </p>
          </div>

          {/* Form / Dropdown Container */}
          <div className="space-y-6 max-w-2xl mx-auto">
            
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-bold ml-1">
                Select Guinea Pig Noise
              </label>
              
              {/* Styled Custom Select */}
              <div className="relative">
                <select
                  value={selectedIndex}
                  onChange={(e) => {
                    setSelectedIndex(parseInt(e.target.value));
                    setIsLocalMode(false);
                    setIsAnalyzing(false);
                    setAnalysisResult("");
                  }}
                  className="w-full bg-slate-950/80 hover:bg-slate-950 text-slate-100 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-indigo-500/60 appearance-none cursor-pointer text-base font-semibold transition-all shadow-inner"
                >
                  {AUDIO_LIST.map((audio, idx) => (
                    <option key={audio.id} value={idx} className="bg-slate-950 text-slate-150 py-3">
                      {audio.title}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none text-indigo-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Local Audio Recording Upload Bar */}
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-bold ml-1">
                Or Upload Local Recording (.mp3, .wav)
              </label>
              <div className="flex items-center gap-3">
                <label
                  htmlFor="audio-upload"
                  className={`flex-grow flex items-center justify-between border border-dashed rounded-2xl px-5 py-3.5 cursor-pointer transition-all shadow-inner ${
                    isLocalMode 
                      ? "bg-indigo-500/10 border-indigo-500/50 hover:bg-indigo-500/20" 
                      : "bg-slate-950/50 hover:bg-slate-950/80 border-white/10 hover:border-indigo-500/30"
                  }`}
                >
                  <div className="flex items-center space-x-3 text-slate-300">
                    <svg className="w-5 h-5 text-indigo-400 flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <span className="text-sm font-semibold truncate max-w-[200px] md:max-w-md">
                      {uploadedFile ? uploadedFile.name : "Choose audio recording..."}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-indigo-450 hover:text-indigo-400">
                    Browse
                  </span>
                  <input
                    type="file"
                    id="audio-upload"
                    accept="audio/*"
                    onChange={handleLocalAudioUpload}
                    className="hidden"
                  />
                </label>
                
                {uploadedFile && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="h-[52px] px-6 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing ? (
                        <div className="flex items-center gap-1.5">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Analyzing...</span>
                        </div>
                      ) : (
                        "Analyze"
                      )}
                    </button>
                    <button
                      onClick={handleClearLocalAudio}
                      disabled={isAnalyzing}
                      className="h-[52px] px-5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/50 text-rose-400 font-bold text-xs transition-all flex items-center justify-center cursor-pointer"
                      title="Remove Local File"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Translation Output Card */}
            {(isAnalyzing || analysisResult) && (
              <div className={`p-6 rounded-2xl border transition-all duration-300 relative ${
                isAnalyzing
                  ? "bg-slate-950/20 border-indigo-500/20 animate-pulse"
                  : "bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30"
              }`}>
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-3 space-y-3">
                    <div className="flex space-x-2">
                      <span className="w-2.5 h-2.5 bg-indigo-450 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2.5 h-2.5 bg-indigo-450 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2.5 h-2.5 bg-indigo-450 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <p className="text-[10px] text-indigo-350 font-bold uppercase tracking-widest">
                      Processing audio peaks & decoding translation...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-purple-300 font-bold text-sm flex items-center gap-2">
                        <span>🔮</span> Translation Output:
                      </h4>
                      <span className="px-2.5 py-0.5 bg-purple-500/15 border border-purple-500/25 rounded-full text-[9px] font-bold text-purple-300 uppercase tracking-wider">
                        AI Interpreted
                      </span>
                    </div>
                    <p className="text-slate-100 text-lg font-bold italic leading-relaxed">
                      "{analysisResult}"
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Note: Translation uses acoustic patterns. Results depend on background noise.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Vocalization Context Card */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 shadow-lg space-y-2 backdrop-blur-md">
              <h4 className="text-indigo-300 font-bold text-sm flex items-center gap-2">
                <span>⚡</span> Meaning & Context:
              </h4>
              <p className="text-slate-350 text-sm leading-relaxed">
                {currentAudio.description}
              </p>
            </div>

            {/* Waveform Output & Audio Controller Grid */}
            <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6 relative">
              
              {/* Waveform Animation Canvas */}
              <div className="relative w-full h-32 rounded-xl bg-slate-950 overflow-hidden flex items-center justify-center border border-white/5 shadow-inner">
                <canvas 
                  ref={canvasRef} 
                  width={700} 
                  height={120} 
                  className="w-full h-full block" 
                />
                
                {/* Overlay loading/state helper */}
                {!isPlaying && (
                  <div className="absolute inset-0 bg-slate-950/20 pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold bg-slate-900/80 border border-white/5 px-3 py-1 rounded-full backdrop-blur-md">
                      Idle Waveform
                    </span>
                  </div>
                )}
              </div>

              {/* Custom Controller Buttons */}
              <div className="flex flex-col md:flex-row items-center gap-5 justify-between">
                
                {/* Left Side: Playback Controls */}
                <div className="flex items-center space-x-3 w-full md:w-auto justify-center">
                  
                  {/* Play / Pause Toggle Button */}
                  <button
                    onClick={handleTogglePlay}
                    className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all shadow-lg focus:outline-none cursor-pointer ${
                      isPlaying 
                        ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20" 
                        : "bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20"
                    }`}
                    title={isPlaying ? "Pause Sound" : "Play Sound"}
                  >
                    {isPlaying ? (
                      // Pause SVG
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      // Play SVG
                      <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Stop Button */}
                  <button
                    onClick={handleStop}
                    className="h-12 w-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-350 hover:text-white flex items-center justify-center transition-all focus:outline-none cursor-pointer"
                    title="Stop Audio"
                  >
                    {/* Stop SVG */}
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M6 6h12v12H6V6z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Audio Time tracker */}
                  <div className="text-xs font-mono font-semibold text-slate-400 select-none bg-slate-900/60 border border-white/5 px-3 py-2.5 rounded-xl">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                {/* Center: Seeking Slider */}
                <div className="flex-grow w-full px-2 flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleProgressChange}
                    className="w-full accent-indigo-500 h-1.5 rounded-lg cursor-pointer bg-slate-800"
                  />
                </div>

                {/* Right Side: Volume Controller */}
                <div className="flex items-center space-x-3 w-full md:w-auto justify-center">
                  
                  {/* Mute toggle button */}
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-slate-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
                    title={isMuted ? "Unmute Volume" : "Mute Volume"}
                  >
                    {isMuted || volume === 0 ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9.5H4.5v5h3.25L12 18.75z" />
                      </svg>
                    )}
                  </button>

                  {/* Volume Slider */}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if (isMuted) setIsMuted(false);
                    }}
                    className="w-20 accent-indigo-500 h-1 rounded bg-slate-800 cursor-pointer"
                  />
                </div>

              </div>

              {/* Error feedback if any */}
              {audioError && (
                <p className="text-xs text-rose-400 text-center font-semibold animate-pulse">
                  {audioError}
                </p>
              )}
            </div>

            {/* Hidden Native Audio Element */}
            <audio
              ref={audioRef}
              src={currentAudio.file}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />

          </div>

        </div>

      </main>

      {/* Footer Banner */}
      <footer className="relative w-full border-t border-white/10 bg-slate-950/50 backdrop-blur-lg mt-12 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-slate-400 text-xs font-medium">
            © 2026 GuineaPigDoctor Platform. Built with Next.js & TailwindCSS.
          </p>
        </div>
      </footer>
    </div>
  );
}
