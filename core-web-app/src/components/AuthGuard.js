"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

export default function AuthGuard({ children }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session && pathname !== "/") {
      // Redirect unauthenticated user to home page to prompt login
      router.push("/?login=true");
    }
  }, [session, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex flex-col justify-center items-center bg-slate-950 text-slate-100 font-sans select-none">
        {/* Background Image Overlay */}
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
        <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-slate-950/80 via-slate-900/60 to-slate-950/80" />

        {/* Pulse Loader */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-extrabold animate-pulse">
            Loading Portal Session...
          </span>
        </div>
      </div>
    );
  }

  // Prevent flash content rendering while executing redirect
  if (!session && pathname !== "/") {
    return null;
  }

  return <>{children}</>;
}
