import os
import io
import json
import psycopg2
from psycopg2.extras import RealDictCursor
import base64
import logging
from typing import Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import requests
from dotenv import load_dotenv

# Load env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable is not set")
    db_url = DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    conn = psycopg2.connect(db_url)
    
    # Ensure the schema exists
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            product_id TEXT PRIMARY KEY,
            raw_data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    cursor.close()
    return conn

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ecommerce-service")

API_TOKEN = os.getenv("PRINTIFY_API_TOKEN")
SHOP_ID = os.getenv("PRINTIFY_SHOP_ID")

if not API_TOKEN or not SHOP_ID:
    logger.error("Missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID in environment.")

# ----------------------------------------------------
# Cache & Webhook Automation Helpers
# ----------------------------------------------------
def reload_products_cache():
    """Reloads catalog products from the database into memory cache."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT raw_data FROM products ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        conn.close()
        
        products = [json.loads(row["raw_data"]) for row in rows]
        app.state.cached_products = products
        logger.info(f"Successfully reloaded products cache: {len(products)} products cached.")
    except Exception as e:
        logger.error(f"Failed to reload products cache: {e}")
        if not hasattr(app.state, "cached_products"):
            app.state.cached_products = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize cache on startup
    reload_products_cache()
    yield

app = FastAPI(title="Guinea Pig Platform E-Commerce POD Service", lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_printify_headers():
    return {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
        "User-Agent": "GuineaPigDoctour Custom POD Integration"
    }

# ----------------------------------------------------
# 1. Fetch Printify Catalog (Seamless Local Sync)
# ----------------------------------------------------
@app.get("/api/ecommerce/products")
async def get_products():
    # If cache is not initialized, try to load it
    if not hasattr(app.state, "cached_products") or not app.state.cached_products:
        reload_products_cache()
    return {"data": app.state.cached_products}

# ----------------------------------------------------
# 1.1 Printify Webhook Synchronization Receiver
# ----------------------------------------------------
# ----------------------------------------------------
# 1.1 Printify Webhook Synchronization Receiver (Decommissioned)
# Webhook processing has been moved to Vercel/Next.js for serverless reliability.
# ----------------------------------------------------

# ----------------------------------------------------
# 2. PIL-based local AI Style filters
# ----------------------------------------------------
@app.post("/api/ecommerce/ai-style")
async def apply_ai_style(
    file: UploadFile = File(...),
    style: str = Form("original")
):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit.")

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        logger.error(f"Failed to load upload as image: {e}")
        raise HTTPException(status_code=400, detail="Invalid image file upload.")

    style_lower = style.lower()
    try:
        if style_lower == "anime":
            # 1. Boost Color Saturation
            col_enhancer = ImageEnhance.Color(img)
            img = col_enhancer.enhance(1.45)
            # 2. Boost Contrast slightly
            cont_enhancer = ImageEnhance.Contrast(img)
            img = cont_enhancer.enhance(1.2)
            # 3. Soften flat areas
            img = img.filter(ImageFilter.SMOOTH_MORE)
        elif style_lower == "comic":
            # 1. Posterize original image to reduce colors
            posterized = ImageOps.posterize(img, 2)
            # 2. Find Edges, convert to grayscale, invert to get black ink sketch lines on white background
            edges = img.filter(ImageFilter.FIND_EDGES).convert("L")
            sketch = ImageOps.invert(edges).convert("RGB")
            # 3. Multiply/blend sketch lines over posterized color block
            img = Image.blend(sketch, posterized, 0.65)
            # 4. Enhance contrast of comic output
            cont_enhancer = ImageEnhance.Contrast(img)
            img = cont_enhancer.enhance(1.3)

        # Convert back to Base64 Data URL for instant rendering in Next.js
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return {
            "image": f"data:image/png;base64,{img_base64}"
        }
    except Exception as e:
        logger.error(f"Error during image styling ({style}): {e}")
        raise HTTPException(status_code=500, detail=f"Image styling error: {str(e)}")

# ----------------------------------------------------
# 3. Secure Base64 Image Upload to Printify Catalog
# ----------------------------------------------------
@app.post("/api/ecommerce/upload-image")
async def upload_image_to_printify(payload: Dict[str, Any]):
    if not API_TOKEN:
        raise HTTPException(status_code=500, detail="Printify API token is not configured.")

    image_data = payload.get("image_base64")
    file_name = payload.get("file_name", "custom_guinea_pig_print.png")

    if not image_data:
        raise HTTPException(status_code=400, detail="Missing base64 image data ('image_base64').")

    # Strip MIME prefix if present (e.g. "data:image/png;base64,")
    if "," in image_data:
        image_data = image_data.split(",")[1]

    url = "https://api.printify.com/v1/uploads/images.json"
    body = {
        "file_name": file_name,
        "contents": image_data
    }

    try:
        response = requests.post(url, headers=get_printify_headers(), json=body, timeout=15)
        if not response.ok:
            logger.error(f"Printify image upload error ({response.status_code}): {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Printify upload error: {response.text}")
        return response.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload image to Printify: {e}")
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")

# ----------------------------------------------------
# 3.1 Spatial Calibration Matrix
# ----------------------------------------------------
# Maps blueprint_id -> position -> mockup calibration variables.
# Each entry defines the fractional bounding box coordinates relative
# to the blank mockup image dimensions:
#   fx: Fractional X offset (left edge of box as % of image width)
#   fy: Fractional Y offset (top edge of box as % of image height)
#   fw: Fractional width (box width as % of image width)
#   rotation: Rotational skew in degrees (for angled mockups)
# Height is NEVER stored — always derived from: fh = fw / aspect_ratio
# where aspect_ratio = placeholder_width / placeholder_height
SPATIAL_CALIBRATION_MATRIX = {
    # Blueprint 1382: Unisex Oversized Boxy Tee (Bella+Canvas 3010)
    # Provider 99: Printify Choice
    # Auto-extracted from flat-lay mockup image index 0 (2048x2048)
    # Detected aspect ratio: 0.8825 (API: 0.875)
    1382: {
        "front": {"fx": 0.3252, "fy": 0.2988, "fw": 0.3486, "rotation": 0},
        "back":  {"fx": 0.3252, "fy": 0.2988, "fw": 0.3486, "rotation": 0},
        "neck":  {"fx": 0.42, "fy": 0.02, "fw": 0.16, "rotation": 0},
        "_source_image_index": 0,
    },
    # Blueprint 1405: Unisex Lightweight Crewneck Sweatshirt (Comfort Colors 1466)
    # Provider 39: SwiftPOD
    # Auto-extracted from flat-lay mockup image index 2 (2048x2048)
    # Detected aspect ratio: 0.8728 (API: 0.8751)
    1405: {
        "front":        {"fx": 0.3267, "fy": 0.2959, "fw": 0.3486, "rotation": 0},
        "back":         {"fx": 0.3267, "fy": 0.2959, "fw": 0.3486, "rotation": 0},
        "right_sleeve": {"fx": 0.70, "fy": 0.10, "fw": 0.12, "rotation": 0},
        "left_sleeve":  {"fx": 0.18, "fy": 0.10, "fw": 0.12, "rotation": 0},
        "_source_image_index": 2,
    },
}

# Default calibration for unknown blueprints (centered, 42% width)
DEFAULT_CALIBRATION = {"fx": 0.29, "fy": 0.20, "fw": 0.42, "rotation": 0}

# Cache blueprint dimensions to avoid rate limiting
BLUEPRINT_DIMENSIONS_CACHE = {}

@app.get("/api/ecommerce/blueprint-dimensions/{blueprint_id}/{print_provider_id}")
async def get_blueprint_dimensions(blueprint_id: int, print_provider_id: int):
    if not API_TOKEN:
        raise HTTPException(status_code=500, detail="Printify API token is not configured.")

    cache_key = f"{blueprint_id}_{print_provider_id}"
    if cache_key in BLUEPRINT_DIMENSIONS_CACHE:
        logger.info(f"Returning cached dimensions for blueprint {blueprint_id}")
        return BLUEPRINT_DIMENSIONS_CACHE[cache_key]

    # 1. Fetch blueprint details to get the list of blank mockup images
    bp_url = f"https://api.printify.com/v1/catalog/blueprints/{blueprint_id}.json"
    blank_images = []
    brand = ""
    model = ""
    bp_fetch_ok = False
    try:
        logger.info(f"Fetching blueprint {blueprint_id} catalog details for blank images...")
        bp_response = requests.get(bp_url, headers=get_printify_headers(), timeout=15)
        if bp_response.ok:
            bp_json = bp_response.json()
            blank_images = bp_json.get("images", [])
            brand = bp_json.get("brand", "")
            model = bp_json.get("model", "")
            bp_fetch_ok = True
    except Exception as e:
        logger.error(f"Failed to fetch blueprint details: {e}")

    # 2. Fetch variants to get dimensions
    url = f"https://api.printify.com/v1/catalog/blueprints/{blueprint_id}/print_providers/{print_provider_id}/variants.json"
    try:
        logger.info(f"Fetching dimensions for blueprint {blueprint_id} from Printify...")
        response = requests.get(url, headers=get_printify_headers(), timeout=15)
        if not response.ok:
            logger.error(f"Printify Catalog API error ({response.status_code}): {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Printify Catalog error: {response.text}")
        
        data = response.json()
        variants = data.get("variants", [])
        if not variants:
            raise HTTPException(status_code=404, detail="No blueprint variants found for this provider.")
        
        # Extract the front placeholder size from the first variant
        placeholders = variants[0].get("placeholders", [])
        
        # Format placeholders for frontend consumption
        formatted_placeholders = []
        for ph in placeholders:
            formatted_placeholders.append({
                "position": ph.get("position"),
                "width": ph.get("width"),
                "height": ph.get("height")
            })
            
        front_placeholder = next((p for p in placeholders if p.get("position") == "front"), None)
        if not front_placeholder:
            front_placeholder = placeholders[0] if placeholders else {"width": 3185, "height": 3636}
            
        # Build calibration data for the frontend
        blueprint_calibration = SPATIAL_CALIBRATION_MATRIX.get(blueprint_id, {})
        calibration = {}
        for ph in formatted_placeholders:
            pos = ph["position"]
            cal = blueprint_calibration.get(pos, DEFAULT_CALIBRATION)
            calibration[pos] = {
                "fx": cal["fx"],
                "fy": cal["fy"],
                "fw": cal["fw"],
                "rotation": cal["rotation"],
                # Aspect ratio for this position (width/height)
                "aspect_ratio": round(ph["width"] / ph["height"], 6) if ph["height"] else 0.875,
            }

        # The _source_image_index tells the frontend which blank image
        # contains the "YOUR DESIGN" orange grid (so it can skip it)
        source_img_idx = blueprint_calibration.get("_source_image_index", -1)

        result = {
            "width": front_placeholder.get("width", 3185),
            "height": front_placeholder.get("height", 3636),
            "dpi": 300,
            "blank_images": blank_images,
            "brand": brand,
            "model": model,
            "placeholders": formatted_placeholders,
            "calibration": calibration,
            "calibration_source_image_index": source_img_idx,
            "variants": variants
        }
        # Only cache when the blueprint-images fetch succeeded; transient
        # failures must not be pinned into the cache
        if bp_fetch_ok:
            BLUEPRINT_DIMENSIONS_CACHE[cache_key] = result
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch blueprint dimensions: {e}")
        # Safe fallback
        return {
            "width": 3185, 
            "height": 3636, 
            "dpi": 300,
            "blank_images": blank_images,
            "brand": brand,
            "model": model,
            "placeholders": [{"position": "front", "width": 3185, "height": 3636}],
            "calibration": {"front": {"fx": 0.29, "fy": 0.20, "fw": 0.42, "rotation": 0, "aspect_ratio": 0.876}},
            "calibration_source_image_index": -1,
            "variants": []
        }

# ----------------------------------------------------
# 4. Submit Order securely to Printify using Simplified/Dynamic Schema
# ----------------------------------------------------
@app.post("/api/ecommerce/submit-order")
async def submit_order_to_printify(payload: Dict[str, Any]):
    if not API_TOKEN or not SHOP_ID:
        raise HTTPException(status_code=500, detail="E-commerce service is not configured with credentials.")

    shipping_to = payload.get("shipping_to")
    if not shipping_to:
        raise HTTPException(status_code=400, detail="Missing required field: 'shipping_to'.")

    # If the frontend passes 'line_items' directly (the dynamic line item format)
    line_items = payload.get("line_items")
    if line_items:
        # Check and ensure types are correct
        try:
            for item in line_items:
                if "variant_id" in item:
                    item["variant_id"] = int(item["variant_id"])
                if "blueprint_id" in item:
                    item["blueprint_id"] = int(item["blueprint_id"])
                if "print_provider_id" in item:
                    item["print_provider_id"] = int(item["print_provider_id"])
                if "quantity" in item:
                    item["quantity"] = int(item["quantity"])
                    if item["quantity"] < 1:
                        raise HTTPException(status_code=400, detail="quantity must be at least 1.")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="variant_id, blueprint_id, print_provider_id and quantity must be integers.")
                
        order_body = {
            "line_items": line_items,
            "shipping_to": shipping_to
        }
    else:
        # Fallback to the old simplified format using product_id
        product_id = payload.get("product_id")
        variant_id = payload.get("variant_id")
        quantity = payload.get("quantity", 1)
        printify_image_id = payload.get("printify_image_id")
        
        if not product_id or not variant_id or not printify_image_id:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: either 'line_items' or ('product_id', 'variant_id', 'printify_image_id') must be provided."
            )

        try:
            variant_id = int(variant_id)
            quantity = int(quantity)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="variant_id, blueprint_id, print_provider_id and quantity must be integers.")
        if quantity < 1:
            raise HTTPException(status_code=400, detail="quantity must be at least 1.")

        order_body = {
            "line_items": [
                {
                    "product_id": product_id,
                    "variant_id": variant_id,
                    "quantity": quantity,
                    "print_areas": {
                        "front": [ printify_image_id ]
                    }
                }
            ],
            "shipping_to": shipping_to
        }

    url = f"https://api.printify.com/v1/shops/{SHOP_ID}/orders.json"
    try:
        logger.info(f"Submitting order to Printify: {len(order_body['line_items'])} line item(s), shipping to {shipping_to.get('country')}")
        response = requests.post(url, headers=get_printify_headers(), json=order_body, timeout=15)
        if not response.ok:
            logger.error(f"Printify order error ({response.status_code}): {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Printify order submission failed: {response.text}")
        return response.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit order: {e}")
        raise HTTPException(status_code=500, detail=f"Order error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
