from fastapi import FastAPI
from router import router
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(default_response_class="application/json")

    app.include_router(router)

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