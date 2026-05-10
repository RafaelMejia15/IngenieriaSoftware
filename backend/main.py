from fastapi import FastAPI
from router import router
from vacantes_router import router as vacantes_router
from postulaciones_router import router as postulaciones_router
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from cors_and_cookies import build_cors_config


def create_app() -> FastAPI:
    app = FastAPI(default_response_class=JSONResponse)

    app.include_router(router)
    app.include_router(vacantes_router)
    app.include_router(postulaciones_router)

    cors_cfg = build_cors_config()
    app.add_middleware(CORSMiddleware, **cors_cfg)
    
    return app

app = create_app()