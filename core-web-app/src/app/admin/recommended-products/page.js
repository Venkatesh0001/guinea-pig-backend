"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export default function AdminRecommendedProducts() {
  const { session, loading: authLoading } = useAuth();
  const [products, setProducts] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Form states
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [primaryImageUrl, setPrimaryImageUrl] = useState("");
  const [category, setCategory] = useState("Food & Treats");
  const [isActive, setIsActive] = useState(true);
  const [offers, setOffers] = useState([{ merchantId: "", manualPrice: "", affiliateUrl: "" }]);

  // Quick edit states for price
  const [quickPriceEdit, setQuickPriceEdit] = useState({}); // { offerId: price }

  const categories = [
    "Food & Treats",
    "Cages & Habitat",
    "Toys",
    "Health & Care",
    "Grooming",
    "Other"
  ];

  // Fetch products and merchants
  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch merchants
      let { data: merchantData, error: merchantErr } = await supabase
        .from("merchants")
        .select("*")
        .order("name", { ascending: true });

      if (merchantErr) throw merchantErr;

      // Ensure required default merchants exist
      const requiredMerchants = [
        { name: "Amazon", logo_url: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" },
        { name: "Chewy", logo_url: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Chewy_logo.svg" },
        { name: "Others", logo_url: "" }
      ];

      const existingNames = merchantData ? merchantData.map(m => m.name) : [];
      const missingMerchants = requiredMerchants.filter(rm => !existingNames.includes(rm.name));

      if (missingMerchants.length > 0) {
        const { error: seedErr } = await supabase.from("merchants").insert(missingMerchants);
        if (seedErr) {
          throw new Error(`Failed to seed missing merchants: ${seedErr.message}`);
        }
        
        // Re-fetch merchants after seeding
        const { data: updatedMerchants, error: refetchErr } = await supabase
          .from("merchants")
          .select("*")
          .order("name", { ascending: true });
        if (refetchErr) throw refetchErr;
        if (updatedMerchants) {
          merchantData = updatedMerchants;
        }
      }

      setMerchants(merchantData || []);

      // Fetch products with their offers
      const { data: productData, error: productErr } = await supabase
        .from("recommended_products")
        .select(`
          *,
          product_offers (
            id,
            merchant_id,
            manual_price,
            affiliate_url,
            last_updated
          )
        `)
        .order("created_at", { ascending: false });

      if (productErr) throw productErr;
      setProducts(productData || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setMessage({ type: "error", text: err.message || "Failed to fetch data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  // Handle adding an offer row
  const addOfferRow = () => {
    setOffers([...offers, { merchantId: "", manualPrice: "", affiliateUrl: "" }]);
  };

  // Handle removing an offer row
  const removeOfferRow = (index) => {
    if (offers.length === 1) return;
    setOffers(offers.filter((_, i) => i !== index));
  };

  // Handle offer input change
  const handleOfferChange = (index, field, value) => {
    const updatedOffers = [...offers];
    updatedOffers[index][field] = value;
    setOffers(updatedOffers);
  };

  // Form submission (Create / Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setMessage({ type: "error", text: "Product name is required." });
      return;
    }

    // Validate offers
    const validOffers = offers.filter(o => o.merchantId && o.affiliateUrl.trim());
    if (validOffers.length === 0) {
      setMessage({ type: "error", text: "At least one product offer (Merchant and Affiliate URL) is required." });
      return;
    }

    setActionLoading(true);
    setMessage({ type: "", text: "" });

    try {
      if (editingId) {
        // Update product
        const { error: prodErr } = await supabase
          .from("recommended_products")
          .update({
            name,
            description,
            primary_image_url: primaryImageUrl,
            category,
            is_active: isActive
          })
          .eq("id", editingId);

        if (prodErr) throw prodErr;

        // Delete existing offers
        const { error: delErr } = await supabase
          .from("product_offers")
          .delete()
          .eq("product_id", editingId);

        if (delErr) throw delErr;

        // Insert new offers
        const { error: insErr } = await supabase
          .from("product_offers")
          .insert(
            validOffers.map(o => ({
              product_id: editingId,
              merchant_id: o.merchantId,
              manual_price: o.manualPrice ? parseFloat(o.manualPrice) : null,
              affiliate_url: o.affiliateUrl
            }))
          );

        if (insErr) throw insErr;
        setMessage({ type: "success", text: "Product updated successfully!" });
      } else {
        // Create product
        const { data: newProd, error: prodErr } = await supabase
          .from("recommended_products")
          .insert({
            name,
            description,
            primary_image_url: primaryImageUrl,
            category,
            is_active: isActive
          })
          .select()
          .single();

        if (prodErr) throw prodErr;

        // Insert offers
        const { error: insErr } = await supabase
          .from("product_offers")
          .insert(
            validOffers.map(o => ({
              product_id: newProd.id,
              merchant_id: o.merchantId,
              manual_price: o.manualPrice ? parseFloat(o.manualPrice) : null,
              affiliate_url: o.affiliateUrl
            }))
          );

        if (insErr) throw insErr;
        setMessage({ type: "success", text: "Product created successfully!" });
      }

      // Reset Form
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Error saving product:", err);
      setMessage({ type: "error", text: err.message || "Failed to save product." });
    } finally {
      setActionLoading(false);
    }
  };

  // Set up form for editing
  const handleEdit = (product) => {
    setEditingId(product.id);
    setName(product.name);
    setDescription(product.description || "");
    setPrimaryImageUrl(product.primary_image_url || "");
    setCategory(product.category || "Food & Treats");
    setIsActive(product.is_active);

    if (product.product_offers && product.product_offers.length > 0) {
      setOffers(product.product_offers.map(o => ({
        merchantId: o.merchant_id,
        manualPrice: o.manual_price ? o.manual_price.toString() : "",
        affiliateUrl: o.affiliate_url
      })));
    } else {
      setOffers([{ merchantId: "", manualPrice: "", affiliateUrl: "" }]);
    }
    // Scroll form into view
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Reset form states
  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrimaryImageUrl("");
    setCategory("Food & Treats");
    setIsActive(true);
    setOffers([{ merchantId: "", manualPrice: "", affiliateUrl: "" }]);
  };

  // Delete product
  const handleDelete = async (productId) => {
    if (!confirm("Are you sure you want to delete this product? All corresponding offers will be deleted automatically.")) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("recommended_products")
        .delete()
        .eq("id", productId);

      if (error) throw error;
      setMessage({ type: "success", text: "Product deleted successfully!" });
      fetchData();
    } catch (err) {
      console.error("Error deleting product:", err);
      setMessage({ type: "error", text: err.message || "Failed to delete product." });
    } finally {
      setActionLoading(false);
    }
  };

  // Quick edit price change handler
  const handleQuickPriceChange = (offerId, val) => {
    setQuickPriceEdit({
      ...quickPriceEdit,
      [offerId]: val
    });
  };

  // Quick edit price save
  const handleSaveQuickPrice = async (offerId) => {
    const priceVal = quickPriceEdit[offerId];
    if (priceVal === undefined) return;

    setActionLoading(true);
    try {
      const priceParsed = priceVal.trim() === "" ? null : parseFloat(priceVal);
      if (priceParsed !== null && isNaN(priceParsed)) {
        throw new Error("Invalid price value");
      }

      const { error } = await supabase
        .from("product_offers")
        .update({ manual_price: priceParsed })
        .eq("id", offerId);

      if (error) throw error;
      
      // Update local state directly instead of full reload for snappy feel
      setProducts(prevProducts => 
        prevProducts.map(p => ({
          ...p,
          product_offers: p.product_offers.map(o => 
            o.id === offerId ? { ...o, manual_price: priceParsed, last_updated: new Date().toISOString() } : o
          )
        }))
      );
      
      // Remove quick edit input state
      const updatedQuickPriceEdit = { ...quickPriceEdit };
      delete updatedQuickPriceEdit[offerId];
      setQuickPriceEdit(updatedQuickPriceEdit);

      setMessage({ type: "success", text: "Price updated successfully!" });
    } catch (err) {
      console.error("Error saving quick price:", err);
      setMessage({ type: "error", text: err.message || "Failed to update price." });
    } finally {
      setActionLoading(false);
    }
  };

  // Check if current user has 'admin' metadata role
  const isAdmin = session?.user?.app_metadata?.role === "admin";

  if (authLoading || (session && loading && products.length === 0)) {
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
            Loading Admin Portal...
          </span>
        </div>
      </div>
    );
  }

  // Not Admin view
  if (session && !isAdmin) {
    return (
      <div className="min-h-screen relative overflow-hidden flex flex-col justify-center items-center bg-slate-950 text-slate-100 font-sans p-4">
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
        <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-slate-950/90 via-slate-900/80 to-slate-950/90" />

        <div className="w-full max-w-md bg-slate-950/80 border border-red-500/20 rounded-3xl p-8 shadow-2xl text-center backdrop-blur-xl">
          <div className="inline-flex w-14 h-14 rounded-full bg-red-500/10 items-center justify-center mb-4 text-red-500 border border-red-500/20">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400 text-sm mb-6">
            You do not have administrative privileges to access this dashboard. Admin status is controlled via role metadata.
          </p>
          <div className="flex flex-col space-y-3">
            <Link
              href="/"
              className="py-3 px-4 rounded-xl bg-slate-900 border border-white/10 hover:bg-slate-800 text-white font-bold text-xs transition-all flex items-center justify-center cursor-pointer"
            >
              Back to Home
            </Link>
            <button
              onClick={() => supabase.auth.signOut()}
              className="py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs transition-all flex items-center justify-center cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Header */}
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
                GuineaPigDoctor Admin
              </h1>
              <p className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-400 leading-none mt-0.5">Recommended Products Panel</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hidden sm:inline text-xs font-bold text-slate-400">
              {session?.user?.email}
            </span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="py-2 px-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-300 hover:text-rose-455 text-xs font-bold transition-all duration-200 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 py-10 w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form Column - Left */}
        <div className="lg:col-span-5">
          <div className="bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <h2 className="text-xl font-black mb-6 text-white flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span>{editingId ? "Edit Product" : "Add Recommended Product"}</span>
            </h2>

            {/* Notifications */}
            {message.text && (
              <div className="space-y-2 mb-6">
                <div className={`p-4 rounded-2xl text-xs font-semibold border flex items-center space-x-2 ${
                  message.type === "error" 
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}>
                  {message.type === "error" ? (
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ) : (
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  )}
                  <span>{message.text}</span>
                </div>
                {message.type === "error" && (
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 text-[10px] font-mono text-slate-400 space-y-1">
                    <p className="font-bold text-slate-300">Session Debug Info:</p>
                    <p>User Email: {session?.user?.email || "none"}</p>
                    <p>Client App Metadata: {JSON.stringify(session?.user?.app_metadata || {})}</p>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Product Info */}
              <div className="space-y-1">
                <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold ml-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Chewy's Blend Premium Alfalfa Hay"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/80 text-slate-100 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 font-semibold text-xs transition-all shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold ml-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950/80 text-slate-100 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 font-semibold text-xs transition-all"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold ml-1">Status</label>
                  <div className="flex items-center h-full pt-1.5 pl-1">
                    <label className="inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isActive} 
                        onChange={(e) => setIsActive(e.target.checked)} 
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500 peer-checked:after:bg-white" />
                      <span className="ml-3 text-xs font-bold text-slate-300 select-none">{isActive ? "Active" : "Inactive"}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold ml-1">Product Description</label>
                <textarea
                  rows="3"
                  placeholder="Summarize product benefits and key guinea pig nutrition context..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950/80 text-slate-100 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 font-semibold text-xs transition-all shadow-inner resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold ml-1">Primary Image URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/images/product.jpg"
                  value={primaryImageUrl}
                  onChange={(e) => setPrimaryImageUrl(e.target.value)}
                  className="w-full bg-slate-950/80 text-slate-100 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 font-semibold text-xs transition-all shadow-inner"
                />
              </div>

              {/* Product Offers Section */}
              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Vendor Pricing & Links</h3>
                  <button
                    type="button"
                    onClick={addOfferRow}
                    className="py-1.5 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-black tracking-wide uppercase transition-all duration-150 cursor-pointer"
                  >
                    + Add Offer
                  </button>
                </div>

                {offers.map((offer, idx) => (
                  <div key={idx} className="relative bg-slate-950/50 p-4 rounded-2xl border border-white/5 space-y-3">
                    {/* Delete Offer Row button */}
                    {offers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOfferRow(idx)}
                        className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Remove Offer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}

                    <div className="grid grid-cols-12 gap-3">
                      {/* Merchant Select */}
                      <div className="col-span-7 space-y-1">
                        <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Merchant</label>
                        <select
                          required
                          value={offer.merchantId}
                          onChange={(e) => handleOfferChange(idx, "merchantId", e.target.value)}
                          className="w-full bg-slate-950 text-slate-100 border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/40 text-[11px] font-semibold transition-all"
                        >
                          <option value="">Select Merchant</option>
                          {merchants.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Manual Price */}
                      <div className="col-span-5 space-y-1">
                        <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Manual Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 19.99"
                          value={offer.manualPrice}
                          onChange={(e) => handleOfferChange(idx, "manualPrice", e.target.value)}
                          className="w-full bg-slate-950 text-slate-100 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/40 text-[11px] font-semibold transition-all shadow-inner"
                        />
                      </div>
                    </div>

                    {/* Affiliate URL */}
                    <div className="space-y-1">
                      <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Affiliate Destination URL</label>
                      <input
                        type="url"
                        required
                        placeholder="Paste raw affiliate link (SiteStripe, Impact, etc.)..."
                        value={offer.affiliateUrl}
                        onChange={(e) => handleOfferChange(idx, "affiliateUrl", e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/40 text-[11px] font-semibold transition-all shadow-inner"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex space-x-3">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-grow py-3 px-4 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
                >
                  {actionLoading ? "Saving Product..." : editingId ? "Save Changes" : "Create Product"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="py-3 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Data Table Column - Right */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-950/70 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <h2 className="text-xl font-black mb-6 text-white flex items-center justify-between">
              <span>Existing Recommendations</span>
              <span className="py-1 px-2.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400">
                {products.length} Products
              </span>
            </h2>

            {products.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-4 stroke-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25m-2.25-2.25l-2.25 2.25m2.25-2.25l2.25-2.25M3.75 7.5L5.625 4.5h12.75L20.25 7.5M12 18.75v-3" /></svg>
                <p className="text-xs font-semibold">No recommended products added yet.</p>
                <p className="text-[10px] text-slate-600 mt-1">Use the form to list your first recommended product.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-slate-450 font-extrabold">
                      <th className="py-3 px-4">Product Info</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Offers & Manual Prices</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-white/[0.02] transition-colors group">
                        {/* Info Column */}
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            {product.primary_image_url ? (
                              <img
                                src={product.primary_image_url}
                                alt={product.name}
                                className="w-10 h-10 rounded-lg object-cover bg-slate-900 border border-white/10 shrink-0"
                                onError={(e) => { e.target.src = "/file.svg" }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-white leading-tight">{product.name}</p>
                              <span className="inline-block mt-1 text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-extrabold tracking-wide uppercase px-1.5 py-0.5 rounded">
                                {product.category}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                            product.is_active 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                              : "bg-slate-800 border-slate-700 text-slate-500"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${product.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
                            <span>{product.is_active ? "Active" : "Inactive"}</span>
                          </span>
                        </td>

                        {/* Offers Column */}
                        <td className="py-4 px-4">
                          <div className="space-y-2 max-w-[200px]">
                            {product.product_offers?.map((offer) => {
                              const merchant = merchants.find(m => m.id === offer.merchant_id);
                              const isEditingPrice = quickPriceEdit[offer.id] !== undefined;
                              
                              return (
                                <div key={offer.id} className="flex items-center justify-between space-x-2 bg-slate-950/40 p-1.5 rounded-lg border border-white/5">
                                  <span className="font-extrabold text-[10px] uppercase text-slate-400">
                                    {merchant ? merchant.name : "Unknown"}
                                  </span>
                                  
                                  {isEditingPrice ? (
                                    <div className="flex items-center space-x-1">
                                      <span className="text-[10px] text-slate-500 font-bold">$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={quickPriceEdit[offer.id]}
                                        onChange={(e) => handleQuickPriceChange(offer.id, e.target.value)}
                                        className="w-16 bg-slate-950 text-slate-100 border border-white/20 rounded px-1 py-0.5 text-[10px] font-bold focus:outline-none focus:border-indigo-500"
                                        placeholder="0.00"
                                        autoFocus
                                      />
                                      {/* Quick Save Price */}
                                      <button
                                        onClick={() => handleSaveQuickPrice(offer.id)}
                                        disabled={actionLoading}
                                        className="p-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded cursor-pointer"
                                        title="Save Price"
                                      >
                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                      </button>
                                      {/* Cancel Quick Price Edit */}
                                      <button
                                        onClick={() => {
                                          const updated = { ...quickPriceEdit };
                                          delete updated[offer.id];
                                          setQuickPriceEdit(updated);
                                        }}
                                        className="p-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded cursor-pointer"
                                        title="Cancel"
                                      >
                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-extrabold text-white">
                                        {offer.manual_price ? `$${offer.manual_price.toFixed(2)}` : "No price"}
                                      </span>
                                      {/* Trigger Price Edit */}
                                      <button
                                        onClick={() => handleQuickPriceChange(offer.id, offer.manual_price ? offer.manual_price.toString() : "")}
                                        className="p-0.5 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors cursor-pointer"
                                        title="Edit Price"
                                      >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end items-center space-x-2">
                            <button
                              onClick={() => handleEdit(product)}
                              disabled={actionLoading}
                              className="py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer font-semibold text-[10px]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={actionLoading}
                              className="py-1 px-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 hover:text-rose-350 transition-all cursor-pointer font-semibold text-[10px]"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-slate-950/40 backdrop-blur-md border-t border-white/5 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-[10px] text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} GuineaPigDoctor. All rights reserved. Admin Recommended Products Console.
        </div>
      </footer>
    </div>
  );
}
