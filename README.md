# COMMANDER

Self-hosted GitHub push auditor. It measures what a push did and what the code became, keeps a
per-member ledger of charges *and* credits, and has an LLM write the result as a satirical
military communiqué to Discord.

A real auditor whose surface is entertainment: the communiqué is a joke, the number under it is
measured. Nothing it cannot measure, it does not say.

TypeScript monorepo — Express + Prisma + PostgreSQL API, React + Vite panel, one command to run.

## What it does

| | |
|---|---|
| **Scores each push** | Force pushes, batch dumps, direct-to-main, lazy messages, night and weekend work |
| **Measures the code** | File length, function length, nesting depth — taken with the language's own parser, not by counting braces |
| **Charges the crossing, not the state** | 190 → 210 lines is a violation; inheriting a 400-line file and leaving it at 405 is not; 400 → 350 is praise |
| **Records credit beside blame** | An improvement is written as a commendation, never netted against a charge |
| **Writes a weekly digest** | With an assessment that may cite only measured evidence — a suggestion that cannot quote one is not written |
| **Runs entirely on your machines** | Your database, your Discord, your model key. No service in between |

Rules, metrics and how it judges: [docs/RULES.md](docs/RULES.md).

## Run it

Podman is the default engine; Docker is used automatically when Podman is absent.

```bash
cp .env.example .env      # set DASHBOARD_PASSWORD, SESSION_SECRET, GITHUB_WEBHOOK_SECRET
npm run up
```

Panel on `http://localhost:8080`. Migrations run when the API starts.

| Command | |
|---|---|
| `npm run up` / `down` / `logs` | Production stack. Never `down -v` — it deletes the volume |
| `npm run dev` | Both apps hot-reload, Postgres on host port 5433 |
| `npm run verify` | typecheck + lint + build + test |
| `COMPOSE_ENGINE=docker npm run up` | Force an engine when both are installed |

Next: an OpenRouter key and a Discord webhook — [docs/SETUP.md](docs/SETUP.md).

## Documentation

| | |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | First run, API keys, connecting GitHub and Discord, known limits |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Running it on a server: engines, exposure, TLS, backups |
| [docs/RULES.md](docs/RULES.md) | What it detects, how it judges, why it is built this way |
| [docs/VISION.md](docs/VISION.md) | The thesis, and what this project refuses to be |
| [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/proposals/](docs/proposals/) | What is coming · where an idea goes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Working in this repository |

## Governance

Three binding documents, written in Arabic: [CONSTITUTION.md](CONSTITUTION.md) and one per app.
Code that violates them is rejected even when it works.

None of it is trusted to review. [`tests/`](tests/README.md) holds repo-wide guards — layering,
`any`, swallowed errors, token discipline, dead code, i18n parity, bundle weight, response time —
and every limit names the guard that enforces it. Measuring them for the first time found 24
breaches nobody had noticed. A limit reviewed by eye is a limit not enforced.

GPL-3.0.
