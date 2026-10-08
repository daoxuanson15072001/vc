# VClinks ASR worker. CPU by default (model `small`); set ASR_MODEL=large-v3 and a GPU base image when the ASR machine exists.
FROM python:3.12-slim
WORKDIR /app
COPY workers/asr/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY workers/asr/worker.py .
# Not root: the worker only needs the model cache (named volume takes this ownership on first use).
RUN useradd --system --uid 10001 asr && mkdir -p /models && chown asr /models
USER asr
# Model files are downloaded on first start into this volume (not baked into the image).
ENV HF_HOME=/models ASR_MODEL=small ASR_DEVICE=cpu
CMD ["python", "-u", "worker.py"]
