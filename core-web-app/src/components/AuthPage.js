"use client";

import React, { useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function AuthPage({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ type: "error", text: "Please enter both email and password." });
      return;
    }
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      onClose(); // Close modal on success
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to log in." });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ type: "error", text: "Please enter both email and password." });
      return;
    }
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;

      if (data?.user && data.user.identities?.length === 0) {
        setMessage({ type: "error", text: "This email is already registered. Try logging in." });
      } else {
        setMessage({
          type: "success",
          text: "Registration successful! If verification is active, check your email for confirmation.",
        });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to sign up." });
    } finally {
      setLoading(false);
    }
  };

  const getRedirectUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get("redirect");
    if (redirectParam) {
      return `${window.location.origin}${redirectParam}`;
    }
    return window.location.origin;
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getRedirectUrl(),
        },
      });
      if (error) throw error;
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to trigger Google Authentication." });
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo: getRedirectUrl(),
        },
      });
      if (error) throw error;
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to trigger Facebook Authentication." });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop Backdrop blur overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-300"
      />

      {/* Glassmorphic Auth Panel */}
      <div className="w-full max-w-md bg-slate-950/75 border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 overflow-hidden transform scale-100 transition-all duration-350">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all duration-200 cursor-pointer"
          title="Close Modal"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 items-center justify-center shadow-lg shadow-indigo-500/25 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            GuineaPigDoctor
          </h2>
          <p className="text-slate-400 text-[10px] mt-1.5 uppercase tracking-widest font-semibold">
            {isSignUpMode ? "Create Platform Account" : "Access Platform"}
          </p>
        </div>

        {/* OAuth Social login */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/20 active:scale-[0.99] text-slate-100 font-bold text-xs transition-all flex items-center justify-center space-x-2.5 cursor-pointer shadow-sm"
          >
            {/* Google Icon SVG */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#ea4335"
                d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.85 5.85 0 0 1 8.1 12.7a5.85 5.85 0 0 1 5.89-5.83c2.4 0 4.256 1.48 4.968 3.515l3.96-1.54C21.43 4.88 17.59 2 13.99 2 8.35 2 4.1 6.25 4.1 12.7s4.25 10.7 9.89 10.7c6.12 0 10.15-4.22 10.15-10.29 0-.74-.08-1.285-.21-1.825H12.24z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            onClick={handleFacebookLogin}
            type="button"
            className="w-full py-3 px-4 rounded-xl bg-[#1877f2]/10 border border-[#1877f2]/20 hover:bg-[#1877f2]/20 hover:border-[#1877f2]/30 active:scale-[0.99] text-slate-100 font-bold text-xs transition-all flex items-center justify-center space-x-2.5 cursor-pointer shadow-sm"
          >
            {/* Facebook Icon SVG */}
            <svg className="w-4 h-4" fill="#1877f2" viewBox="0 0 24 24">
              <path d="M9.101 23.685v-9.504H6.183V10.72h2.918V8.196c0-2.89 1.767-4.468 4.35-4.468 1.236 0 2.298.092 2.607.133v3.024h-1.79c-1.402 0-1.674.666-1.674 1.644v2.15h3.35l-.436 3.46h-2.914v9.504H9.101z" />
            </svg>
            <span>Continue with Facebook</span>
          </button>
        </div>

        {/* Separator */}
        <div className="flex items-center space-x-2 my-5 text-slate-500">
          <hr className="flex-grow border-white/5" />
          <span className="text-[10px] uppercase tracking-wider font-extrabold select-none">Or use email</span>
          <hr className="flex-grow border-white/5" />
        </div>

        {/* Credentials Form */}
        <form onSubmit={isSignUpMode ? handleSignUp : handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold ml-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              className="w-full bg-slate-950/80 text-slate-100 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-indigo-500/60 font-semibold text-xs transition-all shadow-inner"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold ml-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950/80 text-slate-100 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-indigo-500/60 font-semibold text-xs transition-all shadow-inner"
            />
          </div>

          {/* Feedback alerts */}
          {message.text && (
            <div className={`p-4 rounded-2xl text-[11px] font-semibold text-center border ${
              message.type === "error" 
                ? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}>
              {message.text}
            </div>
          )}

          {/* Action Trigger */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 mt-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center cursor-pointer"
          >
            {loading ? "Authenticating..." : isSignUpMode ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center mt-6 text-xs text-slate-450 font-medium">
          {isSignUpMode ? (
            <p>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setIsSignUpMode(false);
                  setMessage({ type: "", text: "" });
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
              >
                Log In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{" "}
              <button
                onClick={() => {
                  setIsSignUpMode(true);
                  setMessage({ type: "", text: "" });
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
