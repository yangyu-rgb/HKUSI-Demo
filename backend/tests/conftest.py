from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories import DemoRepository
from app.services import PredictionService


DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@pytest.fixture
def repository() -> DemoRepository:
    return DemoRepository(DATA_DIR)


@pytest.fixture
def prediction_service(repository: DemoRepository) -> PredictionService:
    return PredictionService(repository)


@pytest.fixture
def client() -> TestClient:
    with TestClient(create_app(DATA_DIR)) as test_client:
        yield test_client
