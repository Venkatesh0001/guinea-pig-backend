"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";
import { apiFetch } from "@/utils/apiFetch";

export default function PiggyPrints() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [priceRange, setPriceRange] = useState(150); // Max price threshold
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [searchBrandQuery, setSearchBrandQuery] = useState("");
  const [sortBy, setSortBy] = useState("Popularity"); // Popularity, LowToHigh, HighToLow, Newest
  const [wishlist, setWishlist] = useState([]); // Array of product IDs

  // Order modal states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [activeProductImageIndex, setActiveProductImageIndex] = useState(0);

  // Customizer & Blueprint states
  const [blueprintData, setBlueprintData] = useState(null);
  const [loadingBlueprint, setLoadingBlueprint] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Image Upload and Spatial Coordinates
  const [uploadedImageBase64, setUploadedImageBase64] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [originalImageWidth, setOriginalImageWidth] = useState(0);
  const [originalImageHeight, setOriginalImageHeight] = useState(0);
  const [imageAspectRatio, setImageAspectRatio] = useState(1);
  const [uploadError, setUploadError] = useState("");
  const [userScale, setUserScale] = useState(0.5);
  const [userX, setUserX] = useState(0.5);
  const [userY, setUserY] = useState(0.5);

  // Policy confirmation checkbox
  const [policyConfirmed, setPolicyConfirmed] = useState(false);

  // Print bounds canvas reference
  const printBoxRef = useRef(null);

  // Shipping & Checkout states
  const [shipping, setShipping] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    region: "",
    zip: "",
    country: "US",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");

  // Auto-switch image to match selected variant
  useEffect(() => {
    if (!selectedProduct || !selectedVariantId) return;
    const variantIdNum = parseInt(selectedVariantId);
    const matchedIndex = selectedProduct.images?.findIndex((img) => 
      img.variant_ids && img.variant_ids.includes(variantIdNum)
    );
    if (matchedIndex !== undefined && matchedIndex !== -1) {
      setActiveProductImageIndex(matchedIndex);
    }
  }, [selectedVariantId, selectedProduct]);

  // Fetch Printify products directly from Supabase (Bypasses cold-start latency)
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const { data: dbProducts, error: dbError } = await supabase.from('products').select('raw_data').order('updated_at', { ascending: false });
        
        if (dbError) {
          throw new Error(dbError.message || "Database error retrieving product catalog.");
        }
        
        const productList = dbProducts.map(row => JSON.parse(row.raw_data));
        setProducts(productList);
        setFilteredProducts(productList);
        setError("");
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load product catalog.");
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // Filter and Sort Pipeline
  useEffect(() => {
    let result = [...products];

    // 1. Category Filter
    if (selectedCategory !== "All") {
      result = result.filter((p) => {
        const titleLower = p.title.toLowerCase();
        if (selectedCategory === "Apparel") {
          return titleLower.includes("shirt") || titleLower.includes("tee") || titleLower.includes("hoodie") || titleLower.includes("apparel");
        }
        if (selectedCategory === "Mugs & Drinkware") {
          return titleLower.includes("mug") || titleLower.includes("cup") || titleLower.includes("bottle") || titleLower.includes("drink");
        }
        if (selectedCategory === "Home Decor") {
          return titleLower.includes("poster") || titleLower.includes("canvas") || titleLower.includes("pillow") || titleLower.includes("frame");
        }
        return true;
      });
    }

    // 2. Brand Filter
    if (selectedBrands.length > 0) {
      result = result.filter((p) => {
        // Map product tag or mock brand
        const mockBrand = getMockBrandName(p.id);
        return selectedBrands.includes(mockBrand);
      });
    }

    // 3. Price Filter (based on min price)
    result = result.filter((p) => {
      const prices = p.variants?.map((v) => v.price) || [0];
      const minPrice = prices.length > 0 ? Math.min(...prices) / 100 : 0;
      return minPrice <= priceRange;
    });

    // 4. Sort Options
    if (sortBy === "LowToHigh") {
      result.sort((a, b) => {
        const priceA = Math.min(...(a.variants?.map((v) => v.price) || [0])) / 100;
        const priceB = Math.min(...(b.variants?.map((v) => v.price) || [0])) / 100;
        return priceA - priceB;
      });
    } else if (sortBy === "HighToLow") {
      result.sort((a, b) => {
        const priceA = Math.min(...(a.variants?.map((v) => v.price) || [0])) / 100;
        const priceB = Math.min(...(b.variants?.map((v) => v.price) || [0])) / 100;
        return priceB - priceA;
      });
    } else if (sortBy === "Newest First") {
      // Just keep order or reverse
      result.reverse();
    }

    setFilteredProducts(result);
  }, [products, selectedCategory, priceRange, selectedBrands, sortBy]);



  // Wishlist toggle
  const toggleWishlist = (id) => {
    if (wishlist.includes(id)) {
      setWishlist(wishlist.filter((item) => item !== id));
    } else {
      setWishlist([...wishlist, id]);
    }
  };

  // Mock brand mapping based on product ID to populate Flipkart-like Brand Filter
  const getMockBrandName = (id) => {
    const brands = ["GUINEA WEAR", "CAVY DESIGN", "PIGGY COUTURE", "DOCTOUR APPAREL"];
    const numericId = parseInt(id.toString().replace(/\D/g, "")) || 0;
    return brands[numericId % brands.length];
  };

  // Open modal and load Printify blueprint data
  const handleOpenCustomize = async (product) => {
    setSelectedProduct(product);
    if (product.variants && product.variants.length > 0) {
      setSelectedVariantId(product.variants[0].id.toString());
    } else {
      setSelectedVariantId("");
    }
    setOrderResult(null);
    setCheckoutError("");
    setActiveProductImageIndex(0);
    setIsCustomizing(false);
    setUploadedImageBase64("");
    setUploadedFileName("");
    setUploadError("");
    setPolicyConfirmed(false);

    // Query variant-specific placeholders & blank mockup image assets
    if (product.blueprint_id && product.print_provider_id) {
      try {
        setLoadingBlueprint(true);
        const titleParam = product.title ? `?title=${encodeURIComponent(product.title)}` : "";
        const res = await apiFetch(`/api/ecommerce/blueprint-dimensions/${product.blueprint_id}/${product.print_provider_id}${titleParam}`);
        if (res.ok) {
          const data = await res.json();
          setBlueprintData(data);
        }
      } catch (err) {
        console.error("Failed to query blueprint details:", err);
      } finally {
        setLoadingBlueprint(false);
      }
    } else {
      setBlueprintData(null);
    }
  };

  // Close modal
  const handleCloseCustomize = () => {
    setSelectedProduct(null);
    setBlueprintData(null);
  };

  // Handle shipping input changes
  const handleShippingChange = (e) => {
    const { name, value } = e.target;
    setShipping((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle file select and check file metadata
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type.toLowerCase();
    if (!fileType.includes("png") && !fileType.includes("jpeg") && !fileType.includes("jpg")) {
      setUploadError("Invalid file type. Please upload a PNG or JPG image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      const img = new Image();
      img.onload = () => {
        setOriginalImageWidth(img.width);
        setOriginalImageHeight(img.height);
        const aspect = img.width / img.height;
        setImageAspectRatio(aspect);
        setUploadedImageBase64(base64Data);
        setUploadedFileName(file.name);
        setUploadError("");
        setIsCustomizing(true);

        // Calculate maximum scale that fits within blueprint boundaries without overflow
        const cal = blueprintData?.calibration?.front || { aspect_ratio: 0.875 };
        const maxScale = Math.min(1.0, aspect / cal.aspect_ratio);
        setUserScale(Math.max(0.2, maxScale * 0.75));
        setUserX(0.5);
        setUserY(0.5);
      };
      img.src = base64Data;
    };
    reader.readAsDataURL(file);
  };

  // Position clamping helper to restrict image within print area borders
  const getClampedCoordinates = (scale, x, y, imgAspect, boxAspect) => {
    const halfW = scale / 2;
    const clampedX = Math.max(halfW, Math.min(1 - halfW, x));

    // Height fraction is: scale * boxAspect / imgAspect
    const halfH = (scale * boxAspect) / (imgAspect * 2);
    const clampedY = Math.max(halfH, Math.min(1 - halfH, y));

    return { x: clampedX, y: clampedY };
  };

  // Get active variant blueprint dimensions
  const getActivePlaceholder = () => {
    if (!selectedVariantId || !blueprintData?.variants) {
      return blueprintData?.placeholders?.[0] || { width: 3185, height: 3636 };
    }
    const variant = blueprintData.variants.find(v => v.id.toString() === selectedVariantId.toString());
    return variant?.placeholders?.[0] || blueprintData?.placeholders?.[0] || { width: 3185, height: 3636 };
  };

  // Live print resolution DPI calculator
  const calculateEffectiveDpi = () => {
    if (!originalImageWidth) return 300;
    const placeholder = getActivePlaceholder();
    const placeholderWidth = placeholder.width || 3185;
    const dpi = Math.round((originalImageWidth * 300) / (placeholderWidth * userScale));
    return dpi;
  };

  // Standard or custom image Order submission pipeline
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !selectedVariantId) {
      setCheckoutError("Please select a variant.");
      return;
    }

    if (isCustomizing && !policyConfirmed) {
      setCheckoutError("You must confirm that your upload complies with Printify copyright and content policies.");
      return;
    }

    setIsSubmitting(true);
    setCheckoutError("");
    setOrderResult(null);

    try {
      let lineItems = [];

      if (isCustomizing && uploadedImageBase64) {
        // 1. Upload Base64 design server-side to resolve CORS restrictions
        const uploadRes = await apiFetch("/api/ecommerce/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: uploadedImageBase64,
            file_name: uploadedFileName || "custom_design.png"
          })
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          throw new Error(`Printify image upload proxy failed: ${errText}`);
        }

        const uploadData = await uploadRes.json();
        const printifyImageId = uploadData.id;

        // 2. Format catalog-based custom product order payload
        lineItems = [
          {
            blueprint_id: parseInt(selectedProduct.blueprint_id),
            print_provider_id: parseInt(selectedProduct.print_provider_id),
            variant_id: parseInt(selectedVariantId),
            quantity: 1,
            print_areas: {
              front: [
                {
                  id: printifyImageId,
                  scale: parseFloat(userScale.toFixed(6)),
                  x: parseFloat(userX.toFixed(6)),
                  y: parseFloat(userY.toFixed(6)),
                  angle: 0
                }
              ]
            }
          }
        ];
      } else {
        // Standard Direct Store product order (e.g. original design)
        lineItems = [
          {
            product_id: selectedProduct.id,
            variant_id: parseInt(selectedVariantId),
            quantity: 1
          }
        ];
      }

      const orderPayload = {
        line_items: lineItems,
        shipping_to: {
          first_name: shipping.firstName,
          last_name: shipping.lastName,
          email: shipping.email,
          phone: shipping.phone || "1234567890",
          address1: shipping.address1,
          address2: shipping.address2 || "",
          city: shipping.city,
          region: shipping.region,
          zip: shipping.zip,
          country: shipping.country,
        },
      };

      const orderRes = await apiFetch("/api/ecommerce/submit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new Error(`Printify order submission failed: ${errText}`);
      }

      const orderData = await orderRes.json();
      setOrderResult(orderData);
    } catch (err) {
      console.error(err);
      setCheckoutError(err.message || "Checkout submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stripHtml = (htmlStr) => {
    if (!htmlStr) return "";
    return htmlStr.replace(/<[^>]*>/g, "");
  };

  const toggleBrandFilter = (brandName) => {
    if (selectedBrands.includes(brandName)) {
      setSelectedBrands(selectedBrands.filter((b) => b !== brandName));
    } else {
      setSelectedBrands([...selectedBrands, brandName]);
    }
  };

  const BRANDS_LIST = ["GUINEA WEAR", "CAVY DESIGN", "PIGGY COUTURE", "DOCTOUR APPAREL"];
  const filteredBrandsList = BRANDS_LIST.filter((b) => 
    b.toLowerCase().includes(searchBrandQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col justify-between">

      {/* Header Navigation */}
      <header className="sticky top-0 z-50 bg-slate-950/45 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="inline-flex items-center text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition-colors">
              ← Back to Home
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-350">
                GuineaPig POD Shop
              </span>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-300 hover:text-rose-450 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center space-x-1.5 shadow-sm"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Core Flipkart Style Grid Section */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 relative z-10 flex flex-col lg:flex-row gap-6">
        
        {/* Left Filter Sidebar */}
        <aside className="w-full lg:w-72 flex-shrink-0 bg-slate-900/40 border border-white/5 rounded-3xl p-6 self-start space-y-6">
          <div className="border-b border-white/5 pb-4 flex justify-between items-center">
            <h2 className="text-lg font-bold text-white tracking-wide">Filters</h2>
            <button 
              onClick={() => {
                setSelectedCategory("All");
                setPriceRange(50);
                setSelectedBrands([]);
                setSearchBrandQuery("");
              }}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              CLEAR ALL
            </button>
          </div>

          {/* Categories Selector */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Categories</h4>
            <div className="space-y-2 text-sm font-semibold text-slate-350 ml-1">
              {["All", "Apparel", "Mugs & Drinkware", "Home Decor"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`block text-left w-full transition-all hover:text-white ${
                    selectedCategory === cat 
                      ? "text-indigo-400 font-bold border-l-2 border-indigo-500 pl-2" 
                      : "pl-0"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Brand Checklist */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Brand</h4>
            <div className="relative mb-2">
              <input
                type="text"
                value={searchBrandQuery}
                onChange={(e) => setSearchBrandQuery(e.target.value)}
                placeholder="Search Brand"
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 shadow-inner"
              />
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {filteredBrandsList.map((brandName) => (
                <label key={brandName} className="flex items-center space-x-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(brandName)}
                    onChange={() => toggleBrandFilter(brandName)}
                    className="rounded accent-indigo-500 bg-slate-950 border-white/10 cursor-pointer"
                  />
                  <span>{brandName}</span>
                </label>
              ))}
              {filteredBrandsList.length === 0 && (
                <span className="text-[10px] text-slate-500">No matching brands.</span>
              )}
            </div>
          </div>

          {/* Price Range Slider */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center text-xs font-extrabold uppercase tracking-wider text-slate-400">
              <span>Price Range</span>
              <span className="font-mono text-indigo-400 font-bold">${priceRange} Max</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={priceRange}
              onChange={(e) => setPriceRange(parseInt(e.target.value))}
              className="w-full accent-indigo-500 h-1 rounded bg-slate-950"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>$5</span>
              <span>$100</span>
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <section className="flex-grow space-y-6">
          
          {/* Breadcrumbs & Sort Header */}
          <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              {/* Flipkart style breadcrumbs */}
              <div className="text-[10px] font-bold text-slate-500 tracking-wider">
                Home &gt; piggy prints &gt; cavy shop
              </div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Cavy Tees, Shirts & Accessories
                <span className="text-xs font-medium text-slate-400 font-mono">
                  ({filteredProducts.length} items found)
                </span>
              </h2>
            </div>

            {/* Sort Bar */}
            <div className="flex items-center space-x-3 text-xs font-bold text-slate-400 self-start md:self-auto">
              <span>Sort By</span>
              <div className="flex bg-slate-950/40 rounded-xl p-1 border border-white/5">
                {["Popularity", "LowToHigh", "HighToLow", "Newest First"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      sortBy === opt
                        ? "bg-indigo-500/20 text-indigo-300 font-extrabold border border-indigo-500/25"
                        : "hover:text-white"
                    }`}
                  >
                    {opt === "LowToHigh" ? "Price: Low to High" : opt === "HighToLow" ? "Price: High to Low" : opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading / Error States */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-extrabold">Synchronizing Product Hub...</p>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-3xl max-w-xl mx-auto text-rose-450 text-sm">
              <p className="font-extrabold">Catalog Connection Error</p>
              <p className="text-xs text-rose-350 mt-1">{error}</p>
            </div>
          )}

          {/* Product Grid (4 columns on big screen matching Flipkart layout) */}
          {!loading && !error && (
            <>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-20 text-slate-500 space-y-2">
                  <svg className="w-12 h-12 mx-auto text-slate-650" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold">No products match your active filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => {
                    const mainImage = product.images?.[0]?.src || "/vercel.svg";
                    const prices = product.variants?.map((v) => v.price) || [0];
                    const minPrice = prices.length > 0 ? Math.min(...prices) / 100 : 0;
                    
                    // Create simulated discount pricing metrics matching Flipkart
                    // Check if product is out of stock (all variants disabled)
                    const outOfStock = product.variants && product.variants.length > 0 
                      ? !product.variants.some(v => v.is_enabled && v.is_available)
                      : false;
                      
                    const originalPrice = minPrice * 1.5;
                    const discountPct = 33;
                    const mockBrand = getMockBrandName(product.id);
                    const isWishlisted = wishlist.includes(product.id);

                    return (
                      <div 
                        key={product.id}
                        className="bg-slate-900/30 hover:bg-slate-900/50 border border-white/5 hover:border-indigo-500/30 rounded-2xl overflow-hidden flex flex-col justify-between relative shadow-lg group transition-all duration-300 transform hover:-translate-y-1"
                      >
                        {/* Wishlist Heart Icon Floating on Image */}
                        <button
                          onClick={() => toggleWishlist(product.id)}
                          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-slate-950/60 backdrop-blur-sm border border-white/10 flex items-center justify-center transition-all hover:scale-115 cursor-pointer"
                        >
                          <svg 
                            className={`w-4.5 h-4.5 ${isWishlisted ? "text-rose-500 fill-rose-500" : "text-slate-400 hover:text-rose-400"}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>

                        <div className="space-y-3">
                          {/* Image Box */}
                          <div className="w-full h-64 bg-white flex items-center justify-center p-3 relative shadow-inner overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={mainImage} 
                              alt={product.title} 
                              className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 select-none" 
                            />
                            
                            {/* Flipkart style Assured Badge */}
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-blue-600/90 text-white rounded text-[8px] font-extrabold uppercase tracking-widest shadow-md">
                              Cavy-Assured
                            </span>
                          </div>

                          {/* Info space */}
                          <div className="px-4 pb-2 space-y-1">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                              {mockBrand}
                            </span>
                            <h3 className="text-sm font-bold text-white truncate max-w-full">
                              {product.title}
                            </h3>
                            
                            {/* Price / Discount grid Row */}
                            <div className="flex items-center space-x-1.5 pt-0.5">
                              <span className="text-base font-extrabold text-white">
                                ${minPrice.toFixed(2)}
                              </span>
                              <span className="text-xs font-semibold text-slate-500 line-through">
                                ${originalPrice.toFixed(2)}
                              </span>
                              <span className="text-xs font-bold text-emerald-450">
                                {discountPct}% off
                              </span>
                            </div>

                            {/* Tags: Stock Status */}
                            <div className="flex items-center space-x-2 pt-1">
                              {outOfStock ? (
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded">
                                  Out of Stock
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                  Available
                                </span>
                              )}
                            </div>
                          </div>
                        </div>                        {/* Hover slide-up button layout */}
                        <div className="px-4 pb-4 pt-2">
                          <button
                            onClick={() => !outOfStock && handleOpenCustomize(product)}
                            disabled={outOfStock}
                            className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1 ${
                              outOfStock 
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                                : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/10 cursor-pointer'
                            }`}
                          >
                            <span>🛒</span> {outOfStock ? "Unavailable" : "Order"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </section>
      </main>

      {/* Order Modal Overlay */}
      {selectedProduct && (() => {
        const titleLower = selectedProduct.title?.toLowerCase() || "";
        const isSupported = !titleLower.includes("canvas") && !titleLower.includes("clock") && !titleLower.includes("embroidery") && !titleLower.includes("all-over");
        const activePosition = "front";

        // Spatial Calibration
        const cal = blueprintData?.calibration?.[activePosition] || { fx: 0.29, fy: 0.20, fw: 0.42, rotation: 0, aspect_ratio: 0.875 };
        const fh = cal.fw / cal.aspect_ratio;

        // Choose Flat-lay blank mockup image from Blueprint details
        const sourceIdx = blueprintData?.calibration_source_image_index !== undefined ? blueprintData.calibration_source_image_index : 0;
        const blankImage = blueprintData?.blank_images?.find(img => img.position === activePosition)
          || blueprintData?.blank_images?.[sourceIdx !== -1 ? sourceIdx : 0]
          || blueprintData?.blank_images?.[0];
        const mockupUrl = blankImage?.src || selectedProduct.images?.[activeProductImageIndex]?.src || "/vercel.svg";

        // Drag to position handlers
        const handleMouseDown = (e) => {
          e.preventDefault();
          if (!printBoxRef.current) return;
          const rect = printBoxRef.current.getBoundingClientRect();
          const boxW = rect.width;
          const boxH = rect.height;
          const startX = e.clientX;
          const startY = e.clientY;
          const initialX = userX;
          const initialY = userY;

          const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            const newX = initialX + (deltaX / boxW);
            const newY = initialY + (deltaY / boxH);

            const clamped = getClampedCoordinates(userScale, newX, newY, imageAspectRatio, cal.aspect_ratio);
            setUserX(clamped.x);
            setUserY(clamped.y);
          };

          const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };

          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        };

        // Align preset handlers
        const handleAlign = (preset) => {
          let newX = 0.5;
          let newY = 0.5;
          const halfW = userScale / 2;
          const halfH = (userScale * cal.aspect_ratio) / (imageAspectRatio * 2);

          if (preset === "left") newX = halfW;
          if (preset === "right") newX = 1 - halfW;
          if (preset === "top") newY = halfH;
          if (preset === "bottom") newY = 1 - halfH;

          setUserX(newX);
          setUserY(newY);
        };

        const currentDpi = calculateEffectiveDpi();
        const showDpiWarning = currentDpi < 150;
        const isJpg = uploadedFileName?.toLowerCase()?.endsWith(".jpg") || uploadedFileName?.toLowerCase()?.endsWith(".jpeg");
        const showAlphaWarning = isJpg && (titleLower.includes("shirt") || titleLower.includes("tee") || titleLower.includes("hoodie"));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-5xl bg-slate-900/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

              <button
                onClick={handleCloseCustomize}
                className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-slate-950 hover:bg-rose-950/35 border border-white/10 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer font-bold text-sm"
              >
                ✕
              </button>

              {/* Modal Left Preview Column */}
              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5 bg-slate-950/20 max-h-[45vh] md:max-h-none overflow-y-auto">
                <div className="space-y-2 text-center md:text-left">
                  <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-center inline-block">
                    {isCustomizing ? "Design Customizer" : "Product Preview"}
                  </span>
                  <h3 className="text-xl font-extrabold text-white truncate max-w-md mt-2">
                    {selectedProduct.title}
                  </h3>
                </div>

                {/* Main Mockup / Customizer Canvas Viewport */}
                <div className="my-4 flex-grow flex flex-col items-center justify-center min-h-[300px] relative bg-slate-950 rounded-2xl p-4 border border-white/5 shadow-inner">
                  {isCustomizing && uploadedImageBase64 ? (
                    <div className="relative w-full h-[260px] flex items-center justify-center">
                      {/* Wrapper matches the displayed mockup image so the print box is calibrated against the image, not the container */}
                      <div className="relative inline-block max-w-full max-h-[240px]">
                        {/* Blank Mockup Background */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mockupUrl}
                          alt="Blank Mockup"
                          className="block max-w-full max-h-[240px] object-contain select-none pointer-events-none"
                        />

                        {/* Calibrated Print Area Template Bounding Box */}
                        <div
                          ref={printBoxRef}
                          style={{
                            position: "absolute",
                            left: `${cal.fx * 100}%`,
                            top: `${cal.fy * 100}%`,
                            width: `${cal.fw * 100}%`,
                            height: `${fh * 100}%`,
                            border: "2px dashed rgba(99, 102, 241, 0.65)",
                            borderRadius: "4px",
                            boxSizing: "border-box",
                            overflow: "hidden"
                          }}
                        >
                          {/* Draggable user design image */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={uploadedImageBase64}
                            alt="Custom upload preview"
                            onMouseDown={handleMouseDown}
                            style={{
                              position: "absolute",
                              left: `${(userX * 100) - (userScale * 100 / 2)}%`,
                              top: `${(userY * 100) - (userScale * (100 / imageAspectRatio) * cal.aspect_ratio / 2)}%`,
                              width: `${userScale * 100}%`,
                              height: "auto",
                              cursor: "move",
                              userSelect: "none"
                            }}
                          />
                        </div>
                      </div>

                      {/* Floating DPI resolution badge */}
                      <div className={`absolute bottom-3 right-3 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow ${
                        showDpiWarning ? "bg-rose-500/20 border border-rose-500/30 text-rose-400" : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                      }`}>
                        {currentDpi} DPI
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full max-h-[260px] flex items-center justify-center rounded-2xl p-2 select-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedProduct.images?.[activeProductImageIndex]?.src || "/vercel.svg"}
                        alt="Product design preview"
                        className="max-h-[240px] object-contain rounded-xl select-none"
                      />
                    </div>
                  )}
                </div>

                {/* Interactive Gallery Thumbnails */}
                {!isCustomizing && selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="mt-1">
                    <h5 className="text-[10px] font-bold text-slate-500 mb-1.5 text-left uppercase tracking-wider">
                      Product Mockups ({selectedProduct.images.length})
                    </h5>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-indigo-500/30">
                      {selectedProduct.images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveProductImageIndex(idx)}
                          className={`relative flex-shrink-0 w-12 h-12 rounded-xl border overflow-hidden transition-all cursor-pointer ${
                            activeProductImageIndex === idx
                              ? "border-indigo-500 ring-2 ring-indigo-500/50 bg-slate-900"
                              : "border-white/10 hover:border-white/20 bg-slate-950/40"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.src}
                            alt={`Mockup ${idx + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isCustomizing && uploadedImageBase64 && (
                  <div className="space-y-2 mt-2 bg-slate-950/45 p-3 rounded-2xl border border-white/5 text-left text-[10px] font-semibold text-slate-400">
                    <p className="font-extrabold text-slate-300 uppercase tracking-wide text-[9px] mb-1">Canvas Positioning Guide</p>
                    <p>• Drag the custom image within the dashed lines to adjust layout position.</p>
                    <p>• Alignment, scaling, and dimensions are locked to the template's boundaries.</p>
                  </div>
                )}

                {!isCustomizing && (
                  <p className="text-[10px] text-slate-500 text-center leading-normal px-2 mt-2">
                    Standard catalog product mockup list. Select variants or upload your own file.
                  </p>
                )}
              </div>

              {/* Modal Right Form Column */}
              <div className="w-full md:w-1/2 p-6 md:p-8 overflow-y-auto max-h-[50vh] md:max-h-none space-y-6">
                {orderResult ? (
                  <div className="space-y-6 text-center py-10">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center mx-auto text-emerald-400 text-3xl shadow-lg">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white">Order Placed!</h4>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        Your Print-on-Demand order has been generated and pushed to the Printify queue.
                      </p>
                    </div>
                    <div className="bg-slate-950/60 rounded-xl p-4 border border-white/5 text-left text-xs font-mono space-y-2">
                      <p><span className="text-slate-500">Order ID:</span> {orderResult.id}</p>
                      <p><span className="text-slate-500">Status:</span> Pending</p>
                    </div>
                    <button
                      onClick={handleCloseCustomize}
                      className="w-full py-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-white/10 text-slate-350 hover:text-white font-bold text-sm transition-all cursor-pointer"
                    >
                      Close Portal
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitOrder} className="space-y-5">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <h4 className="text-xs uppercase tracking-wider text-slate-400 font-extrabold">
                        Order Customization
                      </h4>
                      {loadingBlueprint && (
                        <span className="text-[10px] font-bold text-indigo-400 animate-pulse">Syncing blueprint...</span>
                      )}
                    </div>

                    {/* Variant Selection */}
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-400 font-bold">Select Size & Color</label>
                      <div className="relative">
                        <select
                          value={selectedVariantId}
                          onChange={(e) => setSelectedVariantId(e.target.value)}
                          className="w-full bg-slate-950/80 text-slate-100 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer text-sm font-semibold transition-all"
                        >
                          {selectedProduct.variants?.map((v) => {
                            const isVariantInStock = v.is_enabled && v.is_available;
                            return (
                              <option key={v.id} value={v.id} className="bg-slate-950 text-slate-150" disabled={!isVariantInStock}>
                                {v.title} - ${(v.price / 100).toFixed(2)} {!isVariantInStock ? "(Out of Stock)" : ""}
                              </option>
                            );
                          })}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-indigo-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Custom Image Upload Panel */}
                    {isSupported ? (
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <label className="block text-xs text-slate-400 font-bold">✨ Design Upload</label>
                        
                        {!uploadedImageBase64 ? (
                          <div className="relative group border border-dashed border-white/10 hover:border-indigo-500/40 rounded-xl p-6 bg-slate-950/30 hover:bg-slate-950/50 transition-all text-center">
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/jpg"
                              onChange={handleImageUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <svg className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 mx-auto mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs font-bold text-slate-300">Upload your custom graphic</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-semibold">PNG or JPG (Transparent PNG recommended)</p>
                          </div>
                        ) : (
                          <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-white/5">
                            {/* File Name & Reset button */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 truncate">
                                <span className="text-xs text-indigo-400 font-black">✓</span>
                                <p className="text-xs text-slate-200 font-extrabold truncate max-w-[180px]">{uploadedFileName}</p>
                                <span className="text-[9px] text-slate-550">({originalImageWidth}x{originalImageHeight}px)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedImageBase64("");
                                  setUploadedFileName("");
                                  setIsCustomizing(false);
                                }}
                                className="text-[10px] font-black text-rose-450 hover:text-rose-400 uppercase cursor-pointer"
                              >
                                Remove Design
                              </button>
                            </div>

                            {/* Position alignment helpers */}
                            <div className="space-y-2">
                              <span className="block text-[10px] text-slate-450 uppercase font-black tracking-wider">Quick Alignments</span>
                              <div className="flex gap-2">
                                {["left", "center", "right", "top", "bottom"].map((dir) => (
                                  <button
                                    key={dir}
                                    type="button"
                                    onClick={() => handleAlign(dir)}
                                    className="py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-slate-350 hover:text-indigo-455 text-[9px] uppercase font-black transition-all cursor-pointer"
                                  >
                                    {dir}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Scale Slider */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-[10px] font-black text-slate-450 uppercase">
                                <span>Design Scale</span>
                                <span className="font-mono text-indigo-400">{Math.round(userScale * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.1"
                                max={Math.min(1.0, imageAspectRatio / cal.aspect_ratio).toString()}
                                step="0.01"
                                value={userScale}
                                onChange={(e) => {
                                  const newScale = parseFloat(e.target.value);
                                  const maxScale = Math.min(1.0, imageAspectRatio / cal.aspect_ratio);
                                  const scaleVal = Math.min(maxScale, Math.max(0.1, newScale));
                                  setUserScale(scaleVal);
                                  const clamped = getClampedCoordinates(scaleVal, userX, userY, imageAspectRatio, cal.aspect_ratio);
                                  setUserX(clamped.x);
                                  setUserY(clamped.y);
                                }}
                                className="w-full accent-indigo-500 h-1 bg-slate-900 rounded-lg cursor-pointer"
                              />
                            </div>

                            {/* Live warnings alerts box */}
                            {(showDpiWarning || showAlphaWarning) && (
                              <div className="space-y-1.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-455 text-[10px] font-semibold leading-normal">
                                {showDpiWarning && (
                                  <p>⚠️ Low resolution: Currently {currentDpi} DPI. Image may print fuzzy or pixelated. Upload a file above 150 DPI.</p>
                                )}
                                {showAlphaWarning && (
                                  <p>⚠️ Apparel warning: JPG format does not support transparency. White background boxes may print around your design. Consider transparent PNG.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {uploadError && (
                          <p className="text-xs text-rose-455 font-bold text-center mt-1">{uploadError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-350 text-[10px] font-semibold leading-relaxed">
                        ⚠️ Custom image customization is only supported for standard printed shirts, hoodies, and mugs. Canvas, clocks, and embroidery items are locked to store layouts.
                      </div>
                    )}

                    {/* Shipping Address Form */}
                    <div className="space-y-3 pt-3 border-t border-white/5">
                      <h4 className="text-xs uppercase tracking-wider text-slate-400 font-extrabold">Shipping Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <input required type="text" name="firstName" value={shipping.firstName} onChange={handleShippingChange} placeholder="First Name" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/30" />
                        <input required type="text" name="lastName" value={shipping.lastName} onChange={handleShippingChange} placeholder="Last Name" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/30" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input required type="email" name="email" value={shipping.email} onChange={handleShippingChange} placeholder="Email Address" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/30" />
                        <input type="tel" name="phone" value={shipping.phone} onChange={handleShippingChange} placeholder="Phone Number" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/30" />
                      </div>
                      <input required type="text" name="address1" value={shipping.address1} onChange={handleShippingChange} placeholder="Street Address" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/30" />
                      <input type="text" name="address2" value={shipping.address2} onChange={handleShippingChange} placeholder="Suite, Apt, Unit (Optional)" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/30" />
                      <div className="grid grid-cols-3 gap-2">
                        <input required type="text" name="city" value={shipping.city} onChange={handleShippingChange} placeholder="City" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/30" />
                        <input required type="text" name="region" value={shipping.region} onChange={handleShippingChange} placeholder="Region/State" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/30" />
                        <input required type="text" name="zip" value={shipping.zip} onChange={handleShippingChange} placeholder="Zip Code" className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/30" />
                      </div>
                    </div>

                    {/* Intellectual Property Policy Gate */}
                    {isCustomizing && uploadedImageBase64 && (
                      <div className="p-3.5 bg-slate-950/45 rounded-xl border border-white/5 space-y-2">
                        <label className="flex items-start space-x-2 text-[10px] font-semibold text-slate-400 cursor-pointer select-none">
                          <input
                            required
                            type="checkbox"
                            checked={policyConfirmed}
                            onChange={(e) => setPolicyConfirmed(e.target.checked)}
                            className="rounded accent-indigo-500 bg-slate-950 border-white/10 cursor-pointer mt-0.5"
                          />
                          <span className="leading-tight">
                            I certify that I own the rights to use this graphic, it contains no trademarked content, and complies with Printify's policy.
                          </span>
                        </label>
                      </div>
                    )}

                    {checkoutError && (
                      <p className="text-xs text-rose-455 font-bold text-center">{checkoutError}</p>
                    )}

                    {/* Action Submit Buttons */}
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-950 disabled:text-slate-650 text-white font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Processing Custom Order...</span>
                          </>
                        ) : (
                          <>
                            <span>🛒</span>
                            <span>{isCustomizing ? "Generate & Place Order" : "Place Order"}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseCustomize}
                        className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-white/10 text-slate-350 hover:text-white font-bold text-sm transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
