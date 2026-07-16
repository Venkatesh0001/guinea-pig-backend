"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

export default function BreedClassificationPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setupFile(file);
  };

  const setupFile = (file) => {
    // Basic validation
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds 5MB size limit.");
      return;
    }

    setSelectedFile(file);
    setError("");
    setResult("");
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    setError("");
    setResult("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/breed-check", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server returned code ${response.status}`);
      }

      setResult(data.classification || "No classification response received.");
    } catch (err) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during classification.");
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setResult("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen relative font-sans text-slate-100 selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col justify-between">
      {/* Fixed Full-screen Background */}
      <div 
        className="fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/guinea-pig-bg.jpg')",
        }}
      />
      {/* Subtle Dark Gradient Overlay */}
      <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-slate-950/50 via-slate-900/20 to-slate-950/60" />

      {/* Header Banner */}
      <header className="sticky top-0 z-50 bg-slate-950/40 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
              GuineaPigDoctor
            </h1>
          </Link>
          <div className="flex items-center space-x-4 text-sm font-semibold text-slate-300">
            <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
            <button
              onClick={() => supabase.auth.signOut()}
              className="py-1.5 px-3.5 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-300 hover:text-rose-455 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center space-x-1.5 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 py-12 relative z-10 w-full flex flex-col items-center">
        
        {/* Module Title Header */}
        <div className="text-center mb-8 space-y-3">
          <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-extrabold bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
            Multimodal Visual Classifier
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mt-3">
            Breed Classification
          </h2>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            Take a photo of your guinea pig or upload an image from your gallery. Our expert AI model will classify the specific breed based on coat, texture, and markings.
          </p>
        </div>

        {/* Action Panel Container */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-10">
          
          {/* Left Column: Image Selection Panel */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
            
            {/* Hidden Input Selectors */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {!previewUrl ? (
              <div className="w-full flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-2xl bg-slate-950/20 hover:bg-slate-950/40 transition-colors duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-slate-400 text-sm mb-6">Select an option to input your image</p>
                
                {/* Choose Image Actions */}
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full px-6">
                  {/* Camera action (typically mobile compatible) */}
                  <button
                    type="button"
                    onClick={triggerCamera}
                    className="flex-1 py-3 px-4 rounded-xl bg-indigo-650 hover:bg-indigo-600 active:scale-[0.98] text-white font-bold text-xs transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-indigo-500/10"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Take Photo</span>
                  </button>

                  {/* Local Browse Files */}
                  <button
                    type="button"
                    onClick={triggerUpload}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.98] text-slate-200 font-bold text-xs transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9l-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Browse Gallery</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-6">
                {/* Image Preview Window */}
                <div className="relative w-full max-h-[300px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 flex items-center justify-center select-none group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-[300px] object-contain w-full rounded-2xl"
                  />
                  
                  {/* Reset action overlay */}
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="absolute top-2 right-2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-white/10 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Submit Form */}
                <form onSubmit={handleSubmit} className="w-full">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Analyzing with Gemini...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span>Identify Breed</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Classification Results Output */}
          <div className="flex flex-col h-full space-y-6">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-5 rounded-3xl text-sm font-semibold text-center">
                ⚠️ {error}
              </div>
            )}

            {result ? (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex-grow flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
                
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 border-b border-white/5 pb-4">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs uppercase tracking-widest text-slate-400 font-extrabold">
                      AI Analysis Complete
                    </span>
                  </div>

                  {/* Render the markdown result */}
                  <div className="prose prose-invert text-slate-350 text-sm leading-relaxed max-w-none whitespace-pre-wrap font-medium">
                    {result}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/30 border border-white/5 rounded-3xl p-8 text-center flex-grow flex flex-col justify-center items-center py-16 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-650 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
                <p className="text-sm font-semibold">Results will appear here</p>
                <p className="text-xs max-w-xs mt-1 text-slate-600">Please upload an image and click "Identify Breed" to prompt the classification model.</p>
              </div>
            )}
          </div>
          
        </div>
      </main>

      {/* Footer */}
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
