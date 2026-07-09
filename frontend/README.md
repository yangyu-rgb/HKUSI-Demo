# CrossBorder AI Frontend

React + TypeScript + Vite interface for the CrossBorder AI local demo.

## Architecture

```text
src/
  layout/   # Shared navigation and page shell
  pages/    # Route-level pages
  features/ # Domain types, API calls, hooks, and components
  shared/   # API client, formatters, and common UI states
```

Routes:

- `/` four-port status
- `/planner` location-based route prediction
- `/crowdsource` report form and live feed
- `/alerts` smart-alert setup
- `/business` enterprise batch planning

## Run

Start the backend on port `8000`, then:

```bash
npm install
npm run dev
```

Override the API base if required:

```bash
VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```

## Validate

```bash
npm test
npm run build
```
