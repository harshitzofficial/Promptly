FROM python:3.10-slim

WORKDIR /usr/src/app

# Install necessary system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py ./

# Pre-download models to cache them inside the Docker image during build time
# We run a small script to initialize the compressor
RUN python -c "from llmlingua import PromptCompressor; PromptCompressor(model_name='microsoft/llmlingua-2-xlm-roberta-large-meetingbank', use_llmlingua2=True, device_map='cpu')" || true

ENV PORT=3006
EXPOSE 3006

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3006"]
