"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";

function ProductCard({ product, merchants, renderMerchantLogo, getMerchantStyles, formatDate }) {
  const imageUrls = [product.primary_image_url, ...(product.additional_image_urls || [])].filter(Boolean);
  const [activeIdx, setActiveIdx] = useState(0);

  const handleNext = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIdx((prev) => (prev + 1) % imageUrls.length);
  };

  const handlePrev = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIdx((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  return (
    <div className="group relative flex flex-col justify-between bg-slate-950/50 border border-white/10 rounded-3xl p-6 hover:border-indigo-500/40 hover:shadow-[0_20px_40px_-20px_rgba(99,102,241,0.3)] transition-all duration-300 ease-out">
      {/* Glowing Aura Effect */}
      <div className="absolute inset-0 rounded-3xl bg-indigo-500/[0.01] group-hover:bg-indigo-500/[0.02] pointer-events-none transition-colors" />

      {/* Top Section */}
      <div className="space-y-4">
        {/* Product Image Carousel */}
        <div className="w-full h-48 rounded-2xl bg-slate-900 border border-white/5 relative overflow-hidden flex items-center justify-center group/carousel">
          {imageUrls.length > 0 ? (
            <img
              src={imageUrls[activeIdx]}
              alt={`${product.name} - image ${activeIdx + 1}`}
              className="w-full h-full object-contain p-4 transition-all duration-300 ease-in-out"
              onError={(e) => { e.target.src = "/file.svg" }}
            />
          ) : (
            <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}

          {/* Category Badge */}
          <span className="absolute top-3 left-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-extrabold tracking-wide text-[9px] uppercase px-2 py-0.5 rounded">
            {product.category}
          </span>

          {/* Carousel Navigation Arrows */}
          {imageUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all opacity-0 group-hover/carousel:opacity-100 cursor-pointer shadow-md select-none"
                aria-label="Previous image"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all opacity-0 group-hover/carousel:opacity-100 cursor-pointer shadow-md select-none"
                aria-label="Next image"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Dot Indicators */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex space-x-1 bg-slate-950/45 px-2 py-1 rounded-full backdrop-blur-sm">
                {imageUrls.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveIdx(i);
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                      activeIdx === i ? "bg-indigo-400 w-3" : "bg-slate-650 hover:bg-slate-400"
                    }`}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h3 className="font-extrabold text-white text-base leading-snug group-hover:text-indigo-300 transition-colors">
            {product.name}
          </h3>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed line-clamp-3">
            {product.description || "Expert-recommended product for guinea pig nutrition and health support."}
          </p>
        </div>
      </div>

      {/* Bottom Section - Pricing & Affiliate Links */}
      <div className="pt-6 border-t border-white/5 mt-6 space-y-4">
        <div className="space-y-2.5">
          {product.product_offers && product.product_offers.length > 0 ? (
            product.product_offers.map((offer) => {
              const merchant = merchants.find(m => m.id === offer.merchant_id);
              if (!merchant) return null;

              return (
                <div key={offer.id} className="space-y-1">
                  <a
                    href={`/api/out?offerId=${offer.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-3 px-4 rounded-xl border flex items-center justify-between font-bold text-xs shadow-md transition-all active:scale-[0.99] ${getMerchantStyles(merchant.name)}`}
                  >
                    <div className="flex items-center space-x-2.5">
                      {renderMerchantLogo(merchant.name)}
                      <span>Check Price on {merchant.name}</span>
                    </div>
                    {offer.manual_price && (
                      <span className="font-black text-white bg-white/10 px-2 py-0.5 rounded">
                        ${offer.manual_price.toFixed(2)}
                      </span>
                    )}
                  </a>
                  <p className="text-[9px] text-slate-500 font-bold ml-1.5 leading-none">
                    * Price as of {formatDate(offer.last_updated)} - subject to change
                  </p>
                </div>
              );
            })
          ) : (
            <div className="text-center py-2 text-[11px] font-bold text-slate-500">
              Currently unavailable
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecommendedProducts() {
  const [products, setProducts] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = [
    "All",
    "Food & Treats",
    "Cages & Habitat",
    "Toys",
    "Health & Care",
    "Grooming",
    "Other"
  ];

  // Fetch active products and merchants
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch all merchants
        const { data: merchantsData, error: merchantsErr } = await supabase
          .from("merchants")
          .select("*");
        if (merchantsErr) throw merchantsErr;
        setMerchants(merchantsData || []);

        // Fetch active products with offers
        const { data: productsData, error: productsErr } = await supabase
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
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (productsErr) throw productsErr;
        setProducts(productsData || []);
        setFilteredProducts(productsData || []);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load recommended products. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter products by category
  useEffect(() => {
    if (selectedCategory === "All") {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(p => p.category === selectedCategory));
    }
  }, [selectedCategory, products]);

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
      return "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-400 hover:border-amber-500/50 shadow-amber-500/5";
    }
    if (nameLower.includes("chewy")) {
      return "bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/20 text-sky-400 hover:border-sky-500/50 shadow-sky-500/5";
    }
    return "bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 hover:border-indigo-500/50 shadow-indigo-500/5";
  };

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
            <Link href="/" className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
                GuineaPigDoctor
              </h1>
              <p className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-400 leading-none mt-0.5">Recommended Products</p>
            </div>
          </div>
          <Link
            href="/admin/recommended-products"
            className="py-2 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all duration-200"
          >
            Admin Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full relative z-10">
        
        {/* FTC Compliance Banner */}
        <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-md shadow-amber-950/20 backdrop-blur-xl flex items-start space-x-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs font-semibold text-amber-300/90 leading-relaxed">
            <span className="font-extrabold text-white">FTC Disclosure:</span> As an Amazon Associate and affiliate partner, GuineaPig Doctor earns from qualifying purchases. This helps support our free veterinary resource database.
          </p>
        </div>

        {/* Categories Bar */}
        <div className="flex overflow-x-auto space-x-2.5 pb-4 mb-8 border-b border-white/5 scrollbar-thin scrollbar-thumb-white/10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 border ${
                selectedCategory === cat
                  ? "bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-900/40 border-white/5 hover:border-white/10 text-slate-400 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center animate-spin">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-xs uppercase tracking-widest text-indigo-400 font-black animate-pulse">Loading Recommendations...</p>
          </div>
        ) : error ? (
          <div className="py-24 text-center">
            <div className="inline-flex w-12 h-12 bg-rose-500/10 rounded-full border border-rose-500/20 text-rose-400 items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="text-xs font-bold text-rose-455">{error}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-24 text-center text-slate-500 border border-white/5 bg-slate-950/20 rounded-3xl backdrop-blur-xl">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-650" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25m-2.25-2.25l-2.25 2.25m2.25-2.25l2.25-2.25M3.75 7.5L5.625 4.5h12.75L20.25 7.5M12 18.75v-3" /></svg>
            <p className="text-xs font-bold">No products found in this category.</p>
          </div>
        ) : (
          /* Products Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                merchants={merchants}
                renderMerchantLogo={renderMerchantLogo}
                getMerchantStyles={getMerchantStyles}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}

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
