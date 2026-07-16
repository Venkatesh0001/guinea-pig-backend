import os
import sys

# Disable Gradio SSR mode to prevent it from spawning a conflicting Node.js server on port 7860
os.environ["GRADIO_SSR_MODE"] = "False"

import gradio as gr
from main import app as fastapi_app

# Keep ZeroGPU supervisor happy
try:
    import spaces
except ImportError:
    class spaces:
        @staticmethod
        def GPU(func): return func

@spaces.GPU
def dummy_gpu_trigger():
    pass

# Define a simple Gradio UI to satisfy Hugging Face Space metadata checks
with gr.Blocks() as demo:
    gr.Markdown("# 🐹 Guinea Pig Doctor ML Service\nActive and listening for API requests.")

# Mount the Gradio blocks onto our FastAPI app at the root
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=port)
