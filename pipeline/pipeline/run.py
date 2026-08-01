"""
Pipeline orchestrator — coordinates scraping, enrichment, storage, and export.

Run order:
  1. Parse CLI args
  2. Call disable_llm() if --no-llm
  3. YCSource.list_companies_raw() -> paginate Algolia
  4. Parse all raw hits -> list[Company]. Filter active.
  5. Apply --hiring-only filter and --limit
  6. JobResolver.resolve() on is_hiring=True
  7. FounderEnricher.enrich_batch() on ALL
  8. Calculate completeness
  9. Upsert to SQLite
  10. Export to JSON
"""

import argparse
import asyncio
import logging
import sys
import time
from pathlib import Path

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Import disable_llm FIRST to allow disabling before other imports initialize models
from pipeline.enrichment.llm_fallback import disable_llm

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline")


async def run_pipeline(
    source_slug: str,
    hiring_only: bool,
    limit: int | None,
    no_founders: bool,
    no_llm: bool,
) -> dict:
    
    start_time = time.time()
    stats = {
        "source": source_slug,
        "companies_fetched": 0,
        "companies_stored": 0,
        "job_resolution_tiers": {
            "ats_api": 0,
            "html_heuristic": 0,
            "llm_extracted": 0,
            "manual_visit": 0,
        },
        "avg_completeness": 0.0,
        "duration_seconds": 0.0,
        "errors": [],
    }

    # 2. If --no-llm: call disable_llm() IMMEDIATELY
    if no_llm:
        logger.info("LLM disabled via --no-llm flag")
        disable_llm()

    # Now safe to import other modules
    from pipeline.scrapers.registry import get_source
    from pipeline.enrichment.job_resolver import JobResolver
    from pipeline.enrichment.founder_enricher import FounderEnricher
    from pipeline.storage.db import Database
    from pipeline.storage.export import export_to_json

    source = get_source(source_slug)
    
    db = Database()
    db.connect()

    logger.info(f'Using source: {source.name}')
    companies_raw = await source.list_companies_raw()
    companies = [source.parse_company(r) for r in companies_raw]
    # Filter active companies (YC sets status, Antler leaves it None)
    companies = [c for c in companies if c.status == "Active" or c.status is None]

    logger.info(f"Fetched {len(companies)} active companies.")

    # 5. Apply filters
    if hiring_only:
        companies = [c for c in companies if c.is_hiring]
        logger.info(f"Filtered to {len(companies)} hiring companies.")

    # 6. Apply limit
    if limit is not None:
        companies = companies[:limit]
        logger.info(f"Limited to {len(companies)} companies.")

    stats["companies_fetched"] = len(companies)

    # 7. JobResolver.resolve() on is_hiring=True companies
    logger.info("Resolving job boards...")
    job_resolver = JobResolver()
    job_sem = asyncio.Semaphore(10)

    async def resolve_job(company):
        if not company.is_hiring:
            return
        async with job_sem:
            company.job_board = await job_resolver.resolve(company)
            if company.job_board and company.job_board.source_type:
                stats["job_resolution_tiers"][company.job_board.source_type] += 1

    await asyncio.gather(*[resolve_job(c) for c in companies])

    # 8. FounderEnricher.enrich_batch() on ALL companies
    if not no_founders:
        logger.info("Enriching founder data...")
        enricher = FounderEnricher()
        companies = await enricher.enrich_batch(companies)
    else:
        logger.info("Skipping founder enrichment (--no-founders).")

    # 9. Calculate completeness
    total_completeness = 0.0
    for c in companies:
        c.data_completeness = c.calculate_completeness()
        total_completeness += c.data_completeness

    if companies:
        stats["avg_completeness"] = total_completeness / len(companies)

    # 10. Upsert all companies to SQLite
    logger.info("Storing companies in SQLite...")
    stored_count = 0
    for c in companies:
        try:
            db.upsert_company(c)
            stored_count += 1
        except Exception as e:
            logger.error(f"Failed to store {c.slug}: {e}")
            stats["errors"].append(str(e))
    
    stats["companies_stored"] = stored_count

    # 11. Export to data/companies.json
    logger.info("Exporting to JSON...")
    export_path = Path(__file__).parent.parent.parent / "data" / "companies.json"
    export_to_json(db, str(export_path))
    
    db.close()
    
    stats["duration_seconds"] = round(time.time() - start_time, 2)
    logger.info(f"Pipeline complete in {stats['duration_seconds']}s")
    return stats


def main():
    # 1. Parse CLI args (no lazy evaluation of --no-llm)
    # Parse args first, call disable_llm() second (happens inside run_pipeline)
    parser = argparse.ArgumentParser(description="Startup Discovery Pipeline")
    parser.add_argument("--source", type=str, default="yc", help="which VC adapter to use (default: yc)")
    parser.add_argument("--hiring-only", action="store_true", help="exclude non-hiring companies entirely")
    parser.add_argument("--limit", type=int, default=None, help="process only first N companies")
    parser.add_argument("--no-founders", action="store_true", help="skip FounderEnricher entirely")
    parser.add_argument("--no-llm", action="store_true", help="disable all Ollama calls")

    args = parser.parse_args()

    asyncio.run(
        run_pipeline(
            source_slug=args.source,
            hiring_only=args.hiring_only,
            limit=args.limit,
            no_founders=args.no_founders,
            no_llm=args.no_llm,
        )
    )

if __name__ == "__main__":
    main()
