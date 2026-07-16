import modal
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse
import io
import os
import time
import base64
import logging
import httpx
from PIL import Image
import numpy as np

# Define the Modal image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]", 
        "python-multipart", 
        "torch", 
        "torchvision", 
        "numpy", 
        "opencv-python-headless", 
        "Pillow", 
        "matplotlib", 
        "grad-cam", 
        "httpx"
    )
    .run_commands(
        "apt-get update && apt-get install -y wget",
        "wget https://github.com/Venkatesh0001/guinea-pig-backend/releases/download/v1.0.0/fgvc_gender_best_1.pth -O /root/fgvc_gender_best_1.pth"
    )
)

app = modal.App("guinea-pig-ml-service")

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("modal-service")

# ----------------------------------------------------
# 1. Custom Neural Network Architecture Definitions
# ----------------------------------------------------
def get_model_classes():
    import torch
    import torch.nn as nn
    import torchvision.models as models

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
            
    return FGVC_GenderClassifier

# ----------------------------------------------------
# 2. Modal Class to hold GPU State
# ----------------------------------------------------
@app.cls(gpu="T4", image=image, min_containers=1, secrets=[modal.Secret.from_name("geminiapikey")])
class GuineaPigModel:
    @modal.enter()
    def load_model(self):
        import torch
        from pytorch_grad_cam import GradCAM
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Loading model into {self.device}...")
        
        FGVC_GenderClassifier = get_model_classes()
        self.model = FGVC_GenderClassifier()
        weights_path = "/root/fgvc_gender_best_1.pth"
        
        torch.set_grad_enabled(False)
        state_dict = torch.load(weights_path, map_location=self.device, weights_only=True)
        if "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        self.model.load_state_dict(state_dict)
        self.model.to(self.device)
        self.model.eval()
        
        target_layers = [self.model.backbone[-1]]
        self.cam = GradCAM(model=self.model, target_layers=target_layers)
        
        logger.info("Model loaded successfully.")

    @modal.fastapi_endpoint(method="POST")
    async def predict_gender(self, request: Request):
        import torch
        from torchvision import transforms
        from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
        from pytorch_grad_cam.utils.image import show_cam_on_image
        
        form = await request.form()
        file = form.get("file")
        x_pct = float(form.get("x_pct", 0.5))
        y_pct = float(form.get("y_pct", 0.5))
        box_scale = float(form.get("box_scale", 0.4))
        
        if not file:
            return JSONResponse({"error": "No file uploaded"}, status_code=400)
            
        try:
            file_bytes = await file.read()
            pil_image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        except Exception as e:
            return JSONResponse({"error": f"Invalid image: {e}"}, status_code=400)
            
        W, H = pil_image.size
        cx = x_pct * W
        cy = y_pct * H
        box_side = box_scale * min(W, H)
        
        x1 = max(0, min(W - 1, int(cx - box_side / 2)))
        y1 = max(0, min(H - 1, int(cy - box_side / 2)))
        x2 = max(0, min(W - 1, int(cx + box_side / 2)))
        y2 = max(0, min(H - 1, int(cy + box_side / 2)))
        
        if x2 <= x1 or y2 <= y1:
            return JSONResponse({"error": "Invalid crop box"}, status_code=400)

        cropped_image = pil_image.crop((x1, y1, x2, y2))
        
        preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        input_tensor = preprocess(cropped_image).unsqueeze(0).to(self.device)
        
        try:
            with torch.enable_grad():
                outputs = self.model(input_tensor)
                probs = torch.softmax(outputs, dim=1)
                confidence, class_idx_tensor = torch.max(probs, dim=1)
                
                confidence_val = float(confidence.item())
                class_idx = int(class_idx_tensor.item())
                prediction_label = ["female", "male"][class_idx]
                
                targets = [ClassifierOutputTarget(class_idx)]
                resized_crop = cropped_image.resize((224, 224))
                rgb_img = np.array(resized_crop, dtype=np.float32) / 255.0
                
                grayscale_cam = self.cam(input_tensor=input_tensor, targets=targets)[0, :]
                visualization = show_cam_on_image(rgb_img, grayscale_cam, use_rgb=True)
                
            cam_pil = Image.fromarray(visualization)
            buffer = io.BytesIO()
            cam_pil.save(buffer, format="JPEG")
            cam_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
            
            return {
                "prediction": prediction_label,
                "confidence": confidence_val,
                "cam_image": f"data:image/jpeg;base64,{cam_base64}"
            }
        except Exception as e:
            return JSONResponse({"error": f"Inference error: {e}"}, status_code=500)

    @modal.fastapi_endpoint(method="POST")
    async def classify_breed(self, request: Request):
        form = await request.form()
        file = form.get("file")
        if not file:
            return JSONResponse({"error": "No file uploaded"}, status_code=400)
            
        file_bytes = await file.read()
        if len(file_bytes) > 5 * 1024 * 1024:
            return JSONResponse({"error": "File size exceeds 5MB limit"}, status_code=400)
            
        content_type = file.content_type or "image/jpeg"
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return JSONResponse({"error": "Gemini API Key missing"}, status_code=500)
            
        base64_image = base64.b64encode(file_bytes).decode("utf-8")
        
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
        
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "parts": [
                    {"text": SYSTEM_PROMPT},
                    {"inlineData": {"mimeType": content_type, "data": base64_image}}
                ]
            }]
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(gemini_url, json=payload)
            if not resp.is_success:
                return JSONResponse({"error": f"Gemini API Error: {resp.text}"}, status_code=500)
            data = resp.json()
            
        try:
            text_response = data["candidates"][0]["content"]["parts"][0]["text"]
            return {"classification": text_response}
        except Exception:
            return JSONResponse({"error": "Invalid payload from Gemini"}, status_code=500)
