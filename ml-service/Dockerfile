FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (OpenGL and GLib are required by opencv-python)
# Running clean and update in a single RUN block minimizes layers
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements file first to exploit Docker cache layers
COPY requirements.txt .

# Install CPU-only PyTorch to minimize container size, then install remainder of requirements
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy service source code
COPY . .

# Expose microservice port
EXPOSE 8000

# Start FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
