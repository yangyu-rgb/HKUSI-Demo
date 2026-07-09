# Project Memory

Shared memory for team members and agents working on this repository. Update this file whenever a partial task is completed, especially after pulling or merging remote teammate changes.

## Current Status

- Final product direction: **CrossBorder AI**, a Shenzhen–Hong Kong border wait prediction and commute-planning demo.
- Local branch: `main`, tracking `origin/main`.
- Remote refs were refreshed successfully on 2026-07-09; local and remote were aligned at `cb45016` before the CrossBorder AI implementation work began.
- Backend: FastAPI deterministic demo with real-time status, prediction, crowdsource, subscription, and B2B batch endpoints.
- Frontend: React + TypeScript + Vite single-page CrossBorder AI flow covering all core demo scenes.
- Data: deterministic four-port status, wait history, crowdsource, factor, and subscription samples under `data/`.
- Documentation: API contract, demo script, team roles, and component runbooks now use the CrossBorder AI topic only.
- Existing local changes to root `README.md` and the untracked root `project_plan.md` were intentionally preserved and not edited during the repository-wide alignment task.

## Completed Tasks

| Date | Owner | Task | Changed Areas | Validation |
| --- | --- | --- | --- | --- |
| 2026-07-07 | Agent | Checked initialization state and added collaboration memory workflow. | `AGENTS.md`, `docs/project_memory.md`, `README.md` | Git status; JSON syntax; Python AST parse; package script inspection. Remote fetch failed at that time due GitHub SSL connection. |
| 2026-07-09 | Codex | Replaced the undecided three-topic scaffold with a complete CrossBorder AI deterministic MVP and aligned all supporting docs except the protected root README and project plan. | `backend/`, `frontend/`, `data/`, `docs/api_contract.md`, `docs/demo_script.md`, `docs/team_roles.md`, `docs/project_memory.md` | Remote fetch and upstream comparison; Python compile; JSON validation; seven API requests returned HTTP 200; `npm install` reported zero vulnerabilities; `npm run build` passed. In-app browser visual QA could not run because no browser instance was available. |

## Decisions

- CrossBorder AI is the only product topic represented by executable code, sample data, and supporting documentation.
- Keep the prototype deterministic and demo-only. Do not require real i口岸, map, transport, weather, notification, or AI services.
- Use a transparent rule-based predictor for the demo: time-horizon forecast plus crowdsource calibration, confidence bounds, and heuristic late-risk scoring.
- Store submitted crowdsource reports and subscriptions in memory so every backend restart restores a stable source dataset.
- Present B2B SaaS for bus operators, logistics teams, and enterprise HR as the primary commercial direction; the individual flow demonstrates product utility and data collection.
- Keep `AGENTS.md` for repository operating instructions and this file for task history, validation, sync notes, and follow-ups.

## Next Tasks

- Run browser visual and interaction QA when an in-app browser is available; verify desktop and mobile breakpoints.
- Capture the required screenshots and 60–90 second backup demo video after visual QA.
- Rehearse the flow in `docs/demo_script.md` and confirm it fits the target time.
- Verify and source all market-size, competitor, public-data, and feasibility claims before using them in the pitch.
- If production scope expands, design real data ingestion and model evaluation separately from the deterministic demo.

## Remote Sync Notes

- `git fetch` succeeded on 2026-07-09 and showed `main` aligned with `origin/main` before editing.
- Preserve the user's existing root `README.md` modification and untracked `project_plan.md`.
- Before future implementation work, refresh remote refs and integrate upstream changes if the local branch is behind.
- If Markdown conflicts occur in this file, merge entries chronologically and preserve both valid records.
