from fastapi import FastAPI
from router import router
from vacantes_router import router as vacantes_router
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse


def create_app() -> FastAPI:
    app = FastAPI(default_response_class=JSONResponse)

    app.include_router(router)
    app.include_router(vacantes_router)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://d561t2pbktp9t.cloudfront.net"
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    return app

app = create_app()