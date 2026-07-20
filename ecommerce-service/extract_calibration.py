"""
Auto-Calibration Script: Extract Spatial Calibration Matrix from Printify Mockup Images
========================================================================================
This script downloads the blank mockup images from the Printify blueprint catalog,
detects the orange "YOUR DESIGN" dotted boundary using color-based CV,
and outputs the exact fractional bounding box coordinates (fx, fy, fw).
"""

import os
import sys
import json
import ssl
import urllib.request
import numpy as np
from PIL import Image, ImageDraw
import io
import requests

# Disable SSL verification for image downloads
ssl._create_default_https_context = ssl._create_unverified_context

OUTPUT_DIR = os.getenv(
    "CALIBRATION_OUTPUT_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration_output")
)
os.makedirs(OUTPUT_DIR, exist_ok=True)


def download_image(url):
    """Download an image from URL and return as PIL Image."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response:
            img_data = response.read()
            return Image.open(io.BytesIO(img_data)).convert('RGB')
    except Exception as e:
        print(f"  [ERROR] Failed to download: {e}")
        return None


def detect_orange_dots(img):
    """
    Detect orange dotted markers in a Printify mockup image.
    The "YOUR DESIGN" orange dots have a very distinct color signature.
    Returns: dict with fractional bounding box, or None if not detected.
    """
    img_array = np.array(img)
    h, w, _ = img_array.shape

    r = img_array[:, :, 0].astype(float)
    g = img_array[:, :, 1].astype(float)
    b = img_array[:, :, 2].astype(float)

    # Orange color detection: high red, moderate green, low blue
    orange_mask = (
        (r > 180) &
        (g > 100) & (g < 220) &
        (b < 140) &
        (r > g) &
        (r - b > 80) &
        (g - b > 20)
    )

    orange_count = int(np.sum(orange_mask))
    print(f"    Orange pixels: {orange_count:,} / {h*w:,} ({orange_count/(h*w):.4%})")

    if orange_count < 50:
        return None

    orange_coords = np.argwhere(orange_mask)
    if len(orange_coords) == 0:
        return None

    min_row = int(orange_coords[:, 0].min())
    max_row = int(orange_coords[:, 0].max())
    min_col = int(orange_coords[:, 1].min())
    max_col = int(orange_coords[:, 1].max())

    fx = min_col / w
    fy = min_row / h
    fw = (max_col - min_col) / w
    fh = (max_row - min_row) / h

    if fw < 0.05 or fw > 0.80 or fh < 0.05 or fh > 0.80:
        print(f"    [WARN] Bounding box unreasonable: fw={fw:.3f}, fh={fh:.3f}")
        return None

    return {
        "fx": round(fx, 4),
        "fy": round(fy, 4),
        "fw": round(fw, 4),
        "fh": round(fh, 4),
        "bbox_px": {
            "left": min_col, "top": min_row,
            "right": max_col, "bottom": max_row,
            "width": max_col - min_col, "height": max_row - min_row,
        },
        "image_size": {"width": w, "height": h},
        "orange_pixel_count": orange_count,
    }


def get_fallback_calibration(front_placeholder):
    """Return a conservative centered calibration when no orange markers are found."""
    width = front_placeholder.get("width", 3185)
    height = front_placeholder.get("height", 3636)
    aspect = width / height if height else 0.875
    # Keep the box centered and sized so it fits most product mockups without
    # extending past the edges. Width is chosen conservatively; height is
    # derived from the placeholder aspect ratio.
    fw = 0.40
    fh = fw / aspect
    return {
        "fx": round(0.5 - fw / 2, 4),
        "fy": round(0.5 - fh / 2, 4),
        "fw": round(fw, 4),
        "fh": round(fh, 4),
        "rotation": 0,
        "fallback": True,
    }


def analyze_product(blueprint_id, print_provider_id, product_title):
    """Fetch blank mockup images for a product and detect the orange print area."""
    print(f"\n{'='*70}")
    print(f"Product: {product_title}")
    print(f"Blueprint: {blueprint_id} | Provider: {print_provider_id}")
    print(f"{'='*70}")

    url = f"http://127.0.0.1:8001/api/ecommerce/blueprint-dimensions/{blueprint_id}/{print_provider_id}"
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
    except Exception as e:
        print(f"  [ERROR] Cannot reach backend: {e}")
        return None

    blank_images = data.get("blank_images", [])
    print(f"  Found {len(blank_images)} blank mockup images")

    # Find the front placeholder so we can fall back to a centered box if the
    # mockup does not contain the orange 'YOUR DESIGN' markers.
    placeholders = data.get("placeholders", [])
    front_placeholder = next(
        (p for p in placeholders if p.get("position") == "front"),
        placeholders[0] if placeholders else {"width": 3185, "height": 3636}
    )

    results = []

    for idx, img_url in enumerate(blank_images):
        print(f"\n  Image [{idx}]: {img_url[:80]}...")
        img = download_image(img_url)
        if img is None:
            continue

        print(f"    Size: {img.width}x{img.height}")
        detection = detect_orange_dots(img)

        if detection:
            print(f"    >>> DETECTED! Bounding box:")
            print(f"       fx={detection['fx']:.4f} (left: {detection['fx']*100:.1f}%)")
            print(f"       fy={detection['fy']:.4f} (top: {detection['fy']*100:.1f}%)")
            print(f"       fw={detection['fw']:.4f} (width: {detection['fw']*100:.1f}%)")
            print(f"       fh={detection['fh']:.4f} (height: {detection['fh']*100:.1f}%)")
            print(f"       Aspect ratio: {detection['fw']/detection['fh']:.4f}")
            print(f"       Pixel box: {detection['bbox_px']}")

            # Save annotated image
            annotated = img.copy()
            draw = ImageDraw.Draw(annotated)
            bbox = detection['bbox_px']
            for offset in range(3):
                draw.rectangle(
                    [bbox['left']-offset, bbox['top']-offset,
                     bbox['right']+offset, bbox['bottom']+offset],
                    outline='red'
                )
            out = os.path.join(OUTPUT_DIR, f"cal_bp{blueprint_id}_img{idx}.jpg")
            annotated.save(out, quality=90)
            print(f"       Saved: {out}")

            results.append({"image_index": idx, "image_url": img_url, "detection": detection})
        else:
            print(f"    -- No orange markers")

    # If no orange markers were found on any image, use a conservative centered
    # fallback so the user still has a starting calibration to refine.
    if not results:
        fallback = get_fallback_calibration(front_placeholder)
        print(f"\n  [FALLBACK] Using centered calibration: {fallback}")
        results.append({"image_index": -1, "image_url": None, "detection": fallback})

    return results


def main():
    # Fetch all products
    try:
        resp = requests.get("http://127.0.0.1:8001/api/ecommerce/products", timeout=10)
        products = resp.json().get("data", [])
    except Exception as e:
        print(f"ERROR: Cannot reach backend: {e}")
        sys.exit(1)

    print(f"Found {len(products)} products in the catalog\n")

    all_calibrations = {}

    for product in products:
        bp_id = product.get("blueprint_id")
        pp_id = product.get("print_provider_id")
        title = product.get("title", "Unknown")

        if not bp_id or not pp_id:
            continue

        results = analyze_product(bp_id, pp_id, title)

        if results and len(results) > 0:
            best = results[0]["detection"]
            all_calibrations[bp_id] = {
                "front": {
                    "fx": best["fx"],
                    "fy": best["fy"],
                    "fw": best["fw"],
                    "rotation": 0,
                },
                "source_image_index": results[0]["image_index"],
                "product_title": title,
                "all_detections": len(results),
            }

    # Output
    print(f"\n\n{'='*70}")
    print("SPATIAL CALIBRATION MATRIX (auto-extracted)")
    print(f"{'='*70}")
    print(json.dumps(all_calibrations, indent=2))

    # Generate Python dict for direct paste into main.py
    print(f"\n\n# --- Copy-paste into main.py SPATIAL_CALIBRATION_MATRIX ---")
    for bp_id, cal in all_calibrations.items():
        front = cal["front"]
        print(f"    {bp_id}: {{")
        print(f'        "front": {{"fx": {front["fx"]}, "fy": {front["fy"]}, "fw": {front["fw"]}, "rotation": {front["rotation"]}}},')
        print(f'        "back":  {{"fx": {front["fx"]}, "fy": {front["fy"]}, "fw": {front["fw"]}, "rotation": {front["rotation"]}}},')
        print(f"    }},")

    out_path = os.path.join(OUTPUT_DIR, "calibration_matrix.json")
    with open(out_path, 'w') as f:
        json.dump(all_calibrations, f, indent=2)
    print(f"\nSaved to: {out_path}")


if __name__ == "__main__":
    main()
