# CrossBorder AI Backend

FastAPI service for the deterministic CrossBorder AI demo. It models the core product workflow without live border systems or external AI services.

## Capabilities

- Four-port real-time status
- One-to-three-hour wait prediction with confidence intervals
- Route comparison by time, cost, and late-arrival risk
- In-memory crowdsource calibration
- Smart-alert subscription setup
- B2B batch commute planning

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

Crowdsource reports and subscriptions created through the API are stored in memory and reset when the backend restarts. The source JSON files remain deterministic.
