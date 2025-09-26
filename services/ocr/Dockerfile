FROM python:3.10-slim

# Add the missing runtimes for Paddle (and a couple OpenCV-friendly libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    libatomic1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PIP_NO_CACHE_DIR=1 \
    PYTHONUNBUFFERED=1 \
    PADDLEOCR_HOME=/app/.paddleocr

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]