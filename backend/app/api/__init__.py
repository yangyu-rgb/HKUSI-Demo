from .batch import router as batch_router
from .crowdsource import router as crowdsource_router
from .health import router as health_router
from .prediction import router as prediction_router
from .realtime import router as realtime_router
from .subscription import router as subscription_router

__all__ = [
    "batch_router",
    "crowdsource_router",
    "health_router",
    "prediction_router",
    "realtime_router",
    "subscription_router",
]
