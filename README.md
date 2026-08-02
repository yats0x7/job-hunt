# Startup Discovery Platform

Automated pipeline that discovers YC startups, enriches them with founder and hiring data, and presents everything in a filterable dashboard.

**Live demo:** [https://job-hunt-self.vercel.app/](https://job-hunt-self.vercel.app/)



---

## What This Is

A **pipeline + dashboard** for job hunting among Y Combinator companies:

| Layer | Role |
|-------|------|
| **Pipeline** | Scrapes YC data, resolves open jobs, enriches founders, exports JSON |
| **Dashboard** | Next.js app that reads static JSON — no backend API required |
| **CI/CD** | Weekly GitHub Actions refresh + deploy on Vercel from `main` |

### Current dataset (as of latest export)

| Metric | Value |
|--------|-------|
| Companies tracked | **~276** (hiring-only YC set in the dashboard) |
| Algolia universe | **4000+** active YC companies scraped before hiring filter |
| Hiring companies | **~276** (what the live site shows) |
| Data source | Y Combinator (Algolia + company pages) |
| Refresh cadence | Weekly (Monday 09:00 UTC) or manual workflow dispatch |
| Deployed site | [job-hunt-self.vercel.app](https://job-hunt-self.vercel.app/) |

> Counts move with each pipeline run; dashboard numbers match `data/companies.json` / `dashboard/public/companies.json`.

---

## How It Works

1. **Fetch** — paginate YC’s Algolia index for active companies.
2. **Resolve jobs** — 4-tier cascade for open-role count + **public** job board URL:
   | Tier | Method | Notes |
   |------|--------|--------|
   | 1 | ATS API (Greenhouse, Lever, Ashby, Workable, SmartRecruiters) | Count via API; **clickable URL is the public board**, not the JSON API |
   | 2 | HTML heuristics on careers pages | CSS / link patterns |
   | 3 | LLM extraction (local Ollama) | Optional; skipped in CI |
   | 4 | Manual-visit fallback | Links to `/careers` when unresolved |
3. **Enrich founders** — Playwright scrapes YC company pages (photos, bios, LinkedIn).
4. **Normalize URLs** — strip expiring S3 presign query params on founder photos; map ATS API slugs to human-visitable boards.
5. **Store & export** — SQLite → `data/companies.json` → `dashboard/public/companies.json`.
6. **Dashboard** — Next.js reads JSON at build time; filters and detail pages run in the browser.

---

## Live site

| | |
|--|--|
| **Production** | [https://job-hunt-self.vercel.app/](https://job-hunt-self.vercel.app/) |
| **Hosting** | Vercel (dashboard Next.js app) |
| **Repo** | [github.com/yats0x7/job-hunt](https://github.com/yats0x7/job-hunt) |

After a weekly scrape commits updated JSON to `main`, Vercel rebuilds automatically so the live site stays in sync.

---

## Running the Pipeline

```bash
# From repo root — install deps once
pip install -r pipeline/requirements.txt
# Optional: founder scraping needs browsers
# playwright install chromium

# Smoke test (5 companies, no AI, no founder scraping)
PYTHONPATH=. python3 -m pipeline --source yc --limit 5 --hiring-only --no-llm --no-founders

# Full local run (hiring companies + founders + optional Ollama)
PYTHONPATH=. python3 -m pipeline --source yc --hiring-only

# Sync JSON into the dashboard public folder
cp data/companies.json dashboard/public/companies.json
# or: (cd dashboard && npm run sync-data)
```

### CLI flags

| Flag | Effect |
|------|--------|
| `--source <slug>` | VC adapter (`yc`, `antler`, …) |
| `--hiring-only` | Only companies currently marked hiring |
| `--limit N` | Process first N companies |
| `--no-founders` | Skip Playwright founder scrape (used in CI) |
| `--no-llm` | Disable Ollama (used in CI) |

---

## Running the Dashboard

```bash
cd dashboard
npm install
npm run sync-data   # data/companies.json → public/companies.json
npm run dev         # http://localhost:3000
npm run build       # production build (same path Vercel uses)
```

### Dashboard features

- **Stats bar** — companies tracked, completeness, hiring count, job-data tier mix  
- **Filters** — search, top companies, batch & industry multi-select (mobile drawer)  
- **Company cards** — logo, one-liner, tags, location, founder avatars, open-roles badge  
- **Detail pages** — `/company/[slug]` founders, job board link, about & metadata  
- **URL hardening** — build-time rewrite of signed photo URLs and broken ATS API links  

---

## Adding a New VC (plugin)

**1.** Create `pipeline/scrapers/<slug>/source.py` implementing `VCSource`:

```python
class LightspeedSource(VCSource):
    name = "Lightspeed"
    slug = "lightspeed"

    async def list_companies_raw(self): ...
    def parse_company(self, raw): ...
```

**2.** Register in `pipeline/scrapers/registry.py`:

```python
"lightspeed": LightspeedSource,
```

```bash
PYTHONPATH=. python3 -m pipeline --source lightspeed
```

Job resolver, storage, export, and dashboard pick up the new source without further changes.

---

## Architecture

```text
pipeline/
  __main__.py                 # python -m pipeline
  scrapers/
    base.py                   # VCSource interface
    registry.py               # --source slug → class
    yc/                       # Algolia + page parsers
    antler/                   # extensibility demo
  enrichment/
    job_resolver.py           # 4-tier job cascade + public ATS URLs
    founder_enricher.py       # Playwright founders
    llm_fallback.py           # optional Ollama
    photo_url.py              # durable avatar URLs
  storage/
    db.py                     # SQLite + founder cache
    models.py                 # Pydantic models
    export.py                 # → companies.json
  pipeline/run.py             # async orchestrator

dashboard/                    # Next.js 16 (App Router)
  app/                        # pages + layout
  components/                 # cards, filters, stats, jobs, founders
  lib/data.ts                 # load + normalize companies.json
  public/companies.json       # static data baked into deploy

data/
  companies.json              # canonical export (git-tracked)
  startups.db                 # local SQLite

.github/workflows/
  weekly_scrape.yml           # Mon 09:00 UTC + workflow_dispatch
  ci.yml                      # imports + dashboard build on push/PR
```

---

## Data Completeness Score

Each company scores **0.0 → 1.0** (0.25 per dimension):

| Dimension | Requirement |
|-----------|-------------|
| Company identity | Name + logo |
| Founder data | ≥1 founder with photo |
| Job data | Count + public board/careers URL |
| Location & industry | Both present |

---

## CI / CD

| Workflow | Trigger | Behavior |
|----------|---------|----------|
| **CI** | Push / PR to `main` | Pipeline import + URL helper checks; `npm run build` in `dashboard/` |
| **Weekly Scrape** | Cron Monday 09:00 UTC or **Actions → Run workflow** | `python -m pipeline --source yc --hiring-only --no-llm --no-founders`, copy JSON, commit, push onto latest `main` (race-safe) |

**Deploy:** Vercel watches `main` and rebuilds [job-hunt-self.vercel.app](https://job-hunt-self.vercel.app/) when `dashboard/public/companies.json` (or app code) changes.

> Prefer **Run workflow** on the latest `main` over “Re-run failed jobs” on old runs — re-runs use the workflow file from the original commit.

---

## Tech Stack

| Area | Stack |
|------|--------|
| Pipeline | Python 3.11+, httpx, BeautifulSoup, Pydantic v2, Playwright, tenacity |
| Dashboard | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| Storage | SQLite → static JSON |
| Hosting | Vercel |
| Automation | GitHub Actions |
| LLM (optional) | Ollama `llama3.2:1b` (local only) |

---

## Project layout (quick start)

```bash
git clone https://github.com/yats0x7/job-hunt.git
cd job-hunt

# Pipeline
pip install -r pipeline/requirements.txt
PYTHONPATH=. python3 -m pipeline --source yc --hiring-only --no-llm --no-founders --limit 10

# Dashboard
cd dashboard && npm install && npm run sync-data && npm run dev
```

Open local: [http://localhost:3000](http://localhost:3000)  
Open production: [https://job-hunt-self.vercel.app/](https://job-hunt-self.vercel.app/)

---

## License

MIT
