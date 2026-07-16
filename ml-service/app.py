import os
import sys

# Disable Gradio SSR mode to prevent it from spawning a conflicting Node.js server on port 7860
os.environ["GRADIO_SSR_MODE"] = "False"

import gradio as gr
from main import app as fastapi_app
from gradio.routes import App

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

# Mount Gradio blocks onto our FastAPI app at the root "/"
# This makes FastAPI the parent app, ensuring /predict-gender and /classify-breed are matched first
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

# Re-assign to demo.app so Gradio uses our customized app when calling launch()
demo.app = app

if __name__ == "__main__":
    # Let Gradio launch the server natively, coordinating with Hugging Face's supervisor lifecycle
    demo.launch(server_name="0.0.0.0", server_port=7860)
