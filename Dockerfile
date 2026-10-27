# Single-container build: React frontend + FastAPI backend + prebuilt ChromaDB index.
FROM node:20-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_BASE_URL=
RUN npm run build

FROM python:3.11-slim
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production LLM_PROVIDER=none STATIC_DIR=/home/user/app/frontend_dist PORT=7860
WORKDIR /home/user/app
COPY --chown=user backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt
COPY --chown=user backend/ ./
COPY --chown=user --from=frontend /app/dist ./frontend_dist
RUN rm -f .env && rm -rf data/chroma && python scripts/ingest_documents.py
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips '*'"]
