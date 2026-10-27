import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api.routes import router
from .config import get_settings
from .core.logging_config import configure_logging
from .core.security import BodySizeLimitMiddleware, RateLimitMiddleware, redact

settings = get_settings()
configure_logging(settings.log_level)
log = logging.getLogger("nyayasetu")


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.api_version,
                  docs_url="/docs" if settings.environment != "production" else None)

    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_bytes)
    app.add_middleware(RateLimitMiddleware, per_minute=settings.rate_limit_per_minute)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.frontend_origin.split(",") if o.strip()],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        expose_headers=["Content-Disposition"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError):
        errors = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": "Invalid request.", "errors": errors})

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        log.error("Unhandled error on %s: %s", request.url.path, redact(f"{type(exc).__name__}: {exc}"))
        return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})

    app.include_router(router)
    if settings.static_dir and (settings.static_dir / "index.html").is_file():
        mount_frontend(app, settings.static_dir.resolve())
    return app


def mount_frontend(app: FastAPI, static_dir) -> None:
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")
    index = static_dir / "index.html"

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found."})
        candidate = (static_dir / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(static_dir):
            return FileResponse(candidate)
        return FileResponse(index)


app = create_app()
