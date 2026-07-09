# CrossBorder AI Backend

FastAPI service for the deterministic CrossBorder AI demo.

## Architecture

```text
app/
  api/           # HTTP routers and dependency providers
  schemas/       # Pydantic request and response contracts
  services/      # Prediction and workflow business logic
  repositories/ # JSON reads and reset-on-restart memory state
  main.py        # Application assembly only
```

The route predictor combines four-port forecasts, crowdsource reports, and a deterministic origin/port/destination matrix.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

## Test

```bash
pip install -r requirements-dev.txt
pytest -q
```

Crowdsource reports and subscriptions created through the API are stored in memory and reset when the backend restarts.
