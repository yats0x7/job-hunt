# Startup Discovery Platform

Automated pipeline that discovers startups from VC portfolios, enriches with
founder and hiring data, and presents everything through a polished dashboard.



---

## What This Is

A pipeline + dashboard that tracks **800+ YC-backed companies**, their founders,
open jobs, and funding data. The pipeline refreshes weekly via GitHub Actions;
the dashboard reads the resulting JSON and renders a filterable, searchable grid
with company detail pages.

## How It Works

1. **Fetch** — paginate YC's Algolia search index to pull every active company.
2. **Resolve jobs** — 4-tier cascade determines each company's open-role count:
   | Tier | Method | Latency | Coverage |
   |------|--------|---------|----------|
   | 1 | ATS API (Greenhouse, Lever, Ashby …) | <200 ms | ~82% |
   | 2 | HTML heuristics (CSS selectors) | <50 ms | ~11% |
   | 3 | LLM extraction (Ollama llama3.2:1b) | <10 s | ~5% |
   | 4 | Graceful fallback (manual-visit link) | instant | ~2% |
3. **Enrich founders** — Playwright scrapes founder photos & details from YC profiles.
4. **LLM enrichment** — local Ollama extracts college info from unstructured bios.
5. **Store & export** — SQLite (with 7-day founder cache) → `data/companies.json`.
6. **Dashboard** — Next.js reads the JSON at build time; no API server needed.

## Running the Pipeline

```bash
# Quick smoke test (5 companies, no AI, no founder scraping):
python3 -m pipeline --source yc --limit 5 --hiring-only --no-llm --no-founders

# Full run (all hiring companies, with AI enrichment):
python3 -m pipeline --source yc --hiring-only
```

### CLI Flags

| Flag | Effect |
|------|--------|
| `--source <slug>` | VC adapter to use (`yc`, `antler`, …) |
| `--hiring-only` | Exclude companies not currently hiring |
| `--limit N` | Process only the first N companies |
| `--no-founders` | Skip Playwright founder scraping |
| `--no-llm` | Disable all Ollama calls |

## Running the Dashboard

```bash
cd dashboard
npm install
npm run sync-data   # copies data/companies.json → public/
npm run dev          # → http://localhost:3000
```

### Dashboard Features

- **Stats bar** — live counts for companies tracked, data completeness %, hiring count, and job-resolution tier breakdown.
- **Filter sidebar** — search, hiring-only toggle, top-company toggle, batch & industry multi-select.
- **Company cards** — logo, description, industry tags, location, founder avatars, and a job-count badge linking to the careers page.
- **Company detail pages** — `/company/[slug]` with full founder profiles, job board embed, and metadata.
- **Responsive** — mobile filter FAB, fluid grid from 1→3 columns.

## Adding a New VC (Plugin Architecture)

The platform uses a plugin-based source system. Adding a new VC takes two steps:

**Step 1** — Create `pipeline/scrapers/<slug>/source.py`:
```python
class LightspeedSource(VCSource):
    name = "Lightspeed"
    slug = "lightspeed"

    async def list_companies_raw(self): ...
    def parse_company(self, raw): ...
    async def get_founders(self, company): ...
```

**Step 2** — Register in `pipeline/scrapers/registry.py`:
```python
"lightspeed": LightspeedSource,
```

Run with:
```bash
python3 -m pipeline --source lightspeed
```

The job resolver, founder enricher, storage layer, and dashboard all work
automatically — zero changes needed.

## Architecture

```text
pipeline/
  __main__.py              ← entry point (python -m pipeline)
  scrapers/
    base.py                ← VCSource abstract interface
    registry.py            ← maps --source slug → class
    yc/                    ← YC adapter (Algolia + Playwright)
    antler/                ← Antler adapter (extensibility demo)
  enrichment/
    job_resolver.py        ← 4-tier job-counting cascade
    founder_enricher.py    ← Playwright founder extraction
    llm_fallback.py        ← Ollama integration
    photo_url.py           ← S3 signed-URL normalizer
  storage/
    db.py                  ← SQLite with 7-day founder cache
    models.py              ← Pydantic v2 schemas (Company, Founder, JobBoardResult)
    export.py              ← SQLite → companies.json
  pipeline/
    run.py                 ← async orchestrator with CLI arg parsing

dashboard/                 ← Next.js 16 app
  app/
    page.tsx               ← main grid page (server component)
    company/[slug]/page.tsx← company detail page
    globals.css            ← global styles
    layout.tsx             ← root layout with metadata
  components/
    DashboardClient.tsx    ← client shell (header, grid, footer)
    StatsBar.tsx           ← live stats + tier badges
    FilterSidebar.tsx      ← search, toggles, batch/industry filters
    CompanyCard.tsx         ← card with logo, founders, job badge
    FounderChip.tsx        ← avatar + name chip
    JobBadge.tsx           ← animated open-roles link
  lib/
    data.ts                ← reads & parses companies.json
    types.ts               ← TypeScript interfaces

data/
  companies.json           ← pipeline output (git-tracked)

.github/workflows/
  weekly_scrape.yml        ← Monday 09:00 UTC cron (or manual dispatch)
  ci.yml                   ← pipeline import check + dashboard build
```

## Data Completeness Score

Each company gets a score from 0.0 → 1.0 across 4 dimensions (0.25 each):

| Dimension | Requirement |
|-----------|-------------|
| Company Identity | Name + logo both present |
| Founder Data | ≥1 founder with photo |
| Job Data | Job count + authoritative URL resolved |
| Location & Industry | Both location and industry present |

## CI / CD

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| **CI** | Push / PR to `main` | Verifies pipeline imports, runs public-URL unit tests, typechecks + builds dashboard |
| **Weekly Scrape** | `cron 0 9 * * 1` / manual | Full pipeline run (`--no-llm --no-founders`), commits updated JSON, pushes with retry logic |

## Tech Stack

- **Pipeline**: Python 3.11+, httpx, beautifulsoup4, pydantic v2, tenacity, playwright, lxml
- **Dashboard**: Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion
- **Storage**: SQLite (stdlib) → JSON export
- **Scheduling**: GitHub Actions (weekly cron)
- **LLM**: Ollama (local, optional — `llama3.2:1b`)


