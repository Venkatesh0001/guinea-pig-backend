"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

export default function Home() {
  // Model state variables
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  
  // Coordinate and scale state variables
  const [xPct, setXPct] = useState(0.5);
  const [yPct, setYPct] = useState(0.5);
  const [boxScale, setBoxScale] = useState(0.4); // Fixed to 0.40 but adjustable via state
  const [zoomScale, setZoomScale] = useState(1.0); // Viewport Zoom Level

  // ROI dragging states and refs
  const [isDraggingRoi, setIsDraggingRoi] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, xPct: 0.5, yPct: 0.5, imgWidth: 0, imgHeight: 0 });
  const lastTouchDistRef = useRef(0); // Ref to track touch distance for pinch-to-zoom

  // API response variables
  const [prediction, setPrediction] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [camImage, setCamImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null); // Ref to active image container
  const abortControllerRef = useRef(null);

  // Fail-safe to capture natural size if image is cached or loads immediately
  useEffect(() => {
    if (previewUrl && imgRef.current && imgRef.current.complete) {
      setNaturalSize({
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      });
    }
  }, [previewUrl]);

  // Method to invoke inference through Next.js API bridge
  const runInference = useCallback(async (file, x, y, scale) => {
    if (!file) return;

    // Abort any outstanding request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("x_pct", x.toString());
    formData.append("y_pct", y.toString());
    formData.append("box_scale", scale.toString());

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Server error running classification.");
      }

      setPrediction(data.prediction);
      setConfidence(data.confidence);
      setCamImage(data.cam_image);
    } catch (err) {
      if (err.name === "AbortError") {
        return; // Suppress abort error since a newer request replaced it
      }
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  // Hook to trigger inference on any coordinate, scale or file changes
  useEffect(() => {
    // Only trigger auto-inference if we are not actively dragging the ROI
    if (selectedFile && !isDraggingRoi) {
      const timer = setTimeout(() => {
        runInference(selectedFile, xPct, yPct, boxScale);
      }, 150); // Small debounce to avoid clogging
      return () => clearTimeout(timer);
    }
  }, [selectedFile, xPct, yPct, boxScale, isDraggingRoi, runInference]);

  // Unified Mouse & Touch Down Handler to start dragging or center bounding box
  const handleStartDragOrCenter = (clientX, clientY) => {
    if (!imgRef.current || !selectedFile) return;

    const rect = imgRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const clickXPct = clickX / rect.width;
    const clickYPct = clickY / rect.height;

    // Calculate Bounding Box size in percentages
    let wPct = boxScale;
    let hPct = boxScale;
    if (naturalSize.w && naturalSize.h) {
      const minDim = Math.min(naturalSize.w, naturalSize.h);
      const boxSide = boxScale * minDim;
      wPct = boxSide / naturalSize.w;
      hPct = boxSide / naturalSize.h;
    }
    const halfW = wPct / 2;
    const halfH = hPct / 2;

    // Determine if user clicked inside the current ROI box
    const isInsideRoi =
      clickXPct >= (xPct - halfW) &&
      clickXPct <= (xPct + halfW) &&
      clickYPct >= (yPct - halfH) &&
      clickYPct <= (yPct + halfH);

    let startXPct = xPct;
    let startYPct = yPct;

    if (!isInsideRoi) {
      // Center the ROI perfectly over the clicked point (with boundary constraints)
      startXPct = Math.max(halfW, Math.min(1.0 - halfW, clickXPct));
      startYPct = Math.max(halfH, Math.min(1.0 - halfH, clickYPct));
      setXPct(startXPct);
      setYPct(startYPct);
    }

    setIsDraggingRoi(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      xPct: startXPct,
      yPct: startYPct,
      imgWidth: rect.width,
      imgHeight: rect.height,
    };
  };

  // Window-level Mouse Dragging listeners
  useEffect(() => {
    if (!isDraggingRoi) return;

    const handleMouseMove = (e) => {
      const start = dragStartRef.current;
      if (!start.imgWidth) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      const dxPct = dx / start.imgWidth;
      const dyPct = dy / start.imgHeight;

      let newXPct = start.xPct + dxPct;
      let newYPct = start.yPct + dyPct;

      // Calculate Bounding Box boundaries
      let wPct = boxScale;
      let hPct = boxScale;
      if (naturalSize.w && naturalSize.h) {
        const minDim = Math.min(naturalSize.w, naturalSize.h);
        const boxSide = boxScale * minDim;
        wPct = boxSide / naturalSize.w;
        hPct = boxSide / naturalSize.h;
      }
      const halfW = wPct / 2;
      const halfH = hPct / 2;

      // Constrain within base image coordinates [0, 1]
      newXPct = Math.max(halfW, Math.min(1.0 - halfW, newXPct));
      newYPct = Math.max(halfH, Math.min(1.0 - halfH, newYPct));

      setXPct(newXPct);
      setYPct(newYPct);
    };

    const handleMouseUp = () => {
      setIsDraggingRoi(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingRoi, boxScale, naturalSize]);

  // Window-level Touch Panning/Dragging/Pinching listeners
  useEffect(() => {
    if (!isDraggingRoi) return;

    const handleTouchMove = (e) => {
      if (e.touches.length === 1) {
        // Single finger: Drag-to-move
        const touch = e.touches[0];
        const start = dragStartRef.current;
        if (!start.imgWidth) return;

        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;

        const dxPct = dx / start.imgWidth;
        const dyPct = dy / start.imgHeight;

        let newXPct = start.xPct + dxPct;
        let newYPct = start.yPct + dyPct;

        let wPct = boxScale;
        let hPct = boxScale;
        if (naturalSize.w && naturalSize.h) {
          const minDim = Math.min(naturalSize.w, naturalSize.h);
          const boxSide = boxScale * minDim;
          wPct = boxSide / naturalSize.w;
          hPct = boxSide / naturalSize.h;
        }
        const halfW = wPct / 2;
        const halfH = hPct / 2;

        newXPct = Math.max(halfW, Math.min(1.0 - halfW, newXPct));
        newYPct = Math.max(halfH, Math.min(1.0 - halfH, newYPct));

        setXPct(newXPct);
        setYPct(newYPct);
        lastTouchDistRef.current = 0; // Reset pinch tracking
      } else if (e.touches.length === 2) {
        // Two fingers: Pinch-to-zoom bounding box
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        if (lastTouchDistRef.current > 0) {
          const diff = dist - lastTouchDistRef.current;
          // Scale factor: 0.003 is smooth and responsive
          const change = diff * 0.003;
          
          setBoxScale((prev) => {
            const next = Math.max(0.10, Math.min(1.0, prev + change));
            return parseFloat(next.toFixed(4));
          });
        }
        lastTouchDistRef.current = dist;
      }
    };

    const handleTouchEnd = () => {
      setIsDraggingRoi(false);
      lastTouchDistRef.current = 0;
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDraggingRoi, boxScale, naturalSize]);

  // Container-level Touch & Wheel Listener Setup (Optimized for Passive Scrolling and drag-prevention override)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e) => {
      if (!selectedFile) return;

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleStartDragOrCenter(touch.clientX, touch.clientY);
        lastTouchDistRef.current = 0;
      } else if (e.touches.length === 2) {
        setIsDraggingRoi(true);
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastTouchDistRef.current = dist;
      }
    };

    const onTouchMove = (e) => {
      // If we are actively dragging or pinching the ROI, prevent default scrolling/zooming
      if (isDraggingRoi && e.cancelable) {
        e.preventDefault();
      }
    };

    const handleWheel = (e) => {
      if (!selectedFile) return;
      e.preventDefault();
      const step = 0.02;
      const change = e.deltaY < 0 ? step : -step;
      setBoxScale((prev) => {
        const next = Math.max(0.10, Math.min(1.0, prev + change));
        return parseFloat(next.toFixed(4));
      });
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("wheel", handleWheel);
    };
  }, [selectedFile, isDraggingRoi, xPct, yPct, boxScale, naturalSize]);

  // Constrain coordinates when boxScale changes to prevent the box from expanding outside the image
  useEffect(() => {
    if (naturalSize.w && naturalSize.h) {
      let wPct = boxScale;
      let hPct = boxScale;
      const minDim = Math.min(naturalSize.w, naturalSize.h);
      const boxSide = boxScale * minDim;
      wPct = boxSide / naturalSize.w;
      hPct = boxSide / naturalSize.h;

      const halfW = wPct / 2;
      const halfH = hPct / 2;

      setXPct((prev) => Math.max(halfW, Math.min(1.0 - halfW, prev)));
      setYPct((prev) => Math.max(halfH, Math.min(1.0 - halfH, prev)));
    }
  }, [boxScale, naturalSize]);

  const processFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    setPrediction("");
    setConfidence(0);
    setCamImage("");
    setError("");
  };

  const handleFileChange = (e) => {
    processFile(e.target?.files?.[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFile(e.dataTransfer?.files?.[0]);
  };

  const handleReset = (e) => {
    if (e) e.preventDefault();
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl("");
    setNaturalSize({ w: 0, h: 0 });
    setPrediction("");
    setConfidence(0);
    setCamImage("");
    setError("");
    setXPct(0.5);
    setYPct(0.5);
    setBoxScale(0.4);
    setZoomScale(1.0); // Reset visual zoom scale
    setIsDraggingRoi(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Calculate bounding box overlay style (percentage based)
  let boxStyle = {};
  if (naturalSize.w && naturalSize.h) {
    const minDim = Math.min(naturalSize.w, naturalSize.h);
    const boxSide = boxScale * minDim;
    const wPct = boxSide / naturalSize.w;
    const hPct = boxSide / naturalSize.h;

    boxStyle = {
      width: `${wPct * 100}%`,
      height: `${hPct * 100}%`,
      left: `${(xPct - wPct / 2) * 100}%`,
      top: `${(yPct - hPct / 2) * 100}%`,
    };
  } else {
    boxStyle = {
      width: `${boxScale * 100}%`,
      height: `${boxScale * 100}%`,
      left: `${(xPct - boxScale / 2) * 100}%`,
      top: `${(yPct - boxScale / 2) * 100}%`,
    };
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header Banner */}
      <header className="border-b border-slate-900 bg-slate-955/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col">
          <Link href="/" className="inline-flex items-center text-indigo-400 hover:text-indigo-300 text-sm font-medium mb-4 transition-colors w-fit">
            ← Back to Home
          </Link>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3 text-center md:text-left">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-violet-400">
                  FGVC Computer Vision Portal
                </h1>
                <p className="text-xs text-slate-400 font-medium tracking-wide">
                  Gender Analytics & Explainable Grad-CAM Dashboard
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 mr-2 rounded-full bg-emerald-400 animate-pulse"></span>
                PyTorch Engine Online
              </span>
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
        </div>
      </header>

      {/* Main Grid Matrix */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Panel Form Layer (5 Cols on Big Screens) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Upload & Controls */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
              <h2 className="text-lg font-bold mb-4 text-indigo-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Model Controls & Inputs
              </h2>

              <div className="space-y-6">
                
                {/* File Dropzone */}
                  {previewUrl ? (
                    <div className="relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center min-h-[160px] transition-all duration-300 border-slate-800 bg-slate-955/20 cursor-default">
                      <div className="text-center relative">
                        <p className="text-sm text-indigo-400 font-semibold mb-1">Active Image Loaded</p>
                        <p className="text-xs text-slate-500 truncate max-w-[220px]">{selectedFile?.name}</p>
                        <button
                          type="button"
                          onClick={handleReset}
                          className="mt-3 text-xs bg-slate-950 hover:bg-rose-900/30 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Reset Application
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="file-upload"
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center min-h-[160px] transition-all duration-300 ${
                        isDragging 
                          ? "border-indigo-400 bg-indigo-500/20 cursor-copy" 
                          : "border-indigo-500/20 hover:border-indigo-500/50 bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer"
                      }`}
                    >
                      <input
                        type="file"
                        id="file-upload"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <div className="text-center space-y-3 pointer-events-none">
                        <div className="mx-auto w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-indigo-400">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                        </div>
                        <p className="text-sm text-slate-300">
                          <span className="text-indigo-400 font-bold hover:underline">Choose image</span> or drag here
                        </p>
                        <p className="text-[10px] text-slate-500">Supports PNG, JPG, or WEBP</p>
                      </div>
                    </label>
                  )}

                {/* Coordinate Feedback Panel */}
                <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-3">
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 font-bold">ROI Coordinate Feed</h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2">
                      <p className="text-[10px] text-slate-400 font-semibold">Center X</p>
                      <p className="text-base font-mono font-extrabold text-indigo-400 mt-1">{xPct.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2">
                      <p className="text-[10px] text-slate-400 font-semibold">Center Y</p>
                      <p className="text-base font-mono font-extrabold text-indigo-400 mt-1">{yPct.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2">
                      <p className="text-[10px] text-slate-400 font-semibold">ROI Size</p>
                      <p className="text-base font-mono font-extrabold text-indigo-400 mt-1">{(boxScale * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 text-center font-medium leading-normal">
                    Click/tap on the image preview or drag the box directly to select custom coordinates.
                  </p>
                </div>

              </div>
            </div>

            {/* Error alerts */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/25 p-4 rounded-xl flex items-start gap-3 text-rose-400 text-sm">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-grow font-medium">
                  <p className="font-bold">Execution Error</p>
                  <p className="text-xs text-rose-300 mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel Rendering Layer (7 Cols on Big Screens) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Visual Workspace grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box 1: Bounding Box Overlay Preview */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col min-h-[300px] shadow-lg">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  Cropping Box Coordinates
                </h3>

                <div 
                  ref={containerRef}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return; // Only process left click
                    handleStartDragOrCenter(e.clientX, e.clientY);
                  }}
                  className="flex-grow bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 relative min-h-[220px] select-none cursor-crosshair"
                >
                  {previewUrl ? (
                    <div className="relative overflow-hidden w-full h-full flex items-center justify-center select-none">
                      {/* Zoom Wrapper */}
                      <div
                        style={{
                          transform: `scale(${zoomScale})`,
                          transformOrigin: "center center",
                        }}
                        className="transition-transform duration-150 ease-out relative inline-block max-h-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          ref={imgRef}
                          src={previewUrl}
                          alt="Workspace source preview"
                          className="max-h-[260px] object-contain rounded-lg pointer-events-none select-none"
                          onLoad={(e) => {
                            setNaturalSize({
                              w: e.target.naturalWidth,
                              h: e.target.naturalHeight,
                            });
                          }}
                        />
                        
                        {/* Bounding box layer */}
                        <div
                          style={boxStyle}
                          className="absolute border-2 border-indigo-400 bg-indigo-400/10 shadow-2xl transition-all duration-75 ease-out cursor-move"
                        >
                          {/* Target reticle crosshair */}
                          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-indigo-400/50"></div>
                          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-indigo-400/50"></div>
                          <span className="absolute -top-6 -left-1 bg-indigo-500 text-white text-[9px] px-1 rounded font-bold font-mono select-none">
                            ROI
                          </span>
                        </div>
                      </div>

                      {/* Translucent floating zoom control bar */}
                      <div className="absolute bottom-3 right-3 flex items-center space-x-2 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-lg p-1 z-30 shadow-lg">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomScale((prev) => Math.min(3.0, prev + 0.25));
                          }}
                          className="w-7 h-7 rounded bg-slate-955 hover:bg-indigo-600 border border-slate-800 text-slate-350 hover:text-white flex items-center justify-center text-xs transition-all focus:outline-none cursor-pointer"
                          title="Zoom In"
                        >
                          ＋
                        </button>
                        <span className="text-[10px] font-mono px-1.5 text-indigo-400 min-w-[2.5rem] text-center select-none font-bold">
                          {(zoomScale * 100).toFixed(0)}%
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomScale((prev) => Math.max(1.0, prev - 0.25));
                          }}
                          className="w-7 h-7 rounded bg-slate-955 hover:bg-indigo-600 border border-slate-800 text-slate-350 hover:text-white flex items-center justify-center text-xs transition-all focus:outline-none cursor-pointer"
                          title="Zoom Out"
                        >
                          －
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomScale(1.0);
                          }}
                          className="w-7 h-7 rounded bg-slate-955 hover:bg-indigo-600 border border-slate-800 text-[10px] text-slate-350 hover:text-white flex items-center justify-center transition-all focus:outline-none cursor-pointer"
                          title="Reset Zoom"
                        >
                          ↺
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div className="text-slate-600 text-xs text-center space-y-2 pointer-events-none">
                      <svg className="w-8 h-8 mx-auto text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012-2.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p>Waiting for source photo upload...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: High Fidelity Grad-CAM heatmap */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col min-h-[300px] shadow-lg relative">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                  Explainable Grad-CAM Heatmap
                </h3>

                <div className="flex-grow bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 relative min-h-[220px]">
                  {loading && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center space-y-2">
                      <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-[10px] text-slate-400">Computing activation map...</p>
                    </div>
                  )}

                  {camImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={camImage}
                      alt="Grad-CAM visual attribution map"
                      className="max-h-[260px] object-contain rounded-lg shadow-xl"
                    />
                  ) : (
                    <div className="text-slate-600 text-xs text-center space-y-2">
                      <svg className="w-8 h-8 mx-auto text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <p>Awaiting Grad-CAM backpropagation...</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Inference banner result */}
            {loading && !prediction && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse text-center">
                <p className="text-sm text-indigo-400 font-semibold">Running Deep Learning Inference...</p>
              </div>
            )}

            {prediction && (
              <div className={`p-6 rounded-2xl shadow-2xl relative overflow-hidden border transition-all duration-300 relative ${
                prediction.toLowerCase() === "female"
                  ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/30"
                  : "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/30"
              }`}>
                {loading && (
                  <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center text-xs text-indigo-300 font-medium">
                    Updating prediction...
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg ${
                      prediction.toLowerCase() === "female"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}>
                      {prediction[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Predicted Gender</p>
                      <p className={`text-2xl font-bold tracking-wide mt-0.5 ${
                        prediction.toLowerCase() === "female" ? "text-emerald-400" : "text-blue-400"
                      }`}>
                        {prediction.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Confidence Rating</p>
                    <p className="text-2xl font-extrabold text-slate-200 mt-0.5 font-mono">
                      {(confidence * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </main>

      {/* Footer banner */}
      <footer className="border-t border-slate-900/60 py-6 text-center text-slate-650 text-xs">
        <p>© 2026 FGVC Visual Classification System • Built using Next.js & PyTorch Grad-CAM</p>
      </footer>
    </div>
  );
}
