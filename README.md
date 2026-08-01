# Startup Discovery Platform

Automated pipeline that discovers startups from VC portfolios, enriches with
founder and hiring data, and presents everything through a beautiful dashboard.

## What This Is
An automated startup discovery platform that tracks YC-backed companies,
their founders, open jobs, and funding information. Data refreshes weekly.

## How It Works
1. Fetches company data from YC's Algolia search index
2. Resolves job counts via a 4-tier cascade:
   - Tier 1: Direct ATS API calls (Greenhouse, Lever, Ashby) — instant, exact
   - Tier 2: HTML heuristics — fast, covers custom pages
   - Tier 3: Local LLM extraction — catches edge cases
   - Tier 4: Graceful fallback — stores careers URL for manual visit
3. Extracts founder data via Playwright (real browser automation)
4. Enriches with college info via local LLM (Ollama llama3.2:1b)
5. Exports to JSON → served by Next.js dashboard

## Running Locally
```bash
# Fast test (5 companies, no AI, no founder photos):
python3 -m pipeline --source yc --limit 5 --hiring-only --no-llm --no-founders

# Full run (all hiring companies, with AI enrichment):
python3 -m pipeline --source yc --hiring-only
```

## Adding a New VC (Extensibility)
The platform uses a plugin architecture. Adding Lightspeed takes 2 steps:

Step 1 — Create `pipeline/scrapers/lightspeed/source.py`:
```python
class LightspeedSource(VCSource):
    name = "Lightspeed"
    slug = "lightspeed"
    async def list_companies_raw(self): ...
    def parse_company(self, raw): ...
    async def get_founders(self, company): ...
```

Step 2 — Register in `pipeline/scrapers/registry.py`:
```python
"lightspeed": LightspeedSource,
```

Run with:
```bash
python3 -m pipeline --source lightspeed
```

The job resolver, founder enricher, storage, and dashboard
require zero changes. The new VC just works.

## Architecture
```text
pipeline/
  scrapers/
    base.py          ← VCSource interface (the extensibility contract)
    registry.py      ← Maps "--source yc" to YCSource class
    yc/              ← YC adapter (Algolia API + Playwright)
    antler/          ← Antler adapter (demonstrates extensibility)
  enrichment/
    job_resolver.py  ← 4-tier job counting cascade
    founder_enricher.py ← Playwright-based founder extraction
    llm_fallback.py  ← Ollama integration for unstructured text
  storage/
    db.py            ← SQLite with 7-day founder cache
    models.py        ← Pydantic schemas (Company, Founder, JobBoardResult)
    export.py        ← SQLite → companies.json
  pipeline/
    run.py           ← Orchestrator with CLI flags
dashboard/           ← Next.js 14 app reading companies.json
.github/workflows/   ← Weekly automation
```

## Data Completeness Score

Each company gets a score from 0.0 to 1.0 based on 4 dimensions (0.25 each):

| Dimension | Requirement |
|---|---|
| Company Identity | Name + logo both present |
| Founder Data | At least one founder with photo |
| Job Data | Job count + authoritative URL resolved |
| Location & Industry | Both location and industry present |

## Job Resolution Tiers

| Tier | Method | Target | Coverage |
|---|---|---|---|
| 1 | ATS API (Greenhouse, Lever, Ashby...) | <200ms | ~82% |
| 2 | HTML Heuristics (CSS selectors) | <50ms | ~11% |
| 3 | LLM Extraction (Ollama llama3.2:1b) | <10s | ~5% |
| 4 | Graceful Skip (manual_visit link) | instant | ~2% |

## Tech Stack

- **Pipeline**: Python 3.11+, httpx, beautifulsoup4, pydantic v2, tenacity
- **Dashboard**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Storage**: SQLite (stdlib) → JSON export
- **Scheduling**: GitHub Actions (weekly cron)
- **LLM**: Ollama (local, optional)

## License

MIT
