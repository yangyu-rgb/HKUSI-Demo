from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import (
    batch_router,
    crowdsource_router,
    health_router,
    prediction_router,
    realtime_router,
    subscription_router,
)
from .config import DATA_DIR
from .exceptions import DomainValidationError
from .repositories import DemoRepository


def create_app(data_dir: Path = DATA_DIR) -> FastAPI:
    app = FastAPI(title="CrossBorder AI Demo API", version="1.1.0")
    app.state.repository = DemoRepository(data_dir)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DomainValidationError)
    async def domain_validation_error(
        _request: Request,
        error: DomainValidationError,
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(error)})

    app.include_router(health_router)
    app.include_router(realtime_router)
    app.include_router(prediction_router)
    app.include_router(crowdsource_router)
    app.include_router(subscription_router)
    app.include_router(batch_router)
    return app


app = create_app()
