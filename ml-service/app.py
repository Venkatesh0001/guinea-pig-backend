import os
import gradio as gr
from main import app as fastapi_app

# Define a simple Gradio UI so Hugging Face ZeroGPU detects a valid Gradio app
with gr.Blocks() as demo:
    gr.Markdown("# 🐹 Guinea Pig Doctor ML Service\nActive and listening for API requests.")

# Mount the Gradio blocks onto our FastAPI app at the root
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=port)
