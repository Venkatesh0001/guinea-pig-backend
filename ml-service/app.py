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

# Mount Gradio blocks onto our FastAPI app at "/gradio" to prevent route shadowing
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

# Re-assign to demo.app so Gradio uses our customized app when calling launch()
demo.app = app

if __name__ == "__main__":
    # Let Gradio launch the server natively to trigger the supervisor's startup-report
    demo.launch(server_name="0.0.0.0", server_port=7860, prevent_thread=True)
    
    # Fallback thread blocker to prevent Hugging Face from terminating the main thread
    import time
    while True:
        time.sleep(3600)
