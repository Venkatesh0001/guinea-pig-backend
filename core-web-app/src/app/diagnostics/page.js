"use client";

import React, { useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

export default function DiagnosticsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const response = await fetch("/api/diagnostics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch diagnostic matches.");
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center space-x-4 text-sm font-semibold text-slate-350">
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
        <div className="text-center mb-10 space-y-3">
          <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-extrabold bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
            Customer Problem Query Lookup
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mt-3">
            Guinea Pig Diagnostic Search
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Describe symptoms or health issues your guinea pig is experiencing. We'll search our Facebook group database to find similar cases and community-sourced solutions.
          </p>
        </div>

        {/* Query Lookup Form */}
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden mb-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
          
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="symptoms" className="text-sm font-bold text-slate-300 block">
                Describe the symptoms or behaviors:
              </label>
              <textarea
                id="symptoms"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., my guinea pig is pooping in clump / he has a bald spot behind his ear after a bath / his eye is cloudy and watery"
                rows={4}
                required
                className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Searching Database...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Analyze query</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Results / Error / Empty States */}
        <div className="w-full space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-450 p-4 rounded-2xl text-sm font-semibold text-center">
              ⚠️ {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-300 flex items-center space-x-2 px-1">
                <span>Top 5 Relevant Matches Found</span>
                <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-extrabold font-mono">
                  {results.length} results
                </span>
              </h3>

              <div className="space-y-4">
                {results.map((result, idx) => (
                  <div 
                    key={result.id || idx}
                    className="relative bg-white/5 backdrop-blur-xl border border-white/10 hover:border-indigo-500/40 rounded-2xl p-6 transition-all duration-300 ease-out transform hover:-translate-y-1 hover:shadow-xl overflow-hidden group"
                  >
                    {/* Background glows */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-indigo-500/20 transition-all duration-300" />
                    
                    {/* Header metrics */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono font-bold text-xs text-indigo-400">
                          #{idx + 1}
                        </div>
                        <span className="text-xs font-bold text-slate-400">
                          Community Thread
                        </span>
                      </div>
                      
                      <div className="text-xs font-extrabold font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-0.5 rounded-full">
                        {Math.round(result.score * 100)}% match
                      </div>
                    </div>

                    {/* Post content, replies & advice */}
                    <div className="space-y-4 mb-6">
                      
                      {/* Parent Post (Question Context) */}
                      {result.parent_post_content && (
                        <div className="bg-slate-950/40 border border-white/5 rounded-xl p-4">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-1">
                            Original Question / Context:
                          </span>
                          <p className="text-slate-350 text-xs leading-relaxed italic">
                            "{result.parent_post_content}"
                          </p>
                        </div>
                      )}

                      {/* Best Solution (Direct Semantic Match) */}
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 relative">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold flex items-center mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-ping" />
                          Community Answer (by {result.matched_comment.author}):
                        </span>
                        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                          {result.matched_comment.content}
                        </p>
                      </div>

                      {/* Other thread replies */}
                      {result.other_replies && result.other_replies.length > 0 && (
                        <div className="bg-slate-950/20 border border-white/5 rounded-xl p-4 space-y-2">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block">
                            Other replies in this discussion:
                          </span>
                          <div className="space-y-2 divide-y divide-white/5">
                            {result.other_replies.map((reply, rIdx) => (
                              <div key={rIdx} className="text-xs text-slate-350 pt-2 first:pt-0">
                                <span className="font-bold text-slate-300">{reply.author}: </span>
                                "{reply.content}"
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Predefined expert advice synthesis */}
                      {result.advice && (
                        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl -mr-6 -mt-6" />
                          <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-extrabold flex items-center mb-2">
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Expert Synthesis ({result.category}):
                          </span>
                          <p className="text-slate-250 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                            {result.advice}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer Facebook Link */}
                    <div className="flex justify-end pt-3 border-t border-white/5">
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-bold text-indigo-400 hover:text-indigo-300 group-hover:translate-x-0.5 transition-all duration-200"
                      >
                        View Original Thread on Facebook
                        <svg className="w-3.5 h-3.5 ml-1.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty Results Placeholder */}
          {!loading && !error && results.length === 0 && query && (
            <div className="bg-slate-900/30 border border-white/5 p-8 rounded-3xl text-center space-y-2">
              <p className="text-slate-350 text-sm font-semibold">No direct matches found</p>
              <p className="text-slate-500 text-xs">Try simplifying your symptom description or check spelling.</p>
            </div>
          )}
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
