"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import AuthPage from "@/components/AuthPage";

export default function LandingPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [redirectPath, setRedirectPath] = useState(null);
  const isAdmin = session?.user?.app_metadata?.role === "admin";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "true") {
      setAuthModalOpen(true);
      const redir = params.get("redirect");
      if (redir) {
        setRedirectPath(redir);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Handle redirect after login if redirectPath exists
  useEffect(() => {
    if (session && redirectPath) {
      router.push(redirectPath);
    }
  }, [session, redirectPath, router]);

  const handleTileClick = (e) => {
    if (!session) {
      e.preventDefault();
      setAuthModalOpen(true);
    }
  };
  return (
    <div className="min-h-screen relative font-sans text-slate-100 selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col justify-between">
      {/* Fixed Full-screen Background */}
      <div 
        className="fixed inset-0 z-[-2]"
        style={{
          backgroundImage: "url('/guinea-pig-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          minHeight: "100vh",
          width: "100%",
        }}
      />
      {/* Subtle Dark Gradient Overlay */}
      <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-slate-950/50 via-slate-900/20 to-slate-950/60" />

      {/* Header Banner */}
      <header className="sticky top-0 z-50 bg-slate-950/40 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
              GuineaPigDoctor
            </h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex space-x-8 text-sm font-semibold text-slate-300">
              <a href="#" className="hover:text-white transition-colors">Platform</a>
              <Link href="/recommended-products" className="hover:text-white transition-colors">Recommended Products</Link>
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
            </div>
            {!session ? (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="py-2 px-4 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 hover:from-indigo-650 hover:to-violet-650 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                Log In / Sign Up
              </button>
            ) : (
              <div className="flex items-center space-x-4">
                {isAdmin && (
                  <Link
                    href="/admin/recommended-products"
                    className="py-2 px-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
                  >
                    Admin Console
                  </Link>
                )}
                <span className="hidden sm:inline text-xs font-bold text-slate-400">
                  {session.user?.email}
                </span>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="py-2 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-300 hover:text-rose-455 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center space-x-1.5 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                  </svg>
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 relative z-10 flex flex-col items-center">
        


        {/* Services Grid (Glassmorphism Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
          
          {/* Card 1: Gender Check (Active Route) */}
          <Link href="/gender-check" className="group block" onClick={handleTileClick}>
            <div className="relative h-full bg-slate-900/30 backdrop-blur-xl border border-white/10 hover:border-indigo-500/50 rounded-3xl p-8 opacity-75 group-hover:opacity-100 transition-all duration-300 ease-out transform group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.4)] overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/40" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                Gender Analytics
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Upload images and define precise ROIs. Utilize PyTorch and Explainable Grad-CAM to predict and analyze gender demographics instantly.
              </p>
              <div className="flex items-center text-indigo-400 font-semibold text-sm group-hover:text-indigo-300">
                Launch Application
                <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Card 2: Breed Classification (Active) */}
          <Link href="/breed-check" className="group block" onClick={handleTileClick}>
            <div className="relative h-full bg-slate-900/30 backdrop-blur-xl border border-white/10 hover:border-indigo-500/50 rounded-3xl p-8 opacity-75 group-hover:opacity-100 transition-all duration-300 ease-out transform group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.4)] overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/40" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                Breed Classification
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Identify the exact breed of your guinea pig using our advanced multimodal Gemini vision model.
              </p>
              <div className="flex items-center text-indigo-400 font-semibold text-sm group-hover:text-indigo-300">
                Launch Application
                <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Card 3: Talk to your Guinea Pig */}
          <Link href="/talk-to-guineapig" className="group block" onClick={handleTileClick}>
            <div className="relative h-full bg-slate-900/30 backdrop-blur-xl border border-white/10 hover:border-indigo-500/50 rounded-3xl p-8 opacity-75 group-hover:opacity-100 transition-all duration-300 ease-out transform group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.4)] overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/40" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30 animate-pulse">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                Talk to your Guinea Pig
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Understand their wheeks, purrs, and chutts with our audio translation AI and sound visualizer.
              </p>
              <div className="flex items-center text-indigo-400 font-semibold text-sm group-hover:text-indigo-300">
                Launch Application
                <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Card 4: Guinea pig diagnonistic */}
          <Link href="/diagnostics" className="group block" onClick={handleTileClick}>
            <div className="relative h-full bg-slate-900/30 backdrop-blur-xl border border-white/10 hover:border-indigo-500/50 rounded-3xl p-8 opacity-75 group-hover:opacity-100 transition-all duration-300 ease-out transform group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.4)] overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/40" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                Guinea Pig Diagnostic
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Describe symptoms or health queries to search our database of matching community threads and solutions.
              </p>
              <div className="flex items-center text-indigo-400 font-semibold text-sm group-hover:text-indigo-300">
                Launch Search
                <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Card 5: Recommended Products (Active Route) */}
          <Link href="/recommended-products" className="group block">
            <div className="relative h-full bg-slate-900/30 backdrop-blur-xl border border-white/10 hover:border-indigo-500/50 rounded-3xl p-8 opacity-75 group-hover:opacity-100 transition-all duration-300 ease-out transform group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.4)] overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/40" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30 animate-pulse">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                Recommended Products
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Explore vet-approved diets, cages, toys, and healthcare supplies handpicked for your guinea pigs.
              </p>
              <div className="flex items-center text-indigo-400 font-semibold text-sm group-hover:text-indigo-300">
                Browse Products
                <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Card 6: Piggy Prints */}
          <Link href="/piggy-prints" className="group block" onClick={handleTileClick}>
            <div className="relative h-full bg-slate-900/30 backdrop-blur-xl border border-white/10 hover:border-indigo-500/50 rounded-3xl p-8 opacity-75 group-hover:opacity-100 transition-all duration-300 ease-out transform group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.4)] overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/40" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30 animate-pulse">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                Piggy Prints
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Discover the best mugs, apparel, and custom printed products for your little guinea pig friend.
              </p>
              <div className="flex items-center text-indigo-400 font-semibold text-sm group-hover:text-indigo-300">
                Launch Portal
                <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Card 7: pet store around you */}
          <div className="relative h-full bg-slate-900/35 backdrop-blur-md border border-white/5 rounded-3xl p-8 overflow-hidden opacity-[0.72]">
            <div className="absolute top-4 right-4 px-3 py-1 bg-slate-800/80 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Coming Soon
            </div>
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-6 border border-slate-700">
              <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-300 mb-3">
              pet store around you
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Find local pet stores with fresh hay, veggies, and cavy supplies.
            </p>
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
      <AuthPage isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
