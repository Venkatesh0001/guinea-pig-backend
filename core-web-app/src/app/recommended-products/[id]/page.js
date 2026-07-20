"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

export default function ProductDetailPage({ params }) {
  const { id } = use(params);
  const [product, setProduct] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  useEffect(() => {
    async function fetchProductDetails() {
      try {
        setLoading(true);
        // Fetch all merchants
        const { data: merchantsData, error: merchantsErr } = await supabase
          .from("merchants")
          .select("*");
        if (merchantsErr) throw merchantsErr;
        setMerchants(merchantsData || []);

        // Fetch single product details with offers
        const { data: productData, error: productErr } = await supabase
          .from("recommended_products")
          .select(`
            *,
            product_offers (
              id,
              merchant_id,
              manual_price,
              last_updated
            )
          `)
          .eq("id", id)
          .single();

        if (productErr) throw productErr;
        setProduct(productData);
      } catch (err) {
        console.error("Error fetching product details:", err);
        setError("Failed to load product details. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchProductDetails();
    }
  }, [id]);

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  // Inline SVG logos for popular merchants
  const renderMerchantLogo = (name) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("amazon")) {
      return (
        <svg className="w-4 h-4 fill-amber-500 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.29 14.29c-.39.39-1.02.39-1.41 0L12 14.41l-1.88 1.88c-.39.39-1.02.39-1.41 0a.996.996 0 010-1.41L10.59 13l-1.88-1.88c-.39-.39-.39-1.02 0-1.41.39-.39 1.02-.39 1.41 0L12 11.59l1.88-1.88c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L13.41 13l1.88 1.88c.38.39.38 1.03 0 1.41z"/>
        </svg>
      );
    }
    if (nameLower.includes("chewy")) {
      return (
        <svg className="w-4 h-4 fill-sky-400 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm1 14.5a1.5 1.5 0 111.5-1.5 1.5 1.5 0 01-1.5 1.5zm1.5-5.5a1.5 1.5 0 00-3 0v1a1 1 0 01-2 0v-1a3.5 3.5 0 017 0z"/>
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    );
  };

  const getMerchantStyles = (name) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("amazon")) {
      return "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-400 hover:border-amber-500/50 shadow-amber-500/5 hover:text-amber-300";
    }
    if (nameLower.includes("chewy")) {
      return "bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/20 text-sky-400 hover:border-sky-500/50 shadow-sky-500/5 hover:text-sky-300";
    }
    return "bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 hover:border-indigo-500/50 shadow-indigo-500/5 hover:text-indigo-300";
  };

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex flex-col justify-center items-center bg-slate-950 text-slate-100 font-sans select-none">
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
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center animate-spin">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-xs uppercase tracking-widest text-indigo-400 font-black animate-pulse">Loading Product Details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen relative overflow-hidden flex flex-col justify-center items-center bg-slate-950 text-slate-100 font-sans p-4">
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
        <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-slate-950/90 via-slate-900/80 to-slate-950/90" />
        <div className="w-full max-w-md bg-slate-950/80 border border-red-500/20 rounded-3xl p-8 text-center backdrop-blur-xl">
          <div className="inline-flex w-12 h-12 bg-rose-500/10 rounded-full border border-rose-500/20 text-rose-455 items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">Product Not Found</h2>
          <p className="text-slate-400 text-sm mb-6">{error || "The requested recommended product could not be located."}</p>
          <Link href="/recommended-products" className="py-3 px-4 rounded-xl bg-slate-900 border border-white/10 hover:bg-slate-800 text-white font-bold text-xs transition-all flex items-center justify-center cursor-pointer">
            Back to Recommendations
          </Link>
        </div>
      </div>
    );
  }

  // Aggregate all images (Primary + Additional)
  const imageUrls = [product.primary_image_url, ...(product.additional_image_urls || [])].filter(Boolean);

  return (
    <div className="min-h-screen relative font-sans text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col justify-between">
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
      <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-slate-950/80 via-slate-900/60 to-slate-950/80" />

      {/* Header Banner */}
      <header className="sticky top-0 z-50 bg-slate-950/40 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/recommended-products" className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
                GuineaPigDoctor
              </h1>
              <p className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-400 leading-none mt-0.5">Product Details</p>
            </div>
          </div>
          <Link
            href="/recommended-products"
            className="py-2 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-350 text-xs font-bold transition-all"
          >
            All Products
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full relative z-10">
        
        {/* Breadcrumb breadcrumbs navigation */}
        <div className="mb-6 flex items-center space-x-2 text-slate-450 text-[10px] uppercase tracking-wider font-extrabold select-none">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/recommended-products" className="hover:text-white transition-colors">Recommended Products</Link>
          <span>/</span>
          <span className="text-indigo-400">{product.category}</span>
        </div>

        {/* PDP Layout Container (Flipkart Split Design) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-slate-950/60 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-2xl shadow-2xl">
          
          {/* Left Column - Product Image Gallery (col-span-5) */}
          <div className="lg:col-span-5 flex flex-col md:flex-row gap-4">
            
            {/* Vertical thumbnails sidebar */}
            {imageUrls.length > 1 && (
              <div className="flex md:flex-col flex-row gap-2 order-2 md:order-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                {imageUrls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveImageIdx(index)}
                    onMouseEnter={() => setActiveImageIdx(index)}
                    className={`w-14 h-14 md:w-16 md:h-16 rounded-xl bg-slate-900 border overflow-hidden flex items-center justify-center p-1.5 transition-all shrink-0 cursor-pointer ${
                      activeImageIdx === index
                        ? "border-indigo-500 shadow-md shadow-indigo-500/20 scale-[1.03]"
                        : "border-white/5 hover:border-white/20 hover:scale-[1.01]"
                    }`}
                  >
                    <img 
                      src={url} 
                      alt={`thumbnail ${index + 1}`} 
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.src = "/file.svg" }}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Large active viewport */}
            <div className="flex-grow h-[320px] md:h-[400px] rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center p-6 relative order-1 md:order-2 group overflow-hidden">
              {imageUrls.length > 0 ? (
                <img
                  src={imageUrls[activeImageIdx]}
                  alt={product.name}
                  className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                  onError={(e) => { e.target.src = "/file.svg" }}
                />
              ) : (
                <svg className="w-16 h-16 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              <span className="absolute top-3 right-3 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 font-extrabold tracking-wide text-[9px] uppercase px-2 py-0.5 rounded shadow-sm">
                {product.category}
              </span>
            </div>

          </div>

          {/* Right Column - Product Info & Pricing Comparison (col-span-7) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            
            {/* Title, Category & Ratings */}
            <div className="space-y-4">
              <div>
                <span className="inline-block text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-extrabold tracking-wide uppercase px-2.5 py-0.5 rounded-md mb-2">
                  {product.category}
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
                  {product.name}
                </h2>
              </div>

              {/* Badges/Star ratings */}
              <div className="flex flex-wrap items-center gap-3 select-none">
                <div className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-wide uppercase px-2.5 py-1 rounded-xl shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Veterinarian Recommended</span>
                </div>
                <div className="flex items-center text-amber-400 space-x-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-slate-400 text-xs font-bold pl-1.5">5.0 / 5</span>
                </div>
              </div>

              {/* Product Detailed Description */}
              <div className="pt-4 border-t border-white/5 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Product Overview</h4>
                <p className="text-slate-300 text-sm font-semibold leading-relaxed">
                  {product.description || "No description provided for this item. Please consult with a veterinarian regarding specific health concerns."}
                </p>
              </div>
            </div>

            {/* Merchant Offers & Price Comparison List */}
            <div className="pt-6 border-t border-white/5 space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Compare Seller Offers</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Multi-vendor pricing matching. Select your preferred seller below:</p>
              </div>

              <div className="space-y-3">
                {product.product_offers && product.product_offers.length > 0 ? (
                  product.product_offers.map((offer) => {
                    const merchant = merchants.find(m => m.id === offer.merchant_id);
                    if (!merchant) return null;

                    return (
                      <div 
                        key={offer.id} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/45 border border-white/5 hover:border-white/10 transition-colors shadow-inner"
                      >
                        {/* Merchant Details */}
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center p-2 shrink-0">
                            {renderMerchantLogo(merchant.name)}
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-white">{merchant.name}</p>
                            <p className="text-[9px] text-slate-500 font-bold leading-none mt-1">
                              Last updated: {formatDate(offer.last_updated)}
                            </p>
                          </div>
                        </div>

                        {/* Price & Action Button */}
                        <div className="flex items-center justify-between sm:justify-end gap-6">
                          <div className="text-left sm:text-right">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block leading-none">Price</span>
                            <span className="text-lg font-black text-white block mt-1 leading-none">
                              {offer.manual_price ? `$${offer.manual_price.toFixed(2)}` : "Unavailable"}
                            </span>
                          </div>
                          <a
                            href={`/api/out?offerId=${offer.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`py-3 px-5 rounded-xl border flex items-center justify-center space-x-2 font-black text-xs transition-all active:scale-[0.99] shrink-0 select-none shadow-md ${getMerchantStyles(merchant.name)}`}
                          >
                            <span>Buy on {merchant.name}</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-xs font-bold text-slate-550 border border-dashed border-white/10 rounded-2xl">
                    This product is currently out of stock or does not have any vendor pricing links listed.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Affiliate Disclosure disclaimer */}
        <p className="mt-8 text-[10px] text-slate-500 font-semibold leading-relaxed text-center max-w-2xl mx-auto">
          * GuineaPig Doctor participates in affiliate networks like Amazon Associates and Chewy Partner Programs. We may earn a small referral commission at no additional cost to you when you purchase products through these links. This funding supports our vet advisory platform.
        </p>

      </main>

      {/* Footer */}
      <footer className="bg-slate-950/40 backdrop-blur-md border-t border-white/5 py-6 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} GuineaPigDoctor. Expert veterinary care advice & product reviews.
        </div>
      </footer>
    </div>
  );
}
