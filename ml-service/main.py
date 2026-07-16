import io
import os
import time
import base64
import logging
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms
import torchvision.models as models
import cv2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import pytorch-grad-cam components
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fgvc-service")


# ----------------------------------------------------
# 1. Custom Neural Network Architecture Definitions
# ----------------------------------------------------

class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super(SpatialAttention, self).__init__()
        # Receives concatenated mean & max pooling along channels (2 channels total)
        self.conv1 = nn.Conv2d(2, 1, kernel_size=kernel_size, padding=kernel_size // 2, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        x_pool = torch.cat([avg_out, max_out], dim=1)
        x_out = self.conv1(x_pool)
        scale = self.sigmoid(x_out)
        return x * scale

class FeatureDisentanglement(nn.Module):
    def __init__(self, in_channels=2048, num_splits=4):
        super(FeatureDisentanglement, self).__init__()
        self.num_splits = num_splits
        split_channels = in_channels // num_splits
        # Projectors for each split chunk of channels
        self.projectors = nn.ModuleList([
            nn.Sequential(
                nn.Conv2d(split_channels, split_channels, kernel_size=1),
                nn.BatchNorm2d(split_channels)
            ) for _ in range(num_splits)
        ])

    def forward(self, x):
        # Split along channel dimension (dim=1)
        chunks = torch.chunk(x, self.num_splits, dim=1)
        projected = [self.projectors[i](chunk) for i, chunk in enumerate(chunks)]
        # Concatenate back to original channel dimension
        return torch.cat(projected, dim=1)

class FGVC_GenderClassifier(nn.Module):
    def __init__(self):
        super(FGVC_GenderClassifier, self).__init__()
        # Pretrained ResNet50 backbone sliced to feature map level
        resnet = models.resnet50()
        self.backbone = nn.Sequential(*list(resnet.children())[:-2])
        
        self.spatial_attention = SpatialAttention()
        self.disentanglement = FeatureDisentanglement(in_channels=2048)
        
        # Dense classification head
        self.classifier = nn.Sequential(
            nn.Dropout(p=0.5),
            nn.Linear(2048, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.5),
            nn.Linear(512, 2)
        )

    def forward(self, x):
        x = self.backbone(x)
        x = self.spatial_attention(x)
        x = self.disentanglement(x)
        x = nn.functional.adaptive_avg_pool2d(x, (1, 1))
        x = torch.flatten(x, 1)
        x = self.classifier(x)
        return x

# ----------------------------------------------------
# 2. FastAPI Lifespan Hooks & Device Configuration
# ----------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Determine local execution device context
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device context: {device}")
    
    # Load model and weights
    logger.info("Initializing FGVC Gender Classifier Model...")
    model = FGVC_GenderClassifier()
    weights_path = "fgvc_gender_best_1.pth"
    
    # Download weights dynamically if not found locally
    if not os.path.exists(weights_path):
        weights_url = os.getenv("WEIGHTS_URL")
        if weights_url:
            logger.info(f"Model weights not found. Downloading from WEIGHTS_URL: {weights_url}")
            try:
                import urllib.request
                # Download with a clean browser header to prevent HTTP 403 blocks from host servers
                opener = urllib.request.build_opener()
                opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
                urllib.request.install_opener(opener)
                urllib.request.urlretrieve(weights_url, weights_path)
                logger.info("Weights downloaded successfully.")
            except Exception as e:
                logger.error(f"CRITICAL: Failed to download weights from URL: {e}")
                raise e
        else:
            logger.error("CRITICAL: fgvc_gender_best_1.pth not found and WEIGHTS_URL is not configured.")
            raise FileNotFoundError("Model weights file not found and WEIGHTS_URL is not set.")
            
    try:
        logger.info(f"Loading state dictionary from: {weights_path}")
        state_dict = torch.load(weights_path, map_location=device)
        if "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        model.load_state_dict(state_dict)
        model.to(device)
        model.eval()
        
        # Initialize Grad-CAM
        # We target the last layer of the sliced backbone, which is resnet.layer4 (index -1 in backbone)
        target_layers = [model.backbone[-1]]
        cam = GradCAM(model=model, target_layers=target_layers)
        
        # Share via app.state
        app.state.model = model
        app.state.cam = cam
        app.state.device = device
        app.state.loaded = True
        logger.info("Model and Grad-CAM pipeline loaded successfully into lifespan memory.")
    except Exception as e:
        logger.error(f"Failed to load model weights: {e}")
        app.state.loaded = False
        raise e
        
    yield
    
    # Cleanup on shutdown
    logger.info("Cleaning up and freeing model resources...")
    app.state.model = None
    app.state.cam = None
    app.state.loaded = False

# Instantiate app
app = FastAPI(
    title="FGVC Gender Classification & Explainable AI Service",
    lifespan=lifespan
)

# Enable CORS for Next.js backend/frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------
# 3. Predict Endpoint & Cropping Logic
# ----------------------------------------------------

@app.post("/predict-gender")
async def predict_gender(
    file: UploadFile = File(...),
    x_pct: float = Form(0.5),
    y_pct: float = Form(0.5),
    box_scale: float = Form(0.4)
):
    # Verify the environment was loaded once at startup
    if not getattr(app.state, "loaded", False):
        raise HTTPException(status_code=503, detail="Model is not loaded.")
        
    try:
        # Read the image
        contents = await file.read()
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        logger.error(f"Failed to open uploaded file as image: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid image upload: {e}")

    W, H = pil_image.size
    logger.info(f"Original image size: {W}x{H}, Crop Center: ({x_pct}, {y_pct}), Scale: {box_scale}")

    # Replicate mathematical square-cropping logic centered at (x_pct, y_pct)
    cx = x_pct * W
    cy = y_pct * H
    box_side = box_scale * min(W, H)
    
    # Calculate top-left and bottom-right points
    x1 = int(cx - box_side / 2)
    y1 = int(cy - box_side / 2)
    x2 = int(cx + box_side / 2)
    y2 = int(cy + box_side / 2)
    
    # Clamp coordinates inside the bounds of the image
    x1_clamped = max(0, min(W - 1, x1))
    y1_clamped = max(0, min(H - 1, y1))
    x2_clamped = max(0, min(W - 1, x2))
    y2_clamped = max(0, min(H - 1, y2))
    
    # Guard against zero-area crops
    if x2_clamped <= x1_clamped or y2_clamped <= y1_clamped:
        raise HTTPException(status_code=400, detail="Calculated crop box bounds are invalid or zero-area.")

    # Perform the crop
    cropped_image = pil_image.crop((x1_clamped, y1_clamped, x2_clamped, y2_clamped))
    
    # Preprocess crop for model input
    preprocess = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])
    
    input_tensor = preprocess(cropped_image).unsqueeze(0).to(app.state.device)
    
    # Fetch model state from app
    model = app.state.model
    cam = app.state.cam
    
    # Predict output
    try:
        # Run forward pass (with gradient tracing enabled for Grad-CAM)
        with torch.enable_grad():
            outputs = model(input_tensor)
            probs = torch.softmax(outputs, dim=1)
            confidence, class_idx_tensor = torch.max(probs, dim=1)
            
            confidence_val = float(confidence.item())
            class_idx = int(class_idx_tensor.item())
            
            classes = ["female", "male"]
            prediction_label = classes[class_idx]
            
            # Compute Grad-CAM over model.backbone[-1]
            targets = [ClassifierOutputTarget(class_idx)]
            
            # Prep visual RGB image normalized to [0.0, 1.0] for Grad-CAM overlay
            resized_crop = cropped_image.resize((224, 224))
            rgb_img = np.array(resized_crop, dtype=np.float32) / 255.0
            
            grayscale_cam = cam(input_tensor=input_tensor, targets=targets)[0, :]
            # Blend the heatmap onto the RGB cropped image
            visualization = show_cam_on_image(rgb_img, grayscale_cam, use_rgb=True)
            
        # Convert the CAM visualization to base64
        cam_pil = Image.fromarray(visualization)
        buffer = io.BytesIO()
        cam_pil.save(buffer, format="JPEG")
        cam_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        cam_image_uri = f"data:image/jpeg;base64,{cam_base64}"
        
        logger.info(f"Inference result: {prediction_label} with confidence {confidence_val:.4f}")
        
        return {
            "prediction": prediction_label,
            "confidence": confidence_val,
            "cam_image": cam_image_uri
        }
    except Exception as e:
        logger.error(f"Error during model inference / Grad-CAM generation: {e}")
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

# ----------------------------------------------------
# 4. Multimodal Breed Classification & Rate Limiting
# ----------------------------------------------------
from collections import defaultdict

RATE_LIMIT_WINDOW = 60  # seconds
MAX_REQUESTS_PER_WINDOW = 5  # requests
rate_limit_records = defaultdict(list)

def is_rate_limited(ip: str) -> bool:
    now = time.time()
    rate_limit_records[ip] = [t for t in rate_limit_records[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(rate_limit_records[ip]) >= MAX_REQUESTS_PER_WINDOW:
        return True
    rate_limit_records[ip].append(now)
    return False

SYSTEM_PROMPT = r"""# Role & Core Objective
You are an expert veterinary zoologist specializing in Caviomorphs (guinea pigs) and a highly precise visual classification model. Your sole task is to analyze the provided image, isolate the guinea pig, identify its specific breed, and describe its key physical characteristics.

# Image Analysis Guidelines
1. Focus Isolation: Zoom in mentally on the animal. Completely ignore all background noise, including cages, bedding, human hands, toys, food bowls, or lighting artifacts.
2. Feature Evaluation: Analyze the following traits to determine the breed:
   - Coat Length: Short, long, or hairless.
   - Coat Texture: Smooth, rosetted (swirls/crested), curly, dense, wiry, or plush.
   - Distinctive Markings/Growth: Direction of hair growth (e.g., sweeps backward, grows over the face, forms a crest on the forehead).

# Scope Guardrail & Exception Handling
CRITICAL: Before performing any classification, verify that the primary animal in the image is a guinea pig (*Cavia porcellus*).
- IF the image contains a dog, cat, rabbit, bird, reptile, or any animal/object that is clearly NOT a guinea pig:
  - DO NOT classify a breed.
  - DO NOT provide a standard error message.
  - Action: Immediately respond with a witty, sharp, and sarcastic remark mocking the user's inability to tell a guinea pig apart from a completely different species (e.g., pointing out that their "guinea pig" seems to bark, meow, or look suspiciously like an apex predator). Keep it humorous but undeniably sarcastic.

# Supported Breed Reference Checklist
Use this internal taxonomy to guide your classification:
- American / English (Short, smooth coat)
- Abyssinian (Multiple distinct rosettes/swirls)
- Peruvian (Very long, straight coat parting down the back, growing over the head)
- Silkie / Sheltie (Long, straight coat sweeping backward away from the face)
- Teddy (Dense, plush, wire-like coat that stands on end)
- Rex (Short, dense, woolly coat with no guard hairs)
- Coronet (Long coat like a Silkie, but with a single rosette/crest on the forehead)
- Texel (Long, distinctively curly or wavy coat)
- Skinny Pig / Baldwin (Nearly or completely hairless)

# Output Format (Only if it is a guinea pig)
Provide the response using the following structure:
- **Identified Breed:** [Breed Name]
- **Confidence Score:** [High/Medium/Low based on image clarity]
- **Key Characteristics Observed:** [2-3 bullet points detailing coat texture, length, or patterns that led to this conclusion]"""

@app.post("/classify-breed")
async def classify_breed(request: Request, file: UploadFile = File(...)):
    # 1. Rate Limiter Checks
    client_ip = request.client.host if request.client else "unknown_ip"
    if is_rate_limited(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute before trying again.")

    # 2. File Size & MIME Type Security Validation
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds the 5MB security limit.")

    content_type = file.content_type or ""
    if not content_type.startswith("image/") or not any(ext in file.filename.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WebP images are allowed.")

    # 3. Read GEMINI_API_KEY
    load_dotenv(override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured on the backend server.")

    # 4. Prepare base64 data for multimodal Gemini API call
    base64_image = base64.b64encode(contents).decode("utf-8")

    # 5. Make httpx call to Google Gemini API
    # We use gemini-2.5-flash as the latest standard multimodal model
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_PROMPT},
                    {
                        "inlineData": {
                            "mimeType": content_type,
                            "data": base64_image
                        }
                    }
                ]
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(gemini_url, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"Gemini API returned HTTP error status: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=502, detail="Error communicating with the visual classification backend.")
    except Exception as e:
        logger.error(f"Unexpected error calling Gemini API: {e}")
        raise HTTPException(status_code=500, detail="Failed to run visual breed classification.")

    # 6. Parse and extract model text response
    try:
        candidate = data["candidates"][0]
        text_response = candidate["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        logger.error(f"Malformed Gemini response format: {data}")
        raise HTTPException(status_code=502, detail="Visual classification model returned an invalid payload.")

    return {"classification": text_response}

