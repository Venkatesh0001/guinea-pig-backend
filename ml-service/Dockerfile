FROM python:3.11-slim

# Create a non-root user with UID 1000 (Hugging Face Spaces requirement)
RUN useradd -m -u 1000 user

WORKDIR /app

# Install system dependencies (OpenGL and GLib are required by opencv-python)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements file first to exploit Docker cache layers
COPY requirements.txt .

# Install CPU-only PyTorch, then install remainder of requirements
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy source code and set ownership to the non-root user so the app can download/write files
COPY --chown=user:user . .

# Switch to the non-root user
USER user

# Set home directory environment variables
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Expose port 7860 (Hugging Face Spaces default port)
EXPOSE 7860

# Start Gradio server on port 7860
CMD ["python", "app.py"]
