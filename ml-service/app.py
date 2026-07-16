import os
import sys
import subprocess
import gradio as gr

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

print("=== ANTIGRAVITY DIAGNOSTICS START ===", flush=True)
print(f"Python Executable: {sys.executable}", flush=True)
print(f"Current PID: {os.getpid()}", flush=True)
print("Environment Variables:", flush=True)
for k, v in os.environ.items():
    if "KEY" not in k and "SECRET" not in k and "TOKEN" not in k:
        print(f"  {k}: {v}", flush=True)

print("\n--- Running Processes (ps -ef) ---", flush=True)
try:
    print(subprocess.check_output("ps -ef", shell=True, text=True), flush=True)
except Exception as e:
    print(f"Failed to run ps -ef: {e}", flush=True)

print("\n--- Listening Ports (ss -tuln) ---", flush=True)
try:
    print(subprocess.check_output("ss -tuln || netstat -tuln", shell=True, text=True), flush=True)
except Exception as e:
    print(f"Failed to run ss/netstat: {e}", flush=True)
print("=== ANTIGRAVITY DIAGNOSTICS END ===", flush=True)

# Define a simple Gradio UI to satisfy Hugging Face Space metadata checks
with gr.Blocks() as demo:
    gr.Markdown("# 🐹 Guinea Pig Doctor ML Service\nRunning Diagnostics...")

# Exit cleanly so we don't hang if we want to read logs immediately, 
# or let it run to capture the uvicorn error if they run it.
from main import app as fastapi_app
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=port)
