"""PsychMonitor frontend — статика + прокси к бэкенду.

Отдаёт статические файлы фронта и проксирует /api/* и /metrics в бэкенд
PsychMonitor, подставляя Bearer-токен. Токен не попадает в браузер.

Запуск:
    python -m uvicorn server:app --host 127.0.0.1 --port 5500
"""
from __future__ import annotations

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles

load_dotenv()

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://144.31.203.220:8000").rstrip("/")
BACKEND_TOKEN = os.getenv("BACKEND_TOKEN", "")

BASE_DIR = Path(__file__).resolve().parent

# Пути, которые проксируем в бэкенд (всё остальное — статика фронта).
PROXY_PREFIXES = ("/api", "/metrics")

app = FastAPI(title="PsychMonitor Frontend Proxy")


async def _proxy(request: Request, path: str) -> Response:
    url = f"{BACKEND_BASE_URL}/{path.lstrip('/')}"
    headers = {"Authorization": f"Bearer {BACKEND_TOKEN}", "accept": "application/json"}
    if request.headers.get("content-type"):
        headers["Content-Type"] = request.headers["content-type"]
    body = await request.body()

    async with httpx.AsyncClient(timeout=30.0) as client:
        upstream = await client.request(
            request.method,
            url,
            params=request.query_params,
            content=body or None,
            headers=headers,
        )

    # Прокидываем тело и тип контента обратно.
    media_type = upstream.headers.get("content-type", "application/json")
    return Response(content=upstream.content, status_code=upstream.status_code, media_type=media_type)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_api(request: Request, path: str) -> Response:
    return await _proxy(request, f"api/{path}")


@app.api_route("/metrics", methods=["GET"])
async def proxy_metrics(request: Request) -> Response:
    return await _proxy(request, "metrics")


# Статика фронта (index.html, app.js, styles.css...). Должна идти ПОСЛЕ /api роутов.
app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")
