# ZeroGPU Compatibility Mock for Hugging Face
try:
    import spaces
except ImportError:
    class spaces:
        @staticmethod
        def GPU(func): return func

import io
import os
import time
import base64
import logging
import httpx
import gradio as gr
from PIL import Image, ImageOps
import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms
import torchvision.models as models
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

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
        self.projectors = nn.ModuleList([
            nn.Sequential(
                nn.Conv2d(split_channels, split_channels, kernel_size=1),
                nn.BatchNorm2d(split_channels)
            ) for _ in range(num_splits)
        ])

    def forward(self, x):
        chunks = torch.chunk(x, self.num_splits, dim=1)
        projected = [self.projectors[i](chunk) for i, chunk in enumerate(chunks)]
        return torch.cat(projected, dim=1)

class FGVC_GenderClassifier(nn.Module):
    def __init__(self):
        super(FGVC_GenderClassifier, self).__init__()
        resnet = models.resnet50()
        self.backbone = nn.Sequential(*list(resnet.children())[:-2])
        self.spatial_attention = SpatialAttention()
        self.disentanglement = FeatureDisentanglement(in_channels=2048)
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
# 2. Global Model Loading (Replaces FastAPI Lifespan)
# ----------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device context: {device}")

model = None
cam = None

def load_model_once():
    global model, cam
    if model is not None:
        return
        
    logger.info("Initializing FGVC Gender Classifier Model...")
    model_instance = FGVC_GenderClassifier()
    weights_path = "fgvc_gender_best_1.pth"
    
    if not os.path.exists(weights_path):
        weights_url = os.getenv("WEIGHTS_URL", "https://github.com/Venkatesh0001/guinea-pig-backend/releases/download/v1.0.0/fgvc_gender_best_1.pth")
        if weights_url:
            logger.info(f"Model weights not found. Downloading from WEIGHTS_URL: {weights_url}")
            try:
                import urllib.request
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
            
    torch.set_grad_enabled(False)
    
    try:
        logger.info(f"Loading state dictionary from: {weights_path}")
        state_dict = torch.load(weights_path, map_location=device, weights_only=True)
        if "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        model_instance.load_state_dict(state_dict)
        model_instance.to(device)
        model_instance.eval()
        
        del state_dict
        import gc
        gc.collect()
        
        target_layers = [model_instance.backbone[-1]]
        cam_instance = GradCAM(model=model_instance, target_layers=target_layers)
        
        model = model_instance
        cam = cam_instance
        logger.info("Model and Grad-CAM pipeline loaded successfully into memory.")
    except Exception as e:
        logger.error(f"Failed to load model weights: {e}")
        raise e

# Force load on startup
load_model_once()

# ----------------------------------------------------
# 3. Predict Endpoint & Cropping Logic
# ----------------------------------------------------
@spaces.GPU
def predict_gender(file_path: str, x_pct: float, y_pct: float, box_scale: float):
    """
    Called by Gradio client. Receives a file path (uploaded to Gradio server)
    and form variables. Returns JSON dict.
    """
    if model is None:
        return {"error": "Model is not loaded."}
        
    try:
        pil_image = ImageOps.exif_transpose(Image.open(file_path)).convert("RGB")
    except Exception as e:
        logger.error(f"Failed to open uploaded file as image: {e}")
        return {"error": f"Invalid image upload: {e}"}

    x_pct = float(x_pct) if x_pct is not None else 0.5
    y_pct = float(y_pct) if y_pct is not None else 0.5
    box_scale = float(box_scale) if box_scale is not None else 0.4

    W, H = pil_image.size
    logger.info(f"Original image size: {W}x{H}, Crop Center: ({x_pct}, {y_pct}), Scale: {box_scale}")

    cx = x_pct * W
    cy = y_pct * H
    box_side = box_scale * min(W, H)
    
    x1 = int(cx - box_side / 2)
    y1 = int(cy - box_side / 2)
    x2 = int(cx + box_side / 2)
    y2 = int(cy + box_side / 2)
    
    x1_clamped = max(0, min(W - 1, x1))
    y1_clamped = max(0, min(H - 1, y1))
    x2_clamped = max(0, min(W - 1, x2))
    y2_clamped = max(0, min(H - 1, y2))
    
    if x2_clamped <= x1_clamped or y2_clamped <= y1_clamped:
        return {"error": "Calculated crop box bounds are invalid or zero-area."}

    cropped_image = pil_image.crop((x1_clamped, y1_clamped, x2_clamped, y2_clamped))
    
    preprocess = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])
    
    input_tensor = preprocess(cropped_image).unsqueeze(0).to(device)
    
    try:
        with torch.enable_grad():
            outputs = model(input_tensor)
            probs = torch.softmax(outputs, dim=1)
            confidence, class_idx_tensor = torch.max(probs, dim=1)
            
            confidence_val = float(confidence.item())
            class_idx = int(class_idx_tensor.item())
            
            classes = ["female", "male"]
            prediction_label = classes[class_idx]
            
            targets = [ClassifierOutputTarget(class_idx)]
            
            resized_crop = cropped_image.resize((224, 224))
            rgb_img = np.array(resized_crop, dtype=np.float32) / 255.0
            
            grayscale_cam = cam(input_tensor=input_tensor, targets=targets)[0, :]
            visualization = show_cam_on_image(rgb_img, grayscale_cam, use_rgb=True)
            
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
        return {"error": f"Inference error: {str(e)}"}

# ----------------------------------------------------
# 4. Multimodal Breed Classification
# ----------------------------------------------------
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

import asyncio

async def classify_breed(file_path: str):
    try:
        with open(file_path, "rb") as f:
            contents = f.read()
    except Exception as e:
        return {"error": f"Failed to open image: {e}"}

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
    if len(contents) > MAX_FILE_SIZE:
        return {"error": "File size exceeds the 5MB security limit."}

    content_type = "image/jpeg"
    if file_path.lower().endswith(".png"):
        content_type = "image/png"
    elif file_path.lower().endswith(".webp"):
        content_type = "image/webp"

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
        return {"error": "Gemini API Key is not configured on the backend server."}

    base64_image = base64.b64encode(contents).decode("utf-8")
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
        return {"error": "Error communicating with the visual classification backend."}
    except Exception as e:
        logger.error(f"Unexpected error calling Gemini API: {e}")
        return {"error": "Failed to run visual breed classification."}

    try:
        candidate = data["candidates"][0]
        text_response = candidate["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        logger.error(f"Malformed Gemini response format: {data}")
        return {"error": "Visual classification model returned an invalid payload."}

    return {"classification": text_response}

# ----------------------------------------------------
# 5. Gradio Blocks Setup
# ----------------------------------------------------
with gr.Blocks() as demo:
    gr.Markdown("# 🐹 Guinea Pig Doctor ML Service (Native Gradio)")
    
    with gr.Tab("Predict Gender"):
        gender_img = gr.Image(type="filepath", label="Image")
        gender_x = gr.Number(label="X %")
        gender_y = gr.Number(label="Y %")
        gender_s = gr.Number(label="Scale")
        gender_btn = gr.Button("Predict Gender")
        gender_out = gr.JSON(label="Result")
        
        gender_btn.click(
            fn=predict_gender, 
            inputs=[gender_img, gender_x, gender_y, gender_s], 
            outputs=[gender_out],
            api_name="predict_gender"
        )
        
    with gr.Tab("Classify Breed"):
        breed_img = gr.Image(type="filepath", label="Image")
        breed_btn = gr.Button("Classify Breed")
        breed_out = gr.JSON(label="Result")
        
        breed_btn.click(
            fn=classify_breed,
            inputs=[breed_img],
            outputs=[breed_out],
            api_name="classify_breed"
        )

# Hugging Face Space automatically detects and launches `demo` or we can explicitly launch
if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
