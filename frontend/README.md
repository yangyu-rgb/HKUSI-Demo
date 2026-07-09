# CrossBorder AI Frontend

React + TypeScript + Vite interface for the CrossBorder AI local demo.

The single-page flow covers:

1. Four-port real-time status and two-hour forecast
2. AI route comparison with confidence and late-arrival risk
3. Crowdsource report submission and live feed refresh
4. Smart-alert subscription
5. B2B batch-planning example

## Run

Start the backend on port `8000`, then:

```bash
npm install
npm run dev
```

The frontend expects:

```text
http://127.0.0.1:8000
```

Override the API base if required:

```bash
VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```

Build verification:

```bash
npm run build
```
